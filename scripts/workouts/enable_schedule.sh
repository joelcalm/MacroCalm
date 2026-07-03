#!/usr/bin/env bash
set -euo pipefail
MARKER_BEGIN='# BEGIN MACROCALM-WORKOUT-WEEKLY-REVIEW'
MARKER_END='# END MACROCALM-WORKOUT-WEEKLY-REVIEW'
CRON_FILE=/home/joel/workspace/MacroCalm/cron/macrocalm-workout-review.cron
TMP=$(mktemp)
( crontab -l 2>/dev/null || true ) | sed "/$MARKER_BEGIN/,/$MARKER_END/d" > "$TMP"
{
  cat "$TMP"
  printf '\n'
  cat "$CRON_FILE"
} | crontab -
rm -f "$TMP"
crontab -l | sed -n "/$MARKER_BEGIN/,/$MARKER_END/p"
