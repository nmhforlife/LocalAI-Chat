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
        echo # Model Configuration
        echo MODEL_NAME=mistral
        echo EMBEDDING_MODEL=all-MiniLM-L6-v2
        echo.
        echo # Database Configuration
        echo DB_PATH=chats.db
        echo.
        echo # Storage Configuration
        echo CHROMA_PERSIST_DIRECTORY=chromadb
    ) > .env
)

REM Create necessary directories
echo Creating necessary directories...
if not exist data mkdir data
if not exist static mkdir static
if not exist templates mkdir templates
if not exist logs mkdir logs

echo Setup complete! To start working:
echo 1. Activate the virtual environment: venv\Scripts\activate.bat
echo 2. Configure your .env file with appropriate settings
echo 3. Run the application: python main.py

pause 