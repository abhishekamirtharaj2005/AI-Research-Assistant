import json
import asyncio
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Any, Optional
from backend.app.database.connection import get_db
from backend.app.models.schemas import User, ChatSession, ChatMessage, ChatSessionCreate, ChatSessionResponse, MessageCreate, MessageResponse, UserSetting
from backend.app.api.endpoints.auth import get_current_user
from backend.app.rag.vectorstore import ChromaVectorStore
from backend.app.rag.agents import SYSTEM_PROMPTS, call_llm_stream

router = APIRouter()
vector_store = ChromaVectorStore()

@router.post("/", response_model=ChatSessionResponse, status_code=status.HTTP_201_CREATED)
def create_chat_session(
    session_in: ChatSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    session = ChatSession(
        user_id=current_user.id,
        title=session_in.title
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

@router.get("/", response_model=List[ChatSessionResponse])
def get_chat_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    return db.query(ChatSession).filter(ChatSession.user_id == current_user.id).order_by(ChatSession.created_at.desc()).all()

@router.get("/{session_id}/messages", response_model=List[MessageResponse])
def get_chat_messages(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    return db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.ascii if hasattr(ChatMessage.created_at, 'ascii') else ChatMessage.created_at.asc()).all()

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
        user_setting = UserSetting(user_id=current_user.id)  # Default model params
        
    # 3. Retrieve relevant chunks from vector db (RAG)
    paper_ids = [active_paper_id] if active_paper_id is not None else None
    
    # Query Chroma
    chunks = []
    try:
        chunks = vector_store.search_similar_chunks(
            user_id=current_user.id,
            query=msg_in.content,
            settings_obj=user_setting,
            limit=5,
            paper_ids=paper_ids
        )
    except Exception as e:
        print(f"RAG search error: {e}")
        
    # 4. Construct system prompt including context chunks
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
            
    base_agent_prompt = SYSTEM_PROMPTS.get(msg_in.agent_type, SYSTEM_PROMPTS["coordinator"])
    combined_system_prompt = f"{base_agent_prompt}\n{context_str}\nKeep responses factual and ground them in the context provided. Use the citations numbers when presenting claims."

    # 5. Extract chat history
    history_db = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc()).all()
    chat_history = [{"role": m.role, "content": m.content} for m in history_db[-10:]]  # Limit to last 10 messages

    # 6. Stream generator
    async def sse_generator():
        # First send citation data
        yield f"event: citations\ndata: {json.dumps(citations_data)}\n\n"
        
        # Call LLM streaming
        loop = asyncio.get_event_loop()
        # Since call_llm_stream is synchronous, run it in a threadpool executor to avoid blocking event loop
        def run_sync_stream():
            return list(call_llm_stream(
                system_prompt=combined_system_prompt,
                user_prompt=msg_in.content,
                chat_history=chat_history,
                settings_obj=user_setting
            ))
            
        full_response_parts = []
        # Get chunks
        chunks_generator = call_llm_stream(
            system_prompt=combined_system_prompt,
            user_prompt=msg_in.content,
            chat_history=chat_history,
            settings_obj=user_setting
        )
        
        for token in chunks_generator:
            full_response_parts.append(token)
            yield f"event: token\ndata: {json.dumps({'token': token})}\n\n"
            await asyncio.sleep(0.01) # cooperatively yield control
            
        full_response = "".join(full_response_parts)
        
        # Save messages to database
        # Create a new DB session since we are in async environment and the outer session might close
        new_db = next(get_db())
        try:
            # Save User Message
            user_msg = ChatMessage(
                session_id=session_id,
                role="user",
                content=msg_in.content
            )
            new_db.add(user_msg)
            
            # Save Assistant Message
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
