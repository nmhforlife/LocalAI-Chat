from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List

class Document(BaseModel):
    id: Optional[str] = None
    content: str = Field(..., description="The content of the document")
    metadata: Dict[str, Any] = {}
    embedding: Optional[List[float]] = Field(None, description="Vector embedding of the document") 