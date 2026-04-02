@echo off
:: ============================================================
:: BullRun — Fresh Start (Windows)
:: Double-click this file to wipe the database and start fresh.
:: All player accounts, trades, and progress will be deleted.
:: ============================================================

cd /d "%~dp0\.."
cls

echo.
echo   ========================================
echo            Bull  B U L L R U N  Bull
echo              !! FRESH START !!
echo   ========================================
echo.
echo   This will DELETE all data:
echo     - All player accounts
echo     - All trades and portfolios
echo     - All chat messages
echo     - All stock price history
echo.
set /p confirm="  Are you sure? (y/n): "

if /i not "%confirm%"=="y" (
    echo.
    echo   Cancelled. Nothing was deleted.
    echo.
    pause
    exit /b 0
)

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
    echo   Installing dependencies...
    echo.
    call npm install
    echo.
)

echo   Deleting old database...
if exist ".wrangler" rmdir /s /q ".wrangler"
echo   Old data deleted.
echo.

echo   Creating fresh database...
echo.
call npm run setup
echo.

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
