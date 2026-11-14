#!/bin/sh
# Boss tool. Plays a whole game in headless Chrome and prints the result as JSON.
#   sh tools/smoke.sh                     the app with its current game
#   sh tools/smoke.sh game=sample         the built-in sample game
#   sh tools/smoke.sh page=soccer/index.html
cd "$(git rev-parse --show-toplevel)" || exit 1
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || { echo "Chrome not found"; exit 2; }
port=4190
python3 -m http.server $port --bind 127.0.0.1 >/dev/null 2>&1 & srv=$!
sleep 1
"$CHROME" --headless=new --disable-gpu --no-first-run --virtual-time-budget=90000 --dump-dom "http://127.0.0.1:$port/tools/smoke.html?$1&$2" 2>/dev/null | sed -n 's/.*<pre id="result">\(.*\)<\/pre>.*/\1/p' | sed 's/&quot;/"/g'
kill $srv 2>/dev/null
