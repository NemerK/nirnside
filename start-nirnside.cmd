@echo off
REM ============================================================
REM  Nirnside launcher (Windows)
REM  Double-click this file. If this folder is a git clone it
REM  auto-updates to the latest code, installs anything new,
REM  starts Nirnside, and opens it in your browser. Nirnside then
REM  finds your ESO install, installs its own addon, and loads your
REM  account automatically once you enable the addon and /reloadui.
REM ============================================================
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is required and was not found.
  echo Install the LTS version from https://nodejs.org then run this again.
  echo.
  pause
  exit /b 1
)

REM --- Auto-update: only if this folder was set up with git ---
if exist ".git" (
  where git >nul 2>nul
  if not errorlevel 1 (
    echo Checking for updates...
    git pull --ff-only
  )
)

echo Installing / updating dependencies...
call npm install
if errorlevel 1 ( echo npm install failed. & pause & exit /b 1 )

echo Starting Nirnside... a browser tab will open shortly.
start "" http://127.0.0.1:43219
call npm run dev
