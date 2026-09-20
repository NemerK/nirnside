@echo off
REM ============================================================
REM  Nirnside launcher (Windows)
REM  Double-click this file. It updates itself from GitHub (git pull if this
REM  is a clone, otherwise the latest main zip), installs anything new, starts
REM  Nirnside, and opens your browser. Your data/ folder is never overwritten.
REM ============================================================
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is required and was not found.
  echo Install the LTS version from https://nodejs.org then run this again.
  echo ^(That's the only extra program Nirnside needs.^)
  echo.
  start "" https://nodejs.org
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 20 (
  echo.
  echo Node.js 20 or newer is required.
  echo Install the current LTS from https://nodejs.org then run this again.
  echo.
  start "" https://nodejs.org
  pause
  exit /b 1
)

echo Checking for updates...
node scripts\self-update.mjs
if exist ".nirnside-restart" (
  del ".nirnside-restart"
  echo Restarting with the new version...
  start "" "%~f0"
  exit /b 0
)

echo Installing / updating dependencies...
call npm install
if errorlevel 1 ( echo npm install failed. & pause & exit /b 1 )

echo Starting Nirnside... a browser tab will open shortly.
start "" http://127.0.0.1:43219
call npm run dev
