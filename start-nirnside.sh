#!/usr/bin/env bash
# ============================================================
#  Nirnside launcher (macOS / Linux)
#  Run this file. If this folder is a git clone it auto-updates to
#  the latest code, installs anything new, starts Nirnside, and opens
#  it in your browser. Nirnside then finds your ESO install, installs
#  its own addon, and loads your account automatically once you
#  enable the addon and /reloadui.
# ============================================================
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo
  echo "Node.js is required and was not found."
  echo "Install the LTS version from https://nodejs.org then run this again."
  exit 1
fi

# Auto-update: only if this folder was set up with git.
if [ -d .git ] && command -v git >/dev/null 2>&1; then
  echo "Checking for updates..."
  git pull --ff-only || true
fi

echo "Installing / updating dependencies..."
npm install

URL="http://127.0.0.1:43219"
echo "Starting Nirnside... opening $URL"
( sleep 3; (open "$URL" >/dev/null 2>&1 || xdg-open "$URL" >/dev/null 2>&1 || true) ) &
npm run dev
