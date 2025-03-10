#!/bin/bash

echo "Starting cleanup of LocalChat project..."

# Function to safely remove files/directories
safe_remove() {
    if [ -e "$1" ]; then
        echo "Removing $1..."
        rm -rf "$1"
    fi
}

# Deactivate virtual environment if active
if [[ "$VIRTUAL_ENV" != "" ]]; then
    echo "Deactivating virtual environment..."
    deactivate
fi

# Remove Python-related files
echo "Removing Python-related files..."
safe_remove "venv"
safe_remove "__pycache__"
safe_remove "*.pyc"
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
find . -type f -name "*.pyc" -delete 2>/dev/null

# Remove Node-related files
echo "Removing Node.js-related files..."
safe_remove "node_modules"

# Remove instance-specific files
echo "Removing instance-specific files..."
safe_remove ".env"
safe_remove "chats.db"
safe_remove "chromadb"
safe_remove "data/chroma"
safe_remove "data/chats"
safe_remove "data/documents"

# Remove logs
echo "Removing log files..."
safe_remove "logs"
find . -type f -name "*.log" -delete 2>/dev/null

# Remove macOS system files
echo "Removing system files..."
find . -type f -name ".DS_Store" -delete 2>/dev/null
find . -type f -name "._*" -delete 2>/dev/null

# Remove the data directory contents but keep the directory structure
echo "Cleaning data directory..."
if [ -d "data" ]; then
    rm -rf data/*
    echo "Preserved empty data directory structure"
fi

echo "Cleanup complete! The following items were preserved:"
echo "- Project source code files (.py, .js, etc.)"
echo "- Configuration files (requirements.txt, package.json, etc.)"
echo "- Documentation files (README.md, etc.)"
echo "- Empty directory structure" 