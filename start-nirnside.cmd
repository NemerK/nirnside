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
  echo Visual Studio, Python, and C++ build tools are not required.
  echo.
  start "" https://nodejs.org
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 22 (
  echo.
  echo Node.js 22 or newer is required ^(you have v%NODE_MAJOR%^).
  echo Install the current LTS from https://nodejs.org then run this again.
  echo Visual Studio is not required.
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
REM better-sqlite3 already ships a Windows binary. --ignore-scripts stops npm
REM from compiling it with Visual Studio / node-gyp, which fails on most PCs.
set npm_config_build_from_source=false
call npm install --ignore-scripts --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo npm install failed.
  echo Nirnside does not need Visual Studio, Python, or C++ build tools.
  echo If the text above mentions node-gyp, MSBuild, or better-sqlite3,
  echo delete the node_modules folder in this directory and run this again.
  echo Otherwise install Node.js LTS from https://nodejs.org and try again.
  echo.
  pause
  exit /b 1
)

node scripts\check-sqlite.mjs
if errorlevel 1 (
  echo.
  echo Visual Studio is not required. Install Node.js LTS from https://nodejs.org
  echo ^(green LTS button^), delete the node_modules folder, and run this again.
  echo.
  pause
  exit /b 1
)

echo Copying Nirnside addons into your ESO AddOns folder...
call npx tsx scripts/install-addons.ts
echo.

echo Starting Nirnside... a browser tab will open shortly.
start "" http://127.0.0.1:43219
call npm run dev
