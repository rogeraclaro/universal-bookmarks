#!/bin/bash
set -e

PROXY_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_NAME="com.ailinks.universal-proxy"
PLIST_SRC="$PROXY_DIR/$PLIST_NAME.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
LOGS_DIR="$HOME/Library/Logs"

# Detect node binary path (handles Intel /usr/local/bin and Apple Silicon /opt/homebrew/bin)
NODE_BIN="$(which node)"
if [ -z "$NODE_BIN" ]; then
  echo "ERROR: node not found on PATH. Install Node.js first."
  exit 1
fi

echo "Using node at: $NODE_BIN"
echo "Proxy directory: $PROXY_DIR"
echo "Home directory: $HOME"

mkdir -p "$LOGS_DIR"

# Substitute placeholders with actual paths
sed \
  -e "s|__HOME__|$HOME|g" \
  -e "s|__PROXY_DIR__|$PROXY_DIR|g" \
  -e "s|__NODE_BIN__|$NODE_BIN|g" \
  "$PLIST_SRC" > "$PLIST_DEST"

echo "Plist written to: $PLIST_DEST"

# Unload existing agent if loaded (ignore errors — may not be loaded yet)
launchctl unload "$PLIST_DEST" 2>/dev/null || true

# Load the LaunchAgent
launchctl load "$PLIST_DEST"

echo "universal-bookmarks proxy LaunchAgent installed and started (port 3839)."
echo "Logs: $LOGS_DIR/universal-proxy.log"
echo "To check status: launchctl list | grep ailinks"
echo "To stop: launchctl unload $PLIST_DEST"
