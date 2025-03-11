#!/bin/bash

echo "Setting up LocalChat project..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is not installed. Please install Python 3 and try again."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js and try again."
    exit 1
fi

# Check if Ollama is installed and running
echo "Checking Ollama installation..."
if ! command -v ollama &> /dev/null; then
    echo "Ollama is not installed. Please install Ollama first:"
    echo "1. Visit https://ollama.ai"
    echo "2. Download and install Ollama for macOS"
    echo "3. After installation, run 'ollama serve' to start the Ollama server"
    echo "4. Run 'ollama pull llama3.2:latest' to download the default model"
    echo "5. Then run this setup script again"
    exit 1
fi

# Check if Ollama server is running
if ! curl -s http://localhost:11434/api/tags >/dev/null; then
    echo "Ollama server is not running. Please start it with:"
    echo "    ollama serve"
    echo "Then run this setup script again."
    exit 1
fi

# Check if llama3.2:latest model is available
if ! curl -s http://localhost:11434/api/tags | grep -q "llama3.2:latest"; then
    echo "The default 'llama3.2:latest' model is not downloaded. Please run:"
    echo "    ollama pull llama3.2:latest"
    echo "Then run this setup script again."
    exit 1
fi

# Create and activate virtual environment
echo "Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << EOL
# Server Configuration
HOST=localhost
PORT=8000

# Database Configuration
DB_PATH=chats.db

# Storage Configuration
DEFAULT_MODEL=llama3.2:latest
API_ENDPOINT=http://localhost:11434
EMBEDDING_MODEL=all-minilm
CHROMA_PERSIST_DIRECTORY=./data/chroma
MESSAGE_HISTORY_LIMIT=50
MAX_FILE_SIZE=10
ALLOWED_FILE_TYPES=txt,md,pdf
AUTO_SCROLL=True
THEME_MODE=light
FONT_SIZE=medium

EOL
fi

# Create necessary directories
echo "Creating necessary directories..."
mkdir -p data
mkdir -p static
mkdir -p templates
mkdir -p logs

echo "Setup complete! To start working:"
echo "1. Make sure Ollama is running: ollama serve"
echo "2. Activate the virtual environment: source venv/bin/activate"
echo "3. Configure your .env file with appropriate settings"
echo "4. Run the application: python main.py" 