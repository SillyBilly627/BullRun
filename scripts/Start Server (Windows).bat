@echo off
:: ============================================================
:: BullRun — Start Server (Windows)
:: Double-click this file to start the game server.
:: ============================================================

cd /d "%~dp0\.."
cls

echo.
echo   ========================================
echo            Bull  B U L L R U N  Bull
echo         Stock Market Simulator
echo   ========================================
echo.

:: Check if node is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo   ERROR: Node.js is not installed.
    echo   Download it from https://nodejs.org (LTS version)
    echo.
    pause
    exit /b 1
)

:: Check if node_modules exists
if not exist "node_modules" (
    echo   First time setup — installing dependencies...
    echo.
    call npm install
    echo.
)

:: Check if database exists
if not exist ".wrangler" (
    echo   No database found — running first-time setup...
    echo.
    call npm run setup
    echo.
)

echo   Starting BullRun server...
echo.
echo   ----------------------------------------
echo.
echo     Open your browser and go to:
echo     http://localhost:8788
echo.
echo     Press Ctrl+C to stop the server
echo.
echo   ----------------------------------------
echo.

call npm run dev
pause
