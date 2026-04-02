@echo off
:: ============================================================
:: BullRun — Host on Port 80 (Windows)
:: Right-click this file and select "Run as administrator"
:: to start the server on port 80.
:: This lets other devices on your network connect.
:: ============================================================

cd /d "%~dp0\.."
cls

:: Check for admin privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo   ========================================
    echo            Bull  B U L L R U N  Bull
    echo           Host on Port 80 (Network)
    echo   ========================================
    echo.
    echo   ERROR: This script needs admin privileges.
    echo   Right-click the file and select
    echo   "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo.
echo   ========================================
echo            Bull  B U L L R U N  Bull
echo           Host on Port 80 (Network)
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

:: Get local IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1"') do (
    set LOCAL_IP=%%a
    goto :found_ip
)
:found_ip
set LOCAL_IP=%LOCAL_IP: =%

echo   Starting BullRun on port 80...
echo.
echo   ----------------------------------------
echo.
echo     On this PC:
echo     http://localhost
echo.
echo     Other devices on your network:
echo     http://%LOCAL_IP%
echo.
echo     Press Ctrl+C to stop the server
echo.
echo   ----------------------------------------
echo.

call npx wrangler pages dev ./public --d1 DB --kv SESSION_STORE --port 80
pause
