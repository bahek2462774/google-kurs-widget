#!/usr/bin/env bash
# Helper for visually self-checking the widget's real on-screen appearance
# (window chrome, always-on-top stacking, footer text contrast) -- things
# Playwright's DOM-only screenshots inside the Electron window cannot show.
#
# Usage: scripts/screencapture.sh out.png
set -euo pipefail
OUT="${1:-/tmp/gkw-screenshot.png}"
screencapture -x "$OUT"
echo "Saved screenshot to $OUT"
