@echo off
REM WizardCards launcher — installs deps if needed, then starts the dev server
REM and opens the game in your default browser.
setlocal
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo [WizardCards] npm was not found on your PATH. Install Node.js from https://nodejs.org/ and try again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [WizardCards] Installing dependencies ^(first run^)...
  call npm install
  if errorlevel 1 (
    echo [WizardCards] npm install failed.
    pause
    exit /b 1
  )
)

echo [WizardCards] Starting dev server at http://localhost:5173/WizardCards/
start "" "http://localhost:5173/WizardCards/"
call npm run dev -- --port 5173 --strictPort

endlocal
