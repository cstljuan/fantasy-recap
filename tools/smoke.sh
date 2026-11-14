#!/bin/sh
# Boss tool. Plays a whole game in headless Chrome and prints the result as JSON.
#   sh tools/smoke.sh                     the app with its current game
#   sh tools/smoke.sh game=sample         the built-in sample game
#   sh tools/smoke.sh page=soccer/index.html
cd "$(git rev-parse --show-toplevel)" || exit 1
CHROME=""
for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" "$(command -v google-chrome 2>/dev/null)" "$(command -v chromium 2>/dev/null)" "$(command -v chromium-browser 2>/dev/null)" "$(ls -d "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux*/chrome 2>/dev/null | tail -1)"; do
  [ -n "$c" ] && [ -x "$c" ] && { CHROME="$c"; break; }
done
[ -n "$CHROME" ] || { echo '{"ok":false,"error":"no Chrome or Chromium found on this machine"}'; exit 2; }
port=4190
python3 -m http.server $port --bind 127.0.0.1 >/dev/null 2>&1 & srv=$!
sleep 1
"$CHROME" --headless=new --no-sandbox --disable-gpu --no-first-run --virtual-time-budget=90000 --dump-dom "http://127.0.0.1:$port/tools/smoke.html?$1&$2" 2>/dev/null | sed -n 's/.*<pre id="result">\(.*\)<\/pre>.*/\1/p' | sed 's/&quot;/"/g'
kill $srv 2>/dev/null
