import os
import shutil
import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from typing import List, Any, Optional
from backend.app.database.connection import get_db
from backend.app.models.schemas import User, Paper, PaperChunk, PaperResponse, PaperCompareRequest, UserSetting
from backend.app.api.endpoints.auth import get_current_user
from backend.app.utils.pdf import extract_pdf_data
from backend.app.rag.vectorstore import chunk_text_by_pages, ChromaVectorStore
from backend.app.rag.agents import SYSTEM_PROMPTS, call_llm_stream
from backend.app.config import settings

router = APIRouter()
vector_store = ChromaVectorStore()

@router.post("/upload", response_model=PaperResponse, status_code=status.HTTP_201_CREATED)
async def upload_paper(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Validate extension
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in [".pdf", ".txt", ".docx"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Please upload PDF, TXT, or DOCX."
        )
        
    # Save file locally
    user_upload_dir = os.path.join(settings.UPLOAD_DIR, f"user_{current_user.id}")
    os.makedirs(user_upload_dir, exist_ok=True)
    file_path = os.path.join(user_upload_dir, file.filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Create Paper db record with processing status
    paper = Paper(
        title=file.filename,
        file_path=file_path,
        status="processing",
        user_id=current_user.id
    )
    db.add(paper)
    db.commit()
    db.refresh(paper)
    
    try:
        # Extract PDF content
        if file_ext == ".pdf":
            pdf_data = extract_pdf_data(file_path)
            paper.title = pdf_data["title"]
            paper.authors = pdf_data["authors"]
            paper.abstract = pdf_data["abstract"]
            paper.metadata_json = json.dumps({
                "references": pdf_data["references"],
                "bibtex": pdf_data["bibtex"],
                "tables_count": pdf_data["tables_count"],
                "pages_count": pdf_data["pages_count"]
            })
            
            # Chunk and vector index
            chunks = chunk_text_by_pages(pdf_data["pages"])
            
        else:
            # Handle .txt and .docx as single page documents
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            paper.title = file.filename
            paper.authors = "Unknown"
            paper.abstract = content[:1000]
            paper.metadata_json = json.dumps({
                "references": "",
                "bibtex": "",
                "tables_count": 0,
                "pages_count": 1
            })
            
            chunks = [{"page_number": 1, "chunk_index": 0, "content": content}]
            
        # Write chunks to SQL DB
        for c in chunks:
            chunk_db = PaperChunk(
                paper_id=paper.id,
                page_number=c["page_number"],
                chunk_index=c["chunk_index"],
                content=c["content"]
            )
            db.add(chunk_db)
        db.commit()
        
        # Load user settings for embedding provider config
        user_setting = db.query(UserSetting).filter(UserSetting.user_id == current_user.id).first()
        
        # Add chunks to Vector Database (Chroma)
        vector_store.add_paper_chunks(
            user_id=current_user.id,
            paper_id=paper.id,
            paper_title=paper.title,
            chunks=chunks,
            settings_obj=user_setting
        )
        
        paper.status = "completed"
        db.commit()
        db.refresh(paper)
        
    except Exception as e:
        paper.status = "failed"
        db.commit()
        print(f"Error processing paper {paper.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process and index paper: {str(e)}"
        )
        
    return paper

@router.get("/", response_model=List[PaperResponse])
def get_papers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Any:
    return db.query(Paper).filter(Paper.user_id == current_user.id).all()

@router.get("/{paper_id}", response_model=PaperResponse)
def get_paper(paper_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Any:
    paper = db.query(Paper).filter(Paper.id == paper_id, Paper.user_id == current_user.id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    return paper

@router.delete("/{paper_id}")
def delete_paper(paper_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Any:
    paper = db.query(Paper).filter(Paper.id == paper_id, Paper.user_id == current_user.id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
        
    # Delete file
    if os.path.exists(paper.file_path):
        try:
            os.remove(paper.file_path)
        except Exception:
            pass
            
    # Delete vector store index
    vector_store.delete_paper_chunks(user_id=current_user.id, paper_id=paper.id)
    
    # Delete from SQL DB
    db.delete(paper)
    db.commit()
    return {"message": "Paper deleted successfully"}

@router.post("/{paper_id}/favorite", response_model=PaperResponse)
def toggle_favorite(paper_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Any:
    paper = db.query(Paper).filter(Paper.id == paper_id, Paper.user_id == current_user.id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    paper.is_favorite = not paper.is_favorite
    db.commit()
    db.refresh(paper)
    return paper

@router.post("/compare")
def compare_papers(
    req: PaperCompareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    papers = db.query(Paper).filter(Paper.id.in_(req.paper_ids), Paper.user_id == current_user.id).all()
    if not papers:
        raise HTTPException(status_code=404, detail="No matching papers found")
        
    # Build prompt with abstracts
    papers_context = ""
    for idx, p in enumerate(papers):
        papers_context += f"Paper {idx+1}: {p.title}\nAuthors: {p.authors}\nAbstract: {p.abstract}\n\n"
        
    # Generate static comparison table using the Comparison Agent
    user_setting = db.query(UserSetting).filter(UserSetting.user_id == current_user.id).first()
    
    # Run comparison non-streamingly for this endpoint
    generator = call_llm_stream(
        system_prompt=SYSTEM_PROMPTS["comparison"],
        user_prompt=f"Compare these papers:\n\n{papers_context}",
        chat_history=[],
        settings_obj=user_setting
    )
    
    full_response = "".join(list(generator))
    
    return {
        "comparison_matrix": full_response,
        "papers": [{"id": p.id, "title": p.title, "authors": p.authors} for p in papers]
    }
