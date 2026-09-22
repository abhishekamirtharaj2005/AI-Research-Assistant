import json
import asyncio
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Any, Optional
from backend.app.database.connection import get_db
from backend.app.models.schemas import (
    User, ChatSession, ChatMessage, 
    ChatSessionCreate, ChatSessionUpdate, ChatSessionResponse, 
    MessageCreate, MessageResponse, UserSetting
)
from backend.app.api.endpoints.auth import get_current_user
from backend.app.rag.vectorstore import ChromaVectorStore
from backend.app.rag.agents import SYSTEM_PROMPTS, call_llm_stream

router = APIRouter()
vector_store = ChromaVectorStore()

def format_session_response(session: ChatSession) -> ChatSessionResponse:
    paper_ids = []
    if session.paper_ids_json:
        try:
            paper_ids = json.loads(session.paper_ids_json)
        except Exception:
            paper_ids = []
    elif session.paper_id:
        paper_ids = [session.paper_id]

    return ChatSessionResponse(
        id=session.id,
        title=session.title,
        paper_id=session.paper_id,
        paper_ids=paper_ids,
        model_provider=session.model_provider,
        model_name=session.model_name,
        created_at=session.created_at
    )

@router.post("/", response_model=ChatSessionResponse, status_code=status.HTTP_201_CREATED)
def create_chat_session(
    session_in: ChatSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    paper_ids_list = session_in.paper_ids or ([session_in.paper_id] if session_in.paper_id else [])
    session = ChatSession(
        user_id=current_user.id,
        title=session_in.title,
        paper_id=session_in.paper_id,
        paper_ids_json=json.dumps(paper_ids_list),
        model_provider=session_in.model_provider,
        model_name=session_in.model_name
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return format_session_response(session)

@router.get("/", response_model=List[ChatSessionResponse])
def get_chat_sessions(
    paper_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    query = db.query(ChatSession).filter(ChatSession.user_id == current_user.id)
    if paper_id is not None:
        # Filter sessions associated with this specific paper
        query = query.filter(
            (ChatSession.paper_id == paper_id) | 
            (ChatSession.paper_ids_json.like(f"%{paper_id}%"))
        )
    sessions = query.order_by(ChatSession.created_at.desc()).all()
    return [format_session_response(s) for s in sessions]

@router.put("/{session_id}", response_model=ChatSessionResponse)
def update_chat_session(
    session_id: int,
    session_in: ChatSessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if session_in.title is not None:
        session.title = session_in.title
    if session_in.paper_id is not None:
        session.paper_id = session_in.paper_id
    if session_in.paper_ids is not None:
        session.paper_ids_json = json.dumps(session_in.paper_ids)
    if session_in.model_provider is not None:
        session.model_provider = session_in.model_provider
    if session_in.model_name is not None:
        session.model_name = session_in.model_name
        
    db.commit()
    db.refresh(session)
    return format_session_response(session)

@router.get("/{session_id}/messages", response_model=List[MessageResponse])
def get_chat_messages(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    return db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc()).all()

@router.delete("/{session_id}")
def delete_chat_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    db.delete(session)
    db.commit()
    return {"message": "Chat session deleted successfully"}

@router.post("/{session_id}/stream")
def stream_chat_message(
    session_id: int,
    msg_in: MessageCreate,
    active_paper_id: Optional[int] = Query(None),
    paper_ids: Optional[str] = Query(None),
    model_provider: Optional[str] = Query(None),
    model_name: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # 1. Verify session ownership
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # 2. Get user setting
    user_setting = db.query(UserSetting).filter(UserSetting.user_id == current_user.id).first()
    if not user_setting:
        user_setting = UserSetting(user_id=current_user.id)

    # 3. Resolve target paper IDs for RAG search
    resolved_paper_ids: Optional[List[int]] = None
    if paper_ids:
        try:
            resolved_paper_ids = [int(p.strip()) for p in paper_ids.split(",") if p.strip().isdigit()]
        except Exception:
            resolved_paper_ids = None
    elif session.paper_ids_json:
        try:
            parsed = json.loads(session.paper_ids_json)
            if parsed and isinstance(parsed, list):
                resolved_paper_ids = [int(p) for p in parsed]
        except Exception:
            pass

    if not resolved_paper_ids:
        if active_paper_id is not None:
            resolved_paper_ids = [active_paper_id]
        elif session.paper_id is not None:
            resolved_paper_ids = [session.paper_id]

    # 4. Resolve Model & Provider overrides
    target_provider = model_provider or session.model_provider or user_setting.model_provider or "openai"
    target_model = model_name or session.model_name or user_setting.model_name or "gpt-4o-mini"
    model_override = {
        "model_provider": target_provider,
        "model_name": target_model
    }

    # 5. Retrieve relevant chunks from vector db (RAG)
    chunks = []
    try:
        chunks = vector_store.search_similar_chunks(
            user_id=current_user.id,
            query=msg_in.content,
            settings_obj=user_setting,
            limit=5,
            paper_ids=resolved_paper_ids
        )
    except Exception as e:
        print(f"RAG search error: {e}")
        
    # 6. Construct system prompt including context chunks
    context_str = ""
    citations_data = []
    
    if chunks:
        context_str = "\n--- RETRIEVED SCIENTIFIC CONTEXT ---\n"
        for idx, chunk in enumerate(chunks):
            p_title = chunk["metadata"]["paper_title"]
            p_page = chunk["metadata"]["page_number"]
            context_str += f"[Source {idx+1}] Paper: {p_title} | Page: {p_page}\nContent: {chunk['content']}\n\n"
            citations_data.append({
                "source_index": idx + 1,
                "paper_id": chunk["metadata"]["paper_id"],
                "paper_title": p_title,
                "page_number": p_page,
                "snippet": chunk["content"][:200] + "...",
                "confidence": chunk["confidence"]
            })

    agent_key = msg_in.agent_type.lower() if msg_in.agent_type else "coordinator"
    base_system_prompt = SYSTEM_PROMPTS.get(agent_key, SYSTEM_PROMPTS["coordinator"])
    
    combined_system_prompt = f"{base_system_prompt}\n{context_str}"
    
    # 7. Extract chat history
    history_db = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc()).all()
    chat_history = [{"role": m.role, "content": m.content} for m in history_db[-10:]]

    async def sse_generator():
        # Send citations first
        yield f"event: citations\ndata: {json.dumps(citations_data)}\n\n"
        
        full_response_parts = []
        chunks_generator = call_llm_stream(
            system_prompt=combined_system_prompt,
            user_prompt=msg_in.content,
            chat_history=chat_history,
            settings_obj=user_setting,
            model_override=model_override
        )
        
        for token in chunks_generator:
            full_response_parts.append(token)
            yield f"event: token\ndata: {json.dumps({'token': token})}\n\n"
            await asyncio.sleep(0.01)
            
        full_response = "".join(full_response_parts)
        
        # Save messages to database
        new_db = next(get_db())
        try:
            user_msg = ChatMessage(
                session_id=session_id,
                role="user",
                content=msg_in.content
            )
            new_db.add(user_msg)
            
            assistant_msg = ChatMessage(
                session_id=session_id,
                role="assistant",
                content=full_response,
                citations=json.dumps(citations_data)
            )
            new_db.add(assistant_msg)
            new_db.commit()
        except Exception as e:
            print(f"Error saving chat history: {e}")
        finally:
            new_db.close()
            
        yield f"event: done\ndata: [DONE]\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")
