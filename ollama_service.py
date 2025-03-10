import httpx
from typing import List, Optional, Dict, Any
from models import Message, ChatRequest, ChatResponse
from config import get_settings
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class OllamaService:
    def __init__(self, base_url: str = None):
        self._refresh_settings()
        logger.info(f"Initialized OllamaService with base_url: {self.base_url}, default_model: {self.default_model}")

    def _refresh_settings(self):
        """Refresh settings from the current configuration."""
        settings = get_settings()
        # Ensure base_url doesn't have a trailing slash to avoid double slashes in URLs
        self.base_url = settings.api_endpoint.rstrip('/')
        self.default_model = settings.default_model
        logger.info(f"Refreshed settings - base_url: {self.base_url}, default_model: {self.default_model}")

    async def list_models(self) -> Dict[str, Any]:
        """List all available models from the Ollama server."""
        try:
            # Refresh settings to ensure we have the latest values
            self._refresh_settings()
            logger.info(f"Refreshed settings - base_url: {self.base_url}, default_model: {self.default_model}")
            
            logger.info(f"Attempting to list models from {self.base_url}")
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Use the /api/tags endpoint to list models
                logger.info("Trying /api/tags endpoint...")
                # Ensure no double slashes in URL
                tags_url = f"{self.base_url}/api/tags".replace("//api", "/api")
                logger.info(f"Request URL: {tags_url}")
                response = await client.get(tags_url)
                response.raise_for_status()
                data = response.json()
                logger.info(f"Tags endpoint response: {data}")
                
                models = []
                if 'models' in data:
                    for model in data['models']:
                        if 'name' in model:
                            models.append(model['name'])
                            logger.info(f"Found model: {model['name']}")
                
                # Ensure default model is in the list
                if self.default_model not in models:
                    models.append(self.default_model)
                    logger.info(f"Added default model: {self.default_model}")

                # Sort models
                models.sort()
                
                logger.info(f"Final list of models: {models}")
                return {
                    "models": models,
                    "default_model": self.default_model
                }
                
        except httpx.ConnectError as e:
            logger.error(f"Could not connect to Ollama server at {self.base_url}. Error: {str(e)}")
            raise
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error listing models: {str(e)}. Response: {e.response.text if hasattr(e, 'response') else 'No response text'}")
            raise
        except Exception as e:
            logger.error(f"Error listing models: {str(e)}")
            raise

    async def verify_connection(self) -> bool:
        """Verify that the Ollama server is accessible."""
        try:
            # Refresh settings to ensure we have the latest values
            self._refresh_settings()
            logger.info(f"Verifying connection to Ollama server at {self.base_url}")
            async with httpx.AsyncClient(timeout=5.0) as client:
                # Ensure no double slashes in URL
                version_url = f"{self.base_url}/api/version".replace("//api", "/api")
                logger.info(f"Request URL: {version_url}")
                response = await client.get(version_url)
                response.raise_for_status()
                version_data = response.json()
                logger.info(f"Successfully connected to Ollama server. Version: {version_data}")
                return True
        except Exception as e:
            logger.error(f"Error verifying Ollama connection: {str(e)}")
            return False 