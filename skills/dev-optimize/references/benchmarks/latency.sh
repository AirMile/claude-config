#!/bin/bash
# API latency benchmark — p95 ms via wrk tegen lokale server.
# Print één regel: SCORE=<float in ms>
# Vereist: wrk in PATH, server draaiend op $URL.
set -euo pipefail

URL="${URL:-http://localhost:3000/api/health}"
DURATION="${DURATION:-10}"
CONNECTIONS="${CONNECTIONS:-50}"

if ! command -v wrk >/dev/null 2>&1; then
  echo "wrk niet geïnstalleerd. Installeer via brew install wrk / apt install wrk." >&2
  echo "SCORE=999999"
  exit 1
fi

if ! curl -sf "$URL" >/dev/null 2>&1; then
  echo "Server niet bereikbaar op $URL — start server eerst." >&2
  echo "SCORE=999999"
  exit 1
fi

# wrk percentile output staat in --latency mode (zonder lua script).
OUT=$(wrk -t4 -c"$CONNECTIONS" -d"${DURATION}s" --latency "$URL" 2>&1)
P95=$(echo "$OUT" | awk '/^ *95%/ {print $2}' | sed 's/ms//; s/s$/000/')
[ -z "$P95" ] && P95=999999
echo "SCORE=$P95"
