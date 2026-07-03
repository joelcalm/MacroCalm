#!/usr/bin/env bash
set -euo pipefail
cd /home/joel/workspace/MacroCalm
ENV_FILE=${MACROCALM_ENV_FILE:-/home/joel/secrets/macrocalm.env}
LOG_DIR=${MACROCALM_LOG_DIR:-/home/joel/workspace/MacroCalm/logs}
mkdir -p "$LOG_DIR"
node scripts/workouts/run-weekly-review.mjs --env "$ENV_FILE" --create-draft-plan "$@" >> "$LOG_DIR/workout-weekly-review.log" 2>&1
