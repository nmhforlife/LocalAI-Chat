from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
from datetime import datetime

class Document(BaseModel):
    id: Optional[str] = None
    content: str = Field(..., description="The content of the document")
    metadata: Dict[str, Any] = {}
    embedding: Optional[List[float]] = Field(None, description="Vector embedding of the document")

class ChatMessage(BaseModel):
    role: str = Field(..., description="The role of the message sender (user/assistant)")
    content: str = Field(..., description="The content of the message")
    timestamp: Optional[str] = None

class Message(BaseModel):
    role: str
    content: str
    timestamp: datetime = datetime.now()

class ChatSession(BaseModel):
    id: str
    title: str
    messages: List[Message]
    model: str
    created_at: datetime = datetime.now()
    updated_at: datetime = datetime.now()

class ChatRequest(BaseModel):
    message: str = Field(..., description="The user's message")
    model: Optional[str] = Field(None, description="The model to use for generation")
    context: Union[List[ChatMessage], Dict[str, Any]] = Field(default_factory=list, description="Previous chat context or chat metadata")

class ChatResponse(BaseModel):
    message: str = Field(..., description="The assistant's response")
    context: List[ChatMessage] = Field(..., description="Updated chat context")
    relevant_documents: Optional[List[Document]] = Field(None, description="Relevant documents used for RAG") 