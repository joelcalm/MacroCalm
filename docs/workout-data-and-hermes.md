# Workout Data And Hermes Export

Workout plans and completion logs live in Supabase.

- `workout_plans` stores per-user plan metadata, version, status, week start, and goal context.
- `workout_day_plans`, `workout_blocks`, and `workout_exercise_plans` store the immutable planned routine.
- `workout_session_logs` stores what happened on a date for a planned day, including optional duration, session RPE, energy, pain/tightness flags, and session notes.
- `workout_exercise_logs` stores the planned exercise snapshot, actual exercise name, inferred exercise type, target/rest snapshot, derived status, change reason, compatibility summary fields, and notes.
- `workout_sets` stores the actual set-by-set work: reps, seconds, load, variation, surface, assistance, range of motion, cardio duration/distance/intensity, RPE/RIR, quality, skipped flag, reason, and note.

The planned workout remains the template. Actual work is saved separately under exercise logs and set logs. Compatibility fields on `workout_exercise_logs` are still populated from set rows so older exports and weekly review logic can continue to read aggregate summaries.

The app seeds the current active plan from `src/lib/workouts/currentPlanSeed.ts` the first time a user opens Workout without an active plan. The human-readable reference plan is `docs/workout-plan-current.md`.

Hermes should use `exportWorkoutWeekForHermes(userId, weekStartDate)` from `src/lib/workouts/hermesExport.ts` to build weekly review context. The function returns JSON with the active plan, all planned sessions, actual logs, nested set logs, skipped/partial/modified work, pain flags, and user notes.

Scheduling is intentionally not implemented in MacroCalm. Hermes owns cron/scheduling and can later create a draft next-week plan by inserting a new `workout_plans` row with `status = 'draft'`; user review/activation can be added on top of the existing `active | draft | archived` plan status model.
