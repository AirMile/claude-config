#!/bin/bash
# Bundle size benchmark — meet kB van production build.
# Print één regel: SCORE=<float in kB>
set -euo pipefail

BUILD_CMD="${BUILD_CMD:-npm run build}"
DIST_DIR="${DIST_DIR:-dist}"

$BUILD_CMD >/dev/null 2>&1

if [ ! -d "$DIST_DIR" ]; then
  echo "SCORE=999999"
  exit 1
fi

# Som alle .js/.css groottes in kB (decimaal, 1000-based zoals tools tonen)
BYTES=$(find "$DIST_DIR" -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' \) -exec wc -c {} + | tail -1 | awk '{print $1}')
KB=$(awk "BEGIN { printf \"%.2f\", $BYTES / 1000 }")
echo "SCORE=$KB"
