#!/usr/bin/env bash
# ============================================================
#  Nirnside launcher (macOS / Linux)
#  Run this file. It updates itself from GitHub (git pull if this is a clone,
#  otherwise the latest main zip), installs anything new, starts Nirnside, and
#  opens your browser. Your data/ folder is never overwritten.
# ============================================================
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo
  echo "Node.js is required and was not found."
  echo "Install the LTS version from https://nodejs.org then run this again."
  echo "(That's the only extra program Nirnside needs.)"
  exit 1
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo
  echo "Node.js 20 or newer is required (you have $(node -v))."
  echo "Install the current LTS from https://nodejs.org then run this again."
  exit 1
fi

echo "Checking for updates..."
node scripts/self-update.mjs || true
if [ -f .nirnside-restart ]; then
  rm -f .nirnside-restart
  echo "Restarting with the new version..."
  exec "$0" "$@"
fi

echo "Installing / updating dependencies..."
npm install

echo "Copying Nirnside addons into your ESO AddOns folder..."
npx tsx scripts/install-addons.ts || true

URL="http://127.0.0.1:43219"
echo "Starting Nirnside... opening $URL"
( sleep 3; (open "$URL" >/dev/null 2>&1 || xdg-open "$URL" >/dev/null 2>&1 || true) ) &
npm run dev
