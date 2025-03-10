# LocalChat API Documentation

This document provides detailed information about the LocalChat API endpoints, request/response formats, and examples.

## Base URL

All API endpoints are relative to: `http://localhost:8000`

## Authentication

Currently, the API does not require authentication as it's designed for local use.

## API Endpoints

### Chat

#### Send a Message
```http
POST /chat
```

Request Body:
```json
{
  "message": string,
  "chat_id": string | null,
  "model": string | null,
  "system_prompt": string | null,
  "temperature": float | null,
  "use_context": boolean | null
}
```

Response:
```json
{
  "response": string,
  "chat_id": string,
  "message_id": string,
  "context_used": boolean,
  "model": string,
  "created_at": string
}
```

#### Get Chat History
```http
GET /chat/history?chat_id={chat_id}
```

Response:
```json
{
  "messages": [
    {
      "id": string,
      "chat_id": string,
      "role": "user" | "assistant",
      "content": string,
      "created_at": string,
      "metadata": object | null
    }
  ]
}
```

#### Delete Chat
```http
DELETE /chat/{chat_id}
```

Response:
```json
{
  "success": boolean,
  "message": string
}
```

### Documents

#### Upload Documents
```http
POST /documents
Content-Type: multipart/form-data
```

Form Data:
- `files`: Array of files
- `metadata` (optional): JSON string of metadata

Response:
```json
{
  "documents": [
    {
      "id": string,
      "filename": string,
      "content_type": string,
      "size": number,
      "created_at": string,
      "metadata": object
    }
  ]
}
```

#### List Documents
```http
GET /documents
```

Response:
```json
{
  "documents": [
    {
      "id": string,
      "filename": string,
      "content_type": string,
      "size": number,
      "created_at": string,
      "metadata": object
    }
  ]
}
```

#### Delete Document
```http
DELETE /documents/{document_id}
```

Response:
```json
{
  "success": boolean,
  "message": string
}
```

### Settings

#### Get Settings
```http
GET /settings
```

Response:
```json
{
  "model_name": string,
  "embedding_model": string,
  "temperature": float,
  "system_prompt": string,
  "use_context": boolean,
  "max_context_length": number
}
```

#### Update Settings
```http
POST /settings
```

Request Body:
```json
{
  "model_name": string | null,
  "embedding_model": string | null,
  "temperature": float | null,
  "system_prompt": string | null,
  "use_context": boolean | null,
  "max_context_length": number | null
}
```

Response:
```json
{
  "success": boolean,
  "settings": object
}
```

### System

#### Get System Status
```http
GET /system/status
```

Response:
```json
{
  "status": "ok" | "error",
  "ollama_status": "running" | "stopped" | "error",
  "models_available": string[],
  "current_model": string,
  "document_count": number,
  "chat_count": number
}
```

## Error Handling

All endpoints may return error responses in the following format:

```json
{
  "error": string,
  "detail": string | object,
  "status_code": number
}
```

Common status codes:
- `400`: Bad Request
- `404`: Not Found
- `500`: Internal Server Error

## Rate Limiting

The API currently does not implement rate limiting as it's designed for local use.

## Examples

### Python Examples

#### Chat Conversation
```python
import requests

base_url = "http://localhost:8000"

# Start a chat
response = requests.post(
    f"{base_url}/chat",
    json={
        "message": "Hello, how can you help me?",
        "model": "mistral",
        "temperature": 0.7
    }
)
chat_data = response.json()
chat_id = chat_data["chat_id"]

# Continue conversation
response = requests.post(
    f"{base_url}/chat",
    json={
        "message": "Tell me more about RAG",
        "chat_id": chat_id
    }
)

# Get chat history
history = requests.get(
    f"{base_url}/chat/history",
    params={"chat_id": chat_id}
)
```

#### Document Management
```python
import requests

# Upload document
with open("document.pdf", "rb") as f:
    response = requests.post(
        "http://localhost:8000/documents",
        files={"files": f},
        data={"metadata": '{"source": "local", "category": "research"}'}
    )

# List documents
documents = requests.get("http://localhost:8000/documents")

# Delete document
doc_id = documents.json()["documents"][0]["id"]
requests.delete(f"http://localhost:8000/documents/{doc_id}")
```

#### Settings Management
```python
import requests

# Get current settings
settings = requests.get("http://localhost:8000/settings")

# Update settings
new_settings = requests.post(
    "http://localhost:8000/settings",
    json={
        "model_name": "mistral",
        "temperature": 0.8,
        "use_context": True
    }
)
```

## WebSocket Support

The API also provides WebSocket endpoints for real-time communication:

### Chat WebSocket
```http
WS /ws/chat/{chat_id}
```

Message format:
```json
{
  "type": "message" | "typing" | "error",
  "content": string,
  "metadata": object | null
}
```

Example WebSocket client:
```javascript
const ws = new WebSocket(`ws://localhost:8000/ws/chat/${chatId}`);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};

ws.send(JSON.stringify({
  type: "message",
  content: "Hello!"
}));
```

## Development Notes

- All timestamps are in ISO 8601 format
- File uploads are limited to 10MB per file
- Supported document types: .txt, .pdf, .doc, .docx, .md
- The API uses CORS and allows all origins by default
- Responses are in JSON format unless otherwise specified 