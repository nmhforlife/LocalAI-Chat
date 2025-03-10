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

# Model Configuration
MODEL_NAME=mistral
EMBEDDING_MODEL=all-MiniLM-L6-v2

# Database Configuration
DB_PATH=chats.db

# Storage Configuration
CHROMA_PERSIST_DIRECTORY=chromadb
EOL
fi

# Create necessary directories
echo "Creating necessary directories..."
mkdir -p data
mkdir -p static
mkdir -p templates
mkdir -p logs

echo "Setup complete! To start working:"
echo "1. Activate the virtual environment: source venv/bin/activate"
echo "2. Configure your .env file with appropriate settings"
echo "3. Run the application: python main.py" 