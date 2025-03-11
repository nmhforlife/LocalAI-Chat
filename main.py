from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from models import ChatRequest, ChatResponse, Document, ChatSession, Message
from models.settings import Settings
from rag_service import RAGService
from ollama_service import OllamaService
from chat_service import ChatService
import os
import httpx
from pathlib import Path
import logging
import io
from typing import List, Optional
import json
import uuid
from datetime import datetime
import asyncio
from pydantic import ValidationError

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,  # Set default level to DEBUG for more detailed logs
    format='%(levelname)s [%(asctime)s]: %(name)s - %(message)s'  # Add module name for better identification
)
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)  # Set to DEBUG for message handling investigation

# Set specific loggers to appropriate levels
logging.getLogger('uvicorn').setLevel(logging.WARNING)
logging.getLogger('fastapi').setLevel(logging.WARNING)
logging.getLogger('httpx').setLevel(logging.WARNING)
logging.getLogger('rag_service').setLevel(logging.DEBUG)  # Ensure RAG service logs are at DEBUG level

# Load settings
settings = Settings.load()

app = FastAPI(
    title="LocalChat - RAG-enabled Chatbot",
    description="A locally run chatbot that combines Ollama's LLM capabilities with RAG",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Setup templates
templates = Jinja2Templates(directory="templates")

# Initialize services
rag_service = RAGService()
ollama_service = OllamaService()
chat_service = ChatService()

@app.get("/", response_class=HTMLResponse)
async def chat_page(request: Request):
    """Serve the chat UI."""
    return templates.TemplateResponse("chat.html", {"request": request})

@app.get("/documents", response_class=HTMLResponse)
async def documents_page(request: Request):
    """Serve the documents UI."""
    return templates.TemplateResponse("documents.html", {"request": request})

@app.get("/settings", response_class=HTMLResponse)
async def settings_page(request: Request):
    """Serve the settings UI."""
    return templates.TemplateResponse("settings.html", {"request": request})

@app.get("/api/", response_class=JSONResponse)
async def api_info():
    """API information endpoint."""
    return {
        "name": "LocalChat",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "chat": "/api/chat",
            "documents": "/api/documents",
            "health": "/api/health",
            "docs": "/docs"
        }
    }

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    try:
        # Check if Ollama service is available
        ollama_service = OllamaService(settings.model_name)
        await ollama_service.check_health()
        
        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail=f"Service unhealthy: {str(e)}"
        )

@app.get("/system/status")
async def system_status():
    """System status endpoint for Zendesk app integration."""
    try:
        # Get available models
        ollama_service = OllamaService()  # Initialize without parameters
        
        try:
            models = await ollama_service.list_models()
        except Exception as e:
            logger.error(f"Error listing models: {str(e)}")
            models = []
        
        # Get document and chat counts
        rag_service = RAGService()
        try:
            document_count = len(rag_service.list_documents())
        except Exception as e:
            logger.error(f"Error listing documents: {str(e)}")
            document_count = 0
        
        # Get chat count
        chat_service = ChatService()
        try:
            chats = chat_service.list_chats()
            chat_count = len(chats) if chats else 0
        except Exception as e:
            logger.error(f"Error listing chats: {str(e)}")
            chat_count = 0
        
        # Check Ollama status
        ollama_status = "running"
        try:
            await ollama_service.verify_connection()
        except Exception as e:
            logger.error(f"Ollama connection check failed: {str(e)}")
            ollama_status = "error"
        
        # Get model names from the response
        model_names = []
        
        # Handle different response formats
        if isinstance(models, dict):
            if 'models' in models and isinstance(models['models'], list):
                # Format: {"models": [{"name": "model1"}, {"name": "model2"}]}
                model_names = [model.get('name') for model in models['models'] if isinstance(model, dict) and model.get('name')]
            elif 'models' in models and isinstance(models['models'], str):
                # Format: {"models": "model1,model2"}
                model_names = [m.strip() for m in models['models'].split(',')]
        elif isinstance(models, list):
            # Format: [{"name": "model1"}, {"name": "model2"}]
            if all(isinstance(m, dict) for m in models):
                model_names = [m.get('name') for m in models if m.get('name')]
            else:
                # Format: ["model1", "model2"]
                model_names = [str(m) for m in models if m]
        elif isinstance(models, str):
            # Format: "model1,model2"
            model_names = [m.strip() for m in models.split(',')]
            
        # Ensure we have at least the default model
        if not model_names:
            model_names = [ollama_service.default_model]
            
        return {
            "status": "ok",
            "ollama_status": ollama_status,
            "models_available": model_names,
            "current_model": ollama_service.default_model,
            "document_count": document_count,
            "chat_count": chat_count
        }
    except Exception as e:
        logger.error(f"System status check failed: {str(e)}")
        # Get default model from settings as fallback
        default_model = settings.default_model if hasattr(settings, 'default_model') else "llama3.2:latest"
        return {
            "status": "error",
            "ollama_status": "error",
            "models_available": [default_model],
            "current_model": default_model,
            "document_count": 0,
            "chat_count": 0,
            "error": str(e)
        }

