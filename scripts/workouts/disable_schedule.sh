#!/usr/bin/env bash
set -euo pipefail
MARKER_BEGIN='# BEGIN MACROCALM-WORKOUT-WEEKLY-REVIEW'
MARKER_END='# END MACROCALM-WORKOUT-WEEKLY-REVIEW'
TMP=$(mktemp)
( crontab -l 2>/dev/null || true ) | sed "/$MARKER_BEGIN/,/$MARKER_END/d" > "$TMP"
crontab "$TMP"
rm -f "$TMP"
