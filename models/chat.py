from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    model: Optional[str] = None
    messages: Optional[List[Message]] = None
    message: Optional[str] = None  # For backward compatibility
    context: Optional[Dict[str, Any]] = None
    stream: Optional[bool] = True
    options: Optional[Dict[str, Any]] = None

class ChatResponse(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None

class ChatSession(BaseModel):
    id: str
    title: str
    messages: List[Message]
    model: str
    created_at: datetime = datetime.now()
    updated_at: datetime = datetime.now() 