@app.get("/api/models")
async def list_models():
    try:
        # Only log important state changes and errors
        if not await ollama_service.verify_connection():
            error_msg = f"Could not connect to Ollama server at {ollama_service.base_url}. Please check if Ollama is running."
            logger.error(error_msg)
            raise HTTPException(
                status_code=503,
                detail=error_msg
            )
        
        models = await ollama_service.list_models()
        
        if not models:
            error_msg = f"No models found on Ollama server at {ollama_service.base_url}. Please pull a model first using 'ollama pull {ollama_service.default_model}'"
            logger.warning(error_msg)
            raise HTTPException(
                status_code=404,
                detail=error_msg
            )
        
        return {"models": models}
    except httpx.ConnectError as e:
        error_msg = f"Could not connect to Ollama server at {ollama_service.base_url}. Error: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(
            status_code=503,
            detail=error_msg
        )
    except httpx.HTTPStatusError as e:
        error_msg = f"Ollama server error: {str(e)}. Response: {e.response.text if hasattr(e, 'response') else 'No response text'}"
        logger.error(error_msg)
        raise HTTPException(
            status_code=e.response.status_code,
            detail=error_msg
        )
    except Exception as e:
        error_msg = f"Error listing models: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "path": request.url.path,
            "method": request.method
        }
    )

