#!/bin/bash
# Lighthouse benchmark — meet performance score op een lokale dev/preview server.
# Print één regel: SCORE=<float, 0-100>
# Vereist: npx lighthouse, een draaiende server op $URL.
set -euo pipefail

URL="${URL:-http://localhost:4173}"
CATEGORY="${CATEGORY:-performance}"

# Build + preview-server in achtergrond opstarten als nog niet draaiend
if ! curl -sf "$URL" >/dev/null 2>&1; then
  npm run build >/dev/null 2>&1
  npx --yes serve -s dist -l 4173 >/dev/null 2>&1 &
  SERVE_PID=$!
  trap "kill $SERVE_PID 2>/dev/null || true" EXIT
  sleep 3
fi

OUT=$(mktemp)
npx --yes lighthouse "$URL" \
  --only-categories="$CATEGORY" \
  --output=json \
  --output-path="$OUT" \
  --chrome-flags="--headless --no-sandbox" \
  --quiet >/dev/null 2>&1

SCORE=$(node -e "const j=require('$OUT'); console.log((j.categories['$CATEGORY'].score*100).toFixed(1))")
rm -f "$OUT"
echo "SCORE=$SCORE"
