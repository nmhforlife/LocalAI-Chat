@echo off
echo Starting cleanup of LocalChat project...

REM Function to safely remove files/directories
:SafeRemove
if exist %1 (
    echo Removing %1...
    rd /s /q %1 2>nul
    if exist %1 del /f /q %1 2>nul
)
goto :eof

REM Deactivate virtual environment if active
if defined VIRTUAL_ENV (
    echo Deactivating virtual environment...
    call deactivate
)

REM Remove Python-related files
echo Removing Python-related files...
call :SafeRemove venv
call :SafeRemove __pycache__
for /d /r %%d in (__pycache__) do @if exist "%%d" rd /s /q "%%d"
del /s /q *.pyc 2>nul

REM Remove Node-related files
echo Removing Node.js-related files...
call :SafeRemove node_modules

REM Remove instance-specific files
echo Removing instance-specific files...
call :SafeRemove .env
call :SafeRemove chats.db
call :SafeRemove chromadb
call :SafeRemove data\chroma
call :SafeRemove data\chats
call :SafeRemove data\documents

REM Remove logs
echo Removing log files...
call :SafeRemove logs
del /s /q *.log 2>nul

REM Clean data directory but keep structure
echo Cleaning data directory...
if exist data (
    del /f /s /q data\* 2>nul
    for /d %%p in (data\*) do rd /s /q "%%p" 2>nul
    echo Preserved empty data directory structure
)

echo Cleanup complete! The following items were preserved:
echo - Project source code files (.py, .js, etc.)
echo - Configuration files (requirements.txt, package.json, etc.)
echo - Documentation files (README.md, etc.)
echo - Empty directory structure

pause 