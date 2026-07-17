from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Any, Dict
from backend.app.database.connection import Base

# ==========================================
# SQLALCHEMY MODELS
# ==========================================

class User(Base):
    __tablename__ = "users"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    papers = relationship("Paper", back_populates="owner", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="owner", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="owner", cascade="all, delete-orphan")
    settings = relationship("UserSetting", back_populates="owner", uselist=False, cascade="all, delete-orphan")

class Paper(Base):
    __tablename__ = "papers"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=True)
    authors = Column(String, nullable=True)
    abstract = Column(Text, nullable=True)
    file_path = Column(String, nullable=False)
    upload_date = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String, default="processing")  # processing, completed, failed
    metadata_json = Column(Text, nullable=True)  # JSON-string of paper properties
    is_favorite = Column(Boolean, default=False)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    owner = relationship("User", back_populates="papers")
    chunks = relationship("PaperChunk", back_populates="paper", cascade="all, delete-orphan")

class PaperChunk(Base):
    __tablename__ = "paper_chunks"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    paper_id = Column(Integer, ForeignKey("papers.id"))
    page_number = Column(Integer, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    embedding_id = Column(String, nullable=True)
    
    paper = relationship("Paper", back_populates="chunks")

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    owner = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"))
    role = Column(String, nullable=False)  # user, assistant
    content = Column(Text, nullable=False)
    citations = Column(Text, nullable=True)  # JSON-string of citations
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    session = relationship("ChatSession", back_populates="messages")

class Report(Base):
    __tablename__ = "reports"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    type = Column(String, nullable=False)  # review, summary, gap, presentation, bibtex
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    owner = relationship("User", back_populates="reports")

class UserSetting(Base):
    __tablename__ = "user_settings"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    model_provider = Column(String, default="openai")  # openai, gemini, anthropic, ollama
    model_name = Column(String, default="gpt-4o-mini")
    temperature = Column(Float, default=0.2)
    max_tokens = Column(Integer, default=2000)
    chunk_size = Column(Integer, default=1000)
    chunk_overlap = Column(Integer, default=200)
    api_keys_encrypted = Column(Text, default="")
    
    owner = relationship("User", back_populates="settings")


# ==========================================
# PYDANTIC SCHEMAS
# ==========================================

# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# Paper Schemas
class PaperResponse(BaseModel):
    id: int
    title: Optional[str] = None
    authors: Optional[str] = None
    abstract: Optional[str] = None
    file_path: str
    upload_date: datetime
    status: str
    is_favorite: bool
    metadata_json: Optional[str] = None
    
    class Config:
        from_attributes = True

class PaperCompareRequest(BaseModel):
    paper_ids: List[int]

# Chat Schemas
class MessageCreate(BaseModel):
    content: str
    agent_type: Optional[str] = "coordinator"  # coordinator, research, summary, citation, literature, comparison, gap, presentation, reviewer, planner

class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    citations: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class ChatSessionCreate(BaseModel):
    title: str

class ChatSessionResponse(BaseModel):
    id: int
    title: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# Report Schemas
class ReportCreate(BaseModel):
    title: str
    type: str
    content: str

class ReportGenerateRequest(BaseModel):
    type: str  # review, summary, gap, presentation, bibtex
    paper_ids: List[int]
    custom_prompt: Optional[str] = None

class ReportResponse(BaseModel):
    id: int
    title: str
    type: str
    content: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# Settings Schemas
class UserSettingBase(BaseModel):
    model_provider: str
    model_name: str
    temperature: float
    max_tokens: int
    chunk_size: int
    chunk_overlap: int
    api_keys_encrypted: Optional[str] = ""

class UserSettingResponse(UserSettingBase):
    id: int
    user_id: int
    
    class Config:
        from_attributes = True
