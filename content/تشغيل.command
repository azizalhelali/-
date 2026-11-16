#!/bin/bash
# انقر مرّتين لتشغيل استوديو المحتوى.
cd "$(dirname "$0")" || exit 1
PORT=8788
URL="http://localhost:$PORT/index.html"
echo "  استوديو المحتوى — $URL"
echo "  للإيقاف: أغلق النافذة أو Ctrl+C"
( sleep 1; open "$URL" ) &
python3 -m http.server "$PORT" --bind 127.0.0.1
