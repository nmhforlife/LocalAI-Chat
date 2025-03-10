# LocalChat - RAG-enabled Local Chatbot with Ollama

A powerful, locally-run chatbot that combines Ollama's LLM capabilities with RAG (Retrieval Augmented Generation) for context-aware conversations. Built with FastAPI, Pydantic, and modern web technologies.

## Features

- 🤖 Local LLM inference using Ollama
- 📚 RAG (Retrieval Augmented Generation) for context-aware responses
- 🚀 FastAPI backend with async support
- ✨ Modern web interface with Tailwind CSS
- 🔒 Type-safe with Pydantic models
- 🗄️ Efficient vector storage with ChromaDB
- 🔍 High-quality embeddings using Sentence Transformers
- 📝 Document management system
- 🌓 Dark/Light theme support

## Prerequisites

- Python 3.8+
- Node.js and npm (for frontend dependencies)
- [Ollama](https://ollama.ai/) installed and running locally
- Ollama models pulled (e.g., `ollama pull mistral`)

## Quick Start

### Automated Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd localchat
```

2. Run the setup script:
- On Unix/macOS:
  ```bash
  ./setup.sh
  ```
- On Windows:
  ```cmd
  setup.bat
  ```

The setup script will:
- Create and activate a Python virtual environment
- Install Python dependencies
- Install Node.js dependencies
- Create necessary directories
- Set up a default configuration

### Manual Setup

If you prefer manual setup:

1. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
npm install
```

3. Create a `.env` file:
```env
# Server Configuration
HOST=localhost
PORT=8000

# Model Configuration
MODEL_NAME=mistral
EMBEDDING_MODEL=all-MiniLM-L6-v2

# Database Configuration
DB_PATH=chats.db

# Storage Configuration
CHROMA_PERSIST_DIRECTORY=chromadb
```

## Usage

1. Start the application:
```bash
python main.py
```

2. Open your browser and navigate to:
   - Web Interface: `http://localhost:8000`
   - API Documentation: `http://localhost:8000/docs`

## Features Guide

### Chat Interface
- Start conversations with the AI
- Upload documents for context
- Switch between different chat sessions
- Toggle between light and dark themes

### Document Management
- Upload various document types
- View and manage uploaded documents
- Documents are automatically embedded for RAG

### Settings
- Configure model settings
- Manage application preferences
- View system status

## API Documentation

For detailed API documentation, please see [API.md](API.md). This includes:
- Complete endpoint specifications
- Request/response formats
- Authentication details
- WebSocket support
- Code examples
- Development notes

The API provides several endpoints:

### Chat Endpoints
- `POST /chat`: Send a chat message
- `GET /chat/history`: Retrieve chat history
- `DELETE /chat/{chat_id}`: Delete a chat session

### Document Endpoints
- `POST /documents`: Upload documents
- `GET /documents`: List all documents
- `DELETE /documents/{doc_id}`: Delete a document

### Settings Endpoints
- `GET /settings`: Get current settings
- `POST /settings`: Update settings

## Project Structure

```
localchat/
├── main.py              # FastAPI application and endpoints
├── models/             # Pydantic models and database schemas
│   ├── __init__.py
│   ├── chat.py
│   ├── document.py
│   └── settings.py
├── static/             # Static files (CSS, JS, images)
│   ├── css/
│   └── js/
├── templates/          # HTML templates
├── rag_service.py      # RAG implementation
├── ollama_service.py   # Ollama integration
├── chat_service.py     # Chat handling
├── config.py          # Configuration management
└── requirements.txt    # Python dependencies
```

## Development

### Making Changes
1. Create a new branch:
```bash
git checkout -b feature-name
```

2. Make your changes and commit:
```bash
git add .
git commit -m "Description of changes"
```

3. Push to GitHub:
```bash
git push origin feature-name
```

### Cleanup
To clean up instance-specific files before sharing or deploying:

- On Unix/macOS:
  ```bash
  ./cleanup.sh
  ```
- On Windows:
  ```cmd
  cleanup.bat
  ```

This will remove:
- Virtual environment
- Node modules
- Cache files
- Instance-specific data
- Log files

## Troubleshooting

1. **Ollama Connection Issues**
   - Ensure Ollama is running (`ollama serve`)
   - Check if the model is pulled (`ollama pull mistral`)
   - Verify the host and port in `.env`

2. **Database Issues**
   - Delete `chats.db` and restart for a fresh database
   - Check write permissions in the data directory

3. **Node.js Issues**
   - Clear `node_modules` and run `npm install`
   - Ensure Node.js version is compatible

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

[MIT License](LICENSE)

## Acknowledgments

- [Ollama](https://ollama.ai/) for the local LLM capabilities
- [FastAPI](https://fastapi.tiangolo.com/) for the web framework
- [ChromaDB](https://www.trychroma.com/) for vector storage
- [Sentence Transformers](https://www.sbert.net/) for embeddings 