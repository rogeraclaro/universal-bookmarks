#!/bin/bash
set -e
PROXY_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_SRC="$PROXY_DIR/com.ailinks.claude-proxy.plist"

if [ ! -f "$PLIST_SRC" ]; then
  echo "SKIP: plist template not yet created (run after Plan 02)"
  exit 0
fi

TMPFILE=$(mktemp /tmp/test-plist.XXXXXX)
NODE_BIN="$(which node)"
sed \
  -e "s|__HOME__|$HOME|g" \
  -e "s|__PROXY_DIR__|$PROXY_DIR|g" \
  -e "s|__NODE_BIN__|$NODE_BIN|g" \
  "$PLIST_SRC" > "$TMPFILE"

if grep -q "__HOME__\|__PROXY_DIR__\|__NODE_BIN__" "$TMPFILE"; then
  echo "FAIL: plist still contains placeholders"
  rm "$TMPFILE"
  exit 1
fi

if ! grep -q "$HOME" "$TMPFILE"; then
  echo "FAIL: plist does not contain actual HOME path"
  rm "$TMPFILE"
  exit 1
fi

rm "$TMPFILE"
echo "PASS: plist substitution correct"
