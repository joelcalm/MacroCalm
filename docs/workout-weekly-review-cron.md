# Weekly Workout Review Automation

MacroCalm stores workout plans and workout logs in Supabase. The VPS/Hermes side owns scheduling and weekly analysis.

## Storage choice

Best practice for this app:

- Supabase is the source of truth for workout plans, daily session logs, exercise logs, weekly reviews, and draft next-week plans.
- The VPS only stores generated JSON/Markdown artifacts and cron logs under ignored runtime directories.
- Real credentials live outside Git in `/home/joel/secrets/macrocalm.env`.

This keeps the mobile app and weekly automation reading the same data while avoiding Hermes-only hidden state.

## Required env file

Create `/home/joel/secrets/macrocalm.env` from `/home/joel/secrets/macrocalm.env.example`:

```env
SUPABASE_URL=https://hbiqysgtfhiemwgdltcv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
MACROCALM_USER_ID=...
MACROCALM_WORKOUT_OUTPUT_DIR=/home/joel/workspace/MacroCalm/data/workout-reviews
```

`SUPABASE_SERVICE_ROLE_KEY` is for trusted server-side cron only. Never expose it in frontend env or commit it.

## Database migration

Apply:

```bash
supabase db push
```

or run:

```text
supabase/migrations/20260703100000_add_workout_weekly_reviews.sql
```

The new `workout_weekly_reviews` table stores the generated weekly analysis, Markdown review, draft-plan JSON, and optional `draft_plan_id`.

## Manual run

```bash
cd /home/joel/workspace/MacroCalm
scripts/workouts/run_weekly_review.sh --week-start 2026-07-06
```

The script analyzes the selected week, writes local artifacts, stores a Supabase review row, and creates a `draft` workout plan for the next week.

Dry run without DB writes:

```bash
node scripts/workouts/run-weekly-review.mjs --week-start 2026-07-06 --dry-run
```

## Schedule

Template:

```text
cron/macrocalm-workout-review.cron
```

Install for user `joel`:

```bash
cd /home/joel/workspace/MacroCalm
scripts/workouts/enable_schedule.sh
```

Active schedule:

```cron
CRON_TZ=Europe/Madrid
30 6 * * 1 cd /home/joel/workspace/MacroCalm && /home/joel/workspace/MacroCalm/scripts/workouts/run_weekly_review.sh
```

It runs every Monday at 06:30 Madrid time and reviews the previous Monday-Sunday training week.

## Analyzer behavior

The analyzer is deterministic and conservative:

- Detects completed/partial/skipped sessions and exercises.
- Tracks planche/90-degree, front lever/pulling, cardio, and legs focus areas.
- Flags low logging, skipped sessions, low completion, pain/fatigue notes, and under-completed goal work.
- Suggests one-week adjustments: progress only one variable when compliance is high, or cut low-priority accessory volume when completion/fatigue is poor.
- Creates a Supabase `draft` workout plan, not an active plan. Manual review/activation can be added in the app UI later.

## Outputs

Runtime files are ignored by Git:

```text
data/workout-reviews/*.json
data/workout-reviews/*.md
logs/workout-weekly-review.log
```
