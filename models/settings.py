from pydantic import BaseModel, Field
from typing import Optional
import os
from pathlib import Path
import json

class Settings(BaseModel):
    # Ollama settings
    default_model: str = Field(default="llama2", env='DEFAULT_MODEL')
    api_endpoint: str = Field(default="http://localhost:11434", env='API_ENDPOINT')
    
    # For backward compatibility - use the same value as api_endpoint
    @property
    def ollama_server(self) -> str:
        # Remove trailing slash if present to avoid double slashes in URLs
        return self.api_endpoint.rstrip('/')
    
    # RAG settings
    embedding_model: str = Field(default="all-minilm", env='EMBEDDING_MODEL')
    chroma_persist_directory: str = Field(default="./data/chroma", env='CHROMA_PERSIST_DIRECTORY')
    
    # UI settings
    message_history_limit: int = Field(default=50, env='MESSAGE_HISTORY_LIMIT')
    max_file_size: int = Field(default=10, env='MAX_FILE_SIZE')
    allowed_file_types: str = Field(default="txt,md,pdf", env='ALLOWED_FILE_TYPES')
    auto_scroll: bool = Field(default=True, env='AUTO_SCROLL')
    theme_mode: str = Field(default="light", env='THEME_MODE')
    font_size: str = Field(default="medium", env='FONT_SIZE')

    @classmethod
    def load(cls):
        """Load settings from environment variables or .env file."""
        # Default values
        settings = cls()
        
        # Try to load from .env file
        env_path = Path(".env")
        if env_path.exists():
            with open(env_path) as f:
                for line in f:
                    if line.strip() and not line.startswith('#'):
                        key, value = line.strip().split('=', 1)
                        key_lower = key.lower()
                        
                        # Special case for ollama_server - set api_endpoint instead
                        if key_lower == 'ollama_server':
                            key_lower = 'api_endpoint'
                        
                        if hasattr(settings, key_lower) and not isinstance(getattr(settings.__class__, key_lower, None), property):
                            # Convert value to appropriate type
                            if key_lower in ['message_history_limit', 'max_file_size']:
                                value = int(value)
                            elif key_lower == 'auto_scroll':
                                value = value.lower() == 'true'
                            setattr(settings, key_lower, value)
        
        return settings

    def save(self):
        """Save settings to .env file."""
        env_path = Path(".env")
        env_content = []
        
        # Read existing .env content
        if env_path.exists():
            with open(env_path) as f:
                for line in f:
                    if line.strip() and not line.startswith('#'):
                        key = line.strip().split('=', 1)[0]
                        # Skip keys that will be updated
                        if key.upper() in ['API_ENDPOINT', 'OLLAMA_SERVER'] and 'api_endpoint' in self.dict():
                            continue
                        elif key.lower() in self.dict():
                            continue
                    env_content.append(line.strip())
        
        # Add or update settings
        for key, value in self.dict().items():
            if key == 'api_endpoint':
                # Ensure no trailing slash
                value = value.rstrip('/')
                # Only add API_ENDPOINT
                env_content.append(f"API_ENDPOINT={value}")
            else:
                env_content.append(f"{key.upper()}={value}")
        
        # Write back to .env
        with open(env_path, 'w') as f:
            f.write('\n'.join(env_content) + '\n')

    def reset(self):
        """Reset settings to defaults and save to .env."""
        default_settings = self.__class__()
        for key, value in default_settings.dict().items():
            setattr(self, key, value)
        self.save() 