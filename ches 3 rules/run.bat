@echo off
cd /d "%~dp0"
echo.
echo  ⚔️  CHAOS CHESS - Starting...
echo  ==============================
echo.
IF NOT EXIST "node_modules\" (
    echo  📦 Installing dependencies...
    call npm install
    echo.
)
echo  🚀 Starting development server...
echo  (Open http://localhost:5173 in your browser)
echo.
npx vite --open
pause