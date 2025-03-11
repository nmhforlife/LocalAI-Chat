@echo off
echo Setting up LocalChat project...

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Python is not installed. Please install Python and try again.
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo Node.js is not installed. Please install Node.js and try again.
    exit /b 1
)

REM Check if Ollama is installed and running
echo Checking Ollama installation...
where ollama >nul 2>&1
if errorlevel 1 (
    echo Ollama is not installed. Please install Ollama first:
    echo 1. Visit https://ollama.ai
    echo 2. Download and install Ollama for Windows
    echo 3. After installation, run 'ollama serve' to start the Ollama server
    echo 4. Run 'ollama pull llama3.2:latest' to download the default model
    echo 5. Then run this setup script again
    exit /b 1
)

REM Check if Ollama server is running
curl -s http://localhost:11434/api/tags >nul 2>&1
if errorlevel 1 (
    echo Ollama server is not running. Please start it with:
    echo     ollama serve
    echo Then run this setup script again.
    exit /b 1
)

REM Check if llama3.2:latest model is available
curl -s http://localhost:11434/api/tags | findstr "llama3.2:latest" >nul 2>&1
if errorlevel 1 (
    echo The default 'llama3.2:latest' model is not downloaded. Please run:
    echo     ollama pull llama3.2:latest
    echo Then run this setup script again.
    exit /b 1
)

REM Create and activate virtual environment
echo Creating Python virtual environment...
python -m venv venv
call venv\Scripts\activate.bat

REM Install Python dependencies
echo Installing Python dependencies...
python -m pip install --upgrade pip
pip install -r requirements.txt

REM Install Node.js dependencies
echo Installing Node.js dependencies...
npm install

REM Create .env file if it doesn't exist
if not exist .env (
    echo Creating .env file...
    (
        echo # Server Configuration
        echo HOST=localhost
        echo PORT=8000
        echo.
        echo # Database Configuration
        echo DB_PATH=chats.db
        echo.
        echo # Storage Configuration
        echo DEFAULT_MODEL=llama3.2:latest
        echo API_ENDPOINT=http://localhost:11434
        echo EMBEDDING_MODEL=all-minilm
        echo CHROMA_PERSIST_DIRECTORY=./data/chroma
        echo MESSAGE_HISTORY_LIMIT=50
        echo MAX_FILE_SIZE=10
        echo ALLOWED_FILE_TYPES=txt,md,pdf
        echo AUTO_SCROLL=True
        echo THEME_MODE=light
        echo FONT_SIZE=medium
    ) > .env
)

REM Create necessary directories
echo Creating necessary directories...
if not exist data mkdir data
if not exist static mkdir static
if not exist templates mkdir templates
if not exist logs mkdir logs

echo Setup complete! To start working:
echo 1. Make sure Ollama is running: ollama serve
echo 2. Activate the virtual environment: venv\Scripts\activate.bat
echo 3. Configure your .env file with appropriate settings
echo 4. Run the application: python main.py

pause 