@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        logger.debug(f"Processing chat request - chat_id: {request.context.get('chat_id') if request.context else 'new'}")
        logger.debug(f"Request messages: {request.messages}")
        logger.debug(f"Request message: {request.message}")
        
        if not request.messages and not request.message:
            raise HTTPException(
                status_code=400,
                detail="Either messages or message must be provided"
            )
        
        if not await ollama_service.verify_connection():
            raise HTTPException(
                status_code=503,
                detail=f"Could not connect to Ollama server at {ollama_service.base_url}. Please check if Ollama is running."
            )
        
        # Get relevant context from RAG
        try:
            # Get all user messages to build context
            user_messages = []
            if request.message:
                user_messages.append(request.message)
            if request.messages:
                user_messages.extend([m.content for m in request.messages if m.role == "user"])
            
            if user_messages:
                # Join all messages with newlines to provide full context
                context_query = "\n".join(user_messages)
                context = rag_service.get_relevant_context(context_query)
            else:
                context = ""
        except Exception as e:
            logger.warning(f"Error getting RAG context: {str(e)}")
            context = ""  # Continue without context if RAG fails
        
        # Create a new chat session if not provided
        chat_id = request.context.get('chat_id') if request.context else None
        chat = None  # Initialize chat variable in outer scope
        
        if not chat_id:
            logger.debug("Creating new chat session")
            chat_id = str(uuid.uuid4())
            chat = ChatSession(
                id=chat_id,
                title="New Chat",
                messages=[],
                model=request.model or ollama_service.default_model,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            
            # For new chats, use the messages from the request
            if request.message:
                logger.debug(f"Adding initial message to new chat: {request.message}")
                chat.messages.append(Message(
                    role="user",
                    content=request.message,
                    timestamp=datetime.now().isoformat()
                ))
            elif request.messages:
                logger.debug(f"Adding {len(request.messages)} initial messages to new chat")
                for msg in request.messages:
                    chat.messages.append(Message(
                        role=msg.role,
                        content=msg.content,
                        timestamp=datetime.now().isoformat()
                    ))
            
            logger.debug(f"Saving new chat with {len(chat.messages)} messages")
            chat_service.save_chat(chat)
        else:
            logger.debug(f"Loading existing chat session: {chat_id}")
            chat = chat_service.load_chat(chat_id)
            if chat:
                logger.debug(f"Current messages in chat before update: {len(chat.messages)}")
                if request.message:
                    logger.debug(f"Adding new message to existing chat: {request.message}")
                    chat.messages.append(Message(
                        role="user",
                        content=request.message,
                        timestamp=datetime.now().isoformat()
                    ))
                elif request.messages and request.messages:
                    last_msg = request.messages[-1]
                    logger.debug(f"Adding last message from request to existing chat: {last_msg.content}")
                    chat.messages.append(Message(
                        role=last_msg.role,
                        content=last_msg.content,
                        timestamp=datetime.now().isoformat()
                    ))
                chat.updated_at = datetime.now()
                logger.debug(f"Saving updated chat with {len(chat.messages)} messages")
                chat_service.save_chat(chat)
        
        if not chat:
            raise HTTPException(
                status_code=404,
                detail="Chat session not found or could not be created"
            )
        
        # Store chat in a variable that will be accessible to the generate function
        current_chat = chat
        logger.debug(f"Current chat has {len(current_chat.messages)} messages before generating response")
        
        # Generate response using Ollama with streaming
        async def generate():
            try:
                # Prepare messages for Ollama
                messages = []
                if context:
                    logger.debug(f"Adding RAG context as system message: {context[:100]}...")  # Log first 100 chars
                    messages.append({"role": "system", "content": context})
                
                # Use the current_chat from outer scope
                chat_messages = [{"role": msg.role, "content": msg.content} for msg in current_chat.messages]
                logger.debug(f"Adding chat messages: {json.dumps(chat_messages, indent=2)}")
                messages.extend(chat_messages)
                
                # Remove any None messages and duplicates
                messages = [msg for msg in messages if msg is not None]
                filtered_messages = []
                seen_messages = set()
                for msg in messages:
                    message_key = (msg['role'], msg['content'])
                    if message_key not in seen_messages:
                        filtered_messages.append(msg)
                        seen_messages.add(message_key)
                messages = filtered_messages
                
                logger.debug(f"Final message list to send ({len(messages)} messages):")
                for i, msg in enumerate(messages):
                    logger.debug(f"  {i+1}. role={msg['role']}, content={msg['content'][:100]}...")
                
                logger.debug(f"Sending {len(messages)} messages to Ollama")
                
                # Configure client with appropriate timeouts
                timeout = httpx.Timeout(
                    connect=10.0,  # connection timeout
                    read=300.0,    # read timeout
                    write=10.0,    # write timeout
                    pool=10.0      # pool timeout
                )
                
                # Prepare the request payload
                request_payload = {
                    "model": request.model or ollama_service.default_model,
                    "messages": messages,
                    "stream": True,
                    **(request.options or {})
                }
                
                async with httpx.AsyncClient(timeout=timeout) as client:
                    try:
                        async with client.stream(
                            "POST",
                            f"{ollama_service.base_url}/api/chat",
                            json=request_payload,
                            headers={
                                "Content-Type": "application/json",
                                "Accept": "application/x-ndjson"
                            }
                        ) as response:
                            response.raise_for_status()
                            assistant_message = ""
                            last_activity = datetime.now()
                            
                            async for line in response.aiter_lines():
                                # Check for timeout between chunks
                                now = datetime.now()
                                if (now - last_activity).total_seconds() > 30:
                                    error_msg = "Timeout waiting for model response"
                                    logger.error(error_msg)
                                    yield f"data: {json.dumps({'error': error_msg})}\n\n"
                                    yield f"data: {json.dumps({'done': True})}\n\n"
                                    return
                                
                                last_activity = now
                                
                                if line.strip():
                                    try:
                                        data = json.loads(line)
                                        
                                        # Check for error response
                                        if data.get('error'):
                                            error_msg = f"Error from Ollama: {data['error']}"
                                            logger.error(error_msg)
                                            yield f"data: {json.dumps({'error': error_msg})}\n\n"
                                            yield f"data: {json.dumps({'done': True})}\n\n"
                                            return
                                        
                                        # Extract content from message
                                        content = None
                                        if 'message' in data and isinstance(data['message'], dict):
                                            content = data['message'].get('content', '')
                                        elif 'response' in data:  # Fallback for older Ollama versions
                                            content = data.get('response', '')
                                            
                                        if content:
                                            assistant_message += content
                                            yield f"data: {json.dumps({'message': content})}\n\n"
                                        
                                        # Check for completion
                                        if data.get('done'):
                                            if not assistant_message:
                                                error_msg = "No response content received from model"
                                                logger.error(error_msg)
                                                yield f"data: {json.dumps({'error': error_msg})}\n\n"
                                                yield f"data: {json.dumps({'done': True})}\n\n"
                                                return
                                            
                                            # Save the complete chat with the assistant's response
                                            updated_chat = chat_service.load_chat(chat_id)
                                            if updated_chat:
                                                logger.debug(f"Chat messages before saving response: {len(updated_chat.messages)}")
                                                # Check if this response has already been saved
                                                last_message = updated_chat.messages[-1] if updated_chat.messages else None
                                                if not last_message or (
                                                    last_message.role != "assistant" or 
                                                    last_message.content != assistant_message
                                                ):
                                                    logger.debug("Adding new assistant response to chat")
                                                    updated_chat.messages.append(Message(
                                                        role="assistant",
                                                        content=assistant_message,
                                                        timestamp=datetime.now().isoformat()
                                                    ))
                                                    updated_chat.updated_at = datetime.now()
                                                    updated_chat.title = chat_service.generate_chat_title(updated_chat.messages)
                                                    chat_service.save_chat(updated_chat)
                                                    logger.debug(f"Chat messages after saving response: {len(updated_chat.messages)}")
                                                else:
                                                    logger.debug("Assistant response already exists in chat, skipping save")
                                            
                                            yield f"data: {json.dumps({'done': True, 'context': {'chat_id': chat_id}})}\n\n"
                                            return
                                        
                                    except json.JSONDecodeError as e:
                                        error_msg = f"Error parsing JSON from Ollama: {str(e)}"
                                        logger.error(f"{error_msg}. Raw line: {line}")
                                        yield f"data: {json.dumps({'error': error_msg})}\n\n"
                                        yield f"data: {json.dumps({'done': True})}\n\n"
                                        return
                                        
                    except httpx.HTTPStatusError as e:
                        error_msg = f"HTTP error from Ollama: {str(e)}. Response: {e.response.text if hasattr(e, 'response') else 'No response'}"
                        logger.error(error_msg)
                        yield f"data: {json.dumps({'error': error_msg})}\n\n"
                        yield f"data: {json.dumps({'done': True})}\n\n"
                        return
                        
            except httpx.ConnectTimeout as e:
                error_msg = f"Connection timeout to Ollama server at {ollama_service.base_url}: {str(e)}"
                logger.error(error_msg)
                yield f"data: {json.dumps({'error': error_msg})}\n\n"
                yield f"data: {json.dumps({'done': True})}\n\n"
                return
                
            except httpx.ReadTimeout as e:
                error_msg = f"Timeout waiting for response from Ollama server: {str(e)}"
                logger.error(error_msg)
                yield f"data: {json.dumps({'error': error_msg})}\n\n"
                yield f"data: {json.dumps({'done': True})}\n\n"
                return
                
            except Exception as e:
                error_msg = f"Error generating response: {str(e)}"
                logger.error(f"{error_msg}. Full traceback:", exc_info=True)
                yield f"data: {json.dumps({'error': error_msg})}\n\n"
                yield f"data: {json.dumps({'done': True})}\n\n"
                return

        return StreamingResponse(
            generate(),
            media_type="text/event-stream"
        )

    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.get("/api/chats")
async def list_chats():
    """List all saved chat sessions."""
    try:
        chats = chat_service.list_chats()
        return {"chats": chats}
    except Exception as e:
        logger.error(f"Error listing chats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chats")
async def create_chat():
    """Create a new chat session."""
    try:
        chat_id = str(uuid.uuid4())
        chat = ChatSession(
            id=chat_id,
            title="New Chat",
            messages=[],
            model=ollama_service.default_model,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        chat_service.save_chat(chat)
        return {"chat_id": chat_id}
    except Exception as e:
        logger.error(f"Error creating chat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chats/{chat_id}")
async def get_chat(chat_id: str):
    """Get a specific chat session."""
    try:
        chat = chat_service.load_chat(chat_id)
        if not chat:
            raise HTTPException(status_code=404, detail=f"Chat {chat_id} not found")
        return chat
    except Exception as e:
        logger.error(f"Error loading chat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/chats/{chat_id}")
async def delete_chat(chat_id: str):
    """Delete a chat session."""
    try:
        success = chat_service.delete_chat(chat_id)
        if success:
            return {"status": "success", "message": f"Deleted chat {chat_id}"}
        else:
            raise HTTPException(status_code=404, detail=f"Chat {chat_id} not found")
    except Exception as e:
        logger.error(f"Error deleting chat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/documents")
async def list_documents():
    try:
        documents = rag_service.list_documents()
        return {"documents": documents}
    except Exception as e:
        logger.error(f"Error listing documents: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/documents")
async def add_documents(files: List[UploadFile] = File(...)):
    try:
        # Get allowed file types from settings
        allowed_extensions = settings.allowed_file_types.split(',')
        max_file_size_mb = settings.max_file_size
        max_file_size_bytes = max_file_size_mb * 1024 * 1024  # Convert MB to bytes
        
        documents = []
        for file in files:
            # Check file extension
            file_ext = file.filename.split('.')[-1].lower() if '.' in file.filename else ''
            if file_ext not in allowed_extensions:
                raise HTTPException(
                    status_code=400, 
                    detail=f"File type '.{file_ext}' not allowed. Allowed types: {settings.allowed_file_types}"
                )
            
            # Read file content
            content = await file.read()
            
            # Check file size
            if len(content) > max_file_size_bytes:
                raise HTTPException(
                    status_code=400,
                    detail=f"File '{file.filename}' exceeds maximum size of {max_file_size_mb}MB"
                )
            
            # Try to decode as text
            try:
                content_str = content.decode('utf-8')
            except UnicodeDecodeError:
                raise HTTPException(
                    status_code=400,
                    detail=f"File '{file.filename}' is not a valid text file. Only text files are supported."
                )
            
            # Generate a unique ID for the document
            doc_id = str(uuid.uuid4())
            
            documents.append(Document(
                id=doc_id,
                content=content_str,
                metadata={
                    "filename": file.filename,
                    "content_type": file.content_type,
                    "size": len(content)
                }
            ))
        
        if not documents:
            raise HTTPException(status_code=400, detail="No valid documents to add")
        
        rag_service.add_documents(documents)
        return {"status": "success", "message": f"Added {len(documents)} documents"}
    except HTTPException as e:
        # Re-raise HTTP exceptions
        raise e
    except Exception as e:
        logger.error(f"Error adding documents: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/documents/{doc_id}")
async def delete_document(doc_id: str):
    try:
        success = rag_service.delete_document(doc_id)
        if success:
            return {"status": "success", "message": f"Deleted document {doc_id}"}
        else:
            raise HTTPException(status_code=404, detail=f"Document {doc_id} not found")
    except Exception as e:
        logger.error(f"Error deleting document: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Settings API endpoints
@app.get("/api/settings")
async def get_settings():
    return settings.dict()

@app.post("/api/settings")
async def update_settings(new_settings: Settings):
    try:
        # If Ollama server URL changed, reinitialize the service
        if new_settings.api_endpoint != settings.api_endpoint or new_settings.default_model != settings.default_model:
            logger.info(f"Updating Ollama settings - server: {new_settings.api_endpoint}, model: {new_settings.default_model}")
            # Update all settings
            for field, value in new_settings.dict().items():
                setattr(settings, field, value)
            
            # Save to file
            settings.save()
            
            # Force OllamaService to refresh its settings
            ollama_service._refresh_settings()
            
            # Verify the new server is accessible
            if not await ollama_service.verify_connection():
                raise HTTPException(
                    status_code=400,
                    detail=f"Could not connect to Ollama server at {new_settings.api_endpoint}"
                )
        else:
            # Update all settings
            for field, value in new_settings.dict().items():
                setattr(settings, field, value)
            # Save to file
            settings.save()
        
        return {"message": "Settings updated successfully"}
    except Exception as e:
        logger.error(f"Error updating settings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/settings/reset")
async def reset_settings():
    settings.reset()
    return {"message": "Settings reset to defaults"}

@app.get("/api/default-model")
async def get_default_model():
    """Get the default model from settings."""
    try:
        return {"default_model": settings.default_model}
    except Exception as e:
        logger.error(f"Error getting default model: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat_direct(request: ChatRequest):
    """Direct chat endpoint for Zendesk app integration."""
    # Redirect to the API chat endpoint
    return await chat(request)

@app.get("/chat/history")
async def chat_history(chat_id: Optional[str] = None):
    """Chat history endpoint for Zendesk app integration."""
    try:
        chat_service = ChatService()
        
        if chat_id:
            # Get messages for a specific chat
            chat = chat_service.load_chat(chat_id)
            if not chat or not chat.messages:
                return {"messages": []}
            
            # Format messages for the response
            formatted_messages = []
            for i, msg in enumerate(chat.messages):
                formatted_messages.append({
                    "id": getattr(msg, 'id', f"{chat_id}_{i}"),  # Generate an ID if not present
                    "chat_id": chat_id,
                    "role": msg.role,
                    "content": msg.content,
                    "created_at": msg.timestamp.isoformat() if hasattr(msg, 'timestamp') and msg.timestamp else datetime.now().isoformat(),
                    "metadata": getattr(msg, 'metadata', None)
                })
            
            return {"messages": formatted_messages}
        else:
            # Get all chats and their messages
            chats = chat_service.list_chats()
            all_messages = []
            
            for chat in chats:
                if not chat.messages:
                    continue
                    
                for i, msg in enumerate(chat.messages):
                    all_messages.append({
                        "id": getattr(msg, 'id', f"{chat.id}_{i}"),  # Generate an ID if not present
                        "chat_id": chat.id,
                        "role": msg.role,
                        "content": msg.content,
                        "created_at": msg.timestamp.isoformat() if hasattr(msg, 'timestamp') and msg.timestamp else datetime.now().isoformat(),
                        "metadata": getattr(msg, 'metadata', None)
                    })
            
            return {"messages": all_messages}
    except Exception as e:
        logger.error(f"Error getting chat history: {str(e)}")
        return {"messages": [], "error": str(e)}

@app.delete("/chat/{chat_id}")
async def delete_chat_direct(chat_id: str):
    """Delete chat endpoint for Zendesk app integration."""
    return await delete_chat(chat_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 