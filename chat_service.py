import json
import os
from datetime import datetime
import uuid
from typing import List, Optional
from models import ChatSession, Message

class ChatService:
    def __init__(self, storage_dir: str = "data/chats"):
        self.storage_dir = storage_dir
        os.makedirs(storage_dir, exist_ok=True)

    def _get_chat_path(self, chat_id: str) -> str:
        return os.path.join(self.storage_dir, f"{chat_id}.json")

    def save_chat(self, chat: ChatSession) -> str:
        """Save a chat session to disk."""
        chat_path = self._get_chat_path(chat.id)
        chat_data = chat.dict()
        
        # Ensure timestamps are strings
        chat_data['created_at'] = chat_data['created_at'].isoformat() if isinstance(chat_data['created_at'], datetime) else chat_data['created_at']
        chat_data['updated_at'] = chat_data['updated_at'].isoformat() if isinstance(chat_data['updated_at'], datetime) else chat_data['updated_at']
        
        # Ensure message timestamps are strings
        for msg in chat_data['messages']:
            if 'timestamp' not in msg:
                msg['timestamp'] = datetime.now().isoformat()
            elif isinstance(msg['timestamp'], datetime):
                msg['timestamp'] = msg['timestamp'].isoformat()
        
        with open(chat_path, 'w') as f:
            json.dump(chat_data, f, default=str)
        return chat.id

    def load_chat(self, chat_id: str) -> Optional[ChatSession]:
        """Load a chat session from disk."""
        chat_path = self._get_chat_path(chat_id)
        if not os.path.exists(chat_path):
            return None
        
        with open(chat_path, 'r') as f:
            data = json.load(f)
            # Convert string timestamps back to datetime
            data['created_at'] = datetime.fromisoformat(data['created_at'])
            data['updated_at'] = datetime.fromisoformat(data['updated_at'])
            
            # Ensure all messages have timestamps
            for msg in data['messages']:
                if 'timestamp' not in msg:
                    msg['timestamp'] = datetime.now().isoformat()
                elif isinstance(msg['timestamp'], datetime):
                    msg['timestamp'] = msg['timestamp'].isoformat()
            
            return ChatSession(**data)

    def list_chats(self) -> List[ChatSession]:
        """List all saved chat sessions."""
        chats = []
        for filename in os.listdir(self.storage_dir):
            if filename.endswith('.json'):
                chat_id = filename[:-5]  # Remove .json extension
                chat = self.load_chat(chat_id)
                if chat:
                    chats.append(chat)
        return sorted(chats, key=lambda x: x.updated_at, reverse=True)

    def delete_chat(self, chat_id: str) -> bool:
        """Delete a chat session."""
        chat_path = self._get_chat_path(chat_id)
        if os.path.exists(chat_path):
            os.remove(chat_path)
            return True
        return False

    def generate_chat_title(self, messages: List[Message]) -> str:
        """Generate a title for the chat based on the first few messages."""
        if not messages:
            return "New Chat"
        
        # Use the first user message as the title, truncated to 50 characters
        for msg in messages:
            if msg.role == "user":
                title = msg.content[:50]
                if len(msg.content) > 50:
                    title += "..."
                return title
        
        return "New Chat" 