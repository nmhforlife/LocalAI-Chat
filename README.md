# LocalChat - RAG-enabled Chatbot with Ollama

A locally run chatbot that combines Ollama's LLM capabilities with RAG (Retrieval Augmented Generation) using Pydantic and FastAPI.

## Features

- Local LLM inference using Ollama
- RAG capabilities for context-aware responses
- FastAPI backend with async support
- Pydantic models for type safety
- ChromaDB for vector storage
- Sentence Transformers for embeddings

## Prerequisites

- Python 3.8+
- Ollama installed and running locally
- Ollama models pulled (e.g., `ollama pull llama2`)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd localchat
```

2. Create a virtual environment and activate it:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create a `.env` file with your configuration:
```env
OLLAMA_BASE_URL=http://localhost:11434
DEFAULT_MODEL=llama2
EMBEDDING_MODEL=all-minilm
CHROMA_PERSIST_DIRECTORY=./data/chroma
```

## Usage

1. Start the FastAPI server:
```bash
python main.py
```

2. The API will be available at `http://localhost:8000`

3. API Endpoints:
   - POST `/chat`: Send a chat message and get a response
   - POST `/documents`: Add documents to the RAG system

4. Example chat request:
```python
import requests

response = requests.post(
    "http://localhost:8000/chat",
    json={
        "message": "What is the capital of France?",
        "model": "llama2",  # optional
        "context": []  # optional
    }
)
print(response.json())
```

5. Example document addition:
```python
import requests

response = requests.post(
    "http://localhost:8000/documents",
    json=[{
        "content": "Paris is the capital of France.",
        "metadata": {"source": "wikipedia"}
    }]
)
print(response.json())
```

## API Documentation

Once the server is running, visit `http://localhost:8000/docs` for the interactive API documentation.

## Project Structure

- `main.py`: FastAPI application and endpoints
- `models.py`: Pydantic models for data validation
- `rag_service.py`: RAG implementation using ChromaDB
- `ollama_service.py`: Ollama API integration
- `config.py`: Configuration management
- `.env`: Environment variables
- `requirements.txt`: Project dependencies

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 