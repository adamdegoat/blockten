#!/bin/bash
set -u
D="$(cd "$(dirname "$0")" && pwd)"
PR="/private/tmp/claude-502/-Users-ZY/00436175-4e20-4d5d-bab0-d9ce68228b15/scratchpad/bt-$$"
rm -f "$D/done.json"
lsof -nP -iTCP:8930 -sTCP:LISTEN -t 2>/dev/null | xargs -r kill -9 2>/dev/null; sleep 1
node "$D/server.cjs" & S=$!
sleep 1.5
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --user-data-dir="$PR" \
  --no-first-run --no-default-browser-check --disable-background-timer-throttling \
  --disable-backgrounding-occluded-windows --disable-renderer-backgrounding \
  --window-size=420,880 --window-position=0,0 --new-window "http://localhost:8930/?walk=1&touch=1${1:-}" >/dev/null 2>&1 &
for i in $(seq 1 100); do [ -f "$D/done.json" ] && break; sleep 1; done
sleep 1; pkill -f "user-data-dir=$PR" 2>/dev/null; kill -TERM $S 2>/dev/null; rm -rf "$PR" 2>/dev/null
[ -f "$D/done.json" ] && echo OK || echo TIMEOUT
