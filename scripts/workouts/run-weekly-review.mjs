#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { analyzeWorkoutWeek, formatWorkoutReviewMarkdown } from "./analyze-week.mjs";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const DEFAULT_ENV = "/home/joel/secrets/macrocalm.env";

main().catch((error) => {
  console.error(redact(String(error?.stack || error?.message || error)));
  process.exitCode = 1;
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  loadEnv(args.env || DEFAULT_ENV);

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const userId = args.userId || requiredEnv("MACROCALM_USER_ID");
  const weekStartDate = args.weekStart || previousMadridWeekStart();
  const outputDir =
    args.outputDir ||
    process.env.MACROCALM_WORKOUT_OUTPUT_DIR ||
    path.join(PROJECT_ROOT, "data/workout-reviews");
  const createDraft = Boolean(args.createDraft);
  const dryRun = Boolean(args.dryRun);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const exportBundle = await exportWorkoutWeek(supabase, userId, weekStartDate);
  const review = analyzeWorkoutWeek(exportBundle.summary);
  const markdown = formatWorkoutReviewMarkdown(review);

  fs.mkdirSync(outputDir, { recursive: true });
  const baseName = weekStartDate;
  const jsonPath = path.join(outputDir, `${baseName}.json`);
  const mdPath = path.join(outputDir, `${baseName}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify(review, null, 2));
  fs.writeFileSync(mdPath, markdown + "\n");

  let draftPlanId = null;
  if (createDraft && !dryRun) {
    draftPlanId = await createDraftWorkoutPlan(supabase, exportBundle.raw, review);
  }

  if (!dryRun) {
    await upsertWeeklyReview(supabase, {
      userId,
      weekStartDate: review.weekStartDate,
      weekEndDate: review.weekEndDate,
      sourcePlanId: review.sourcePlan.id,
      draftPlanId,
      review,
      markdown,
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun,
        userId: "[REDACTED]",
        weekStartDate,
        weekEndDate: review.weekEndDate,
        sourcePlanId: review.sourcePlan.id,
        draftPlanId,
        sessionsLogged: review.completion.sessionsLogged,
        exerciseCompletionRate: review.completion.exerciseCompletionRate,
        recommendations: review.recommendations.length,
        jsonPath,
        mdPath,
      },
      null,
      2,
    ),
  );
}

async function exportWorkoutWeek(supabase, userId, weekStartDate) {
  const weekDates = getWorkoutWeekDates(weekStartDate);
  const weekEndDate = weekDates.at(-1).date;

  const plan = await single(
    supabase
      .from("workout_plans")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .single(),
    "active workout plan",
  );
  const days = await list(
    supabase
      .from("workout_day_plans")
      .select("*")
      .eq("plan_id", plan.id)
      .order("day_order", { ascending: true }),
    "workout day plans",
  );
  const dayIds = days.map((d) => d.id);
  const blocks = dayIds.length
    ? await list(
        supabase
          .from("workout_blocks")
          .select("*")
          .in("day_plan_id", dayIds)
          .order("display_order", { ascending: true }),
        "workout blocks",
      )
    : [];
  const blockIds = blocks.map((b) => b.id);
  const exercises = blockIds.length
    ? await list(
        supabase
          .from("workout_exercise_plans")
          .select("*")
          .in("block_id", blockIds)
          .order("display_order", { ascending: true }),
        "workout exercise plans",
      )
    : [];
  const sessions = await list(
    supabase
      .from("workout_session_logs")
      .select("*")
      .eq("user_id", userId)
      .gte("date", weekStartDate)
      .lte("date", weekEndDate)
      .order("date", { ascending: true }),
    "workout session logs",
  );
  const sessionIds = sessions.map((s) => s.id);
  const exerciseLogs = sessionIds.length
    ? await list(
        supabase.from("workout_exercise_logs").select("*").in("session_log_id", sessionIds),
        "workout exercise logs",
      )
    : [];
  const exerciseLogIds = exerciseLogs.map((log) => log.id);
  const workoutSets = exerciseLogIds.length
    ? await list(
        supabase
          .from("workout_sets")
          .select("*")
          .in("session_exercise_log_id", exerciseLogIds)
          .order("set_index", { ascending: true }),
        "workout sets",
      )
    : [];

  const summarySessions = weekDates.map(({ dayCode, date }) => {
    const day = days.find((d) => d.day_of_week === dayCode);
    const sessionLog = day
      ? sessions.find((s) => s.date === date && s.day_plan_id === day.id)
      : null;
    return {
      date,
      dayOfWeek: dayCode,
      title: day?.title ?? "No planned session",
      category: day?.category ?? "rest",
      capText: day?.cap_text ?? null,
      status: sessionLog?.status ?? "not_started",
      durationMinutes: sessionLog?.duration_minutes ?? null,
      rpe: sessionLog?.rpe == null ? null : Number(sessionLog.rpe),
      energy: sessionLog?.energy ?? null,
      painFlags: sessionLog?.pain_flags ?? {},
      notes: sessionLog?.notes ?? null,
      blocks: day
        ? blocks
            .filter((b) => b.day_plan_id === day.id)
            .map((block) => ({
              title: block.title,
              blockType: block.block_type,
              notes: block.notes,
              exercises: exercises
                .filter((ex) => ex.block_id === block.id)
                .map((exercise) => {
                  const log = sessionLog
                    ? exerciseLogs.find(
                        (item) =>
                          item.session_log_id === sessionLog.id &&
                          item.exercise_plan_id === exercise.id,
                      )
                    : null;
                  const sets = log
                    ? workoutSets.filter((set) => set.session_exercise_log_id === log.id)
                    : [];
                  const actualStatus = effectiveExerciseStatus(log, sets, exercise.planned_sets);
                  return {
                    id: exercise.id,
                    name: exercise.name,
                    planned: {
                      sets: exercise.planned_sets,
                      reps: exercise.planned_reps,
                      duration: exercise.planned_duration,
                      rest: exercise.planned_rest,
                      tempo: exercise.planned_tempo,
                      variation: exercise.planned_variation,
                      notes: exercise.notes,
                    },
                    actual: {
                      status: actualStatus,
                      exerciseType: log?.exercise_type ?? null,
                      plannedName: log?.planned_name ?? null,
                      actualName: log?.actual_name ?? null,
                      target: log?.target ?? {},
                      restTarget: log?.rest_target ?? null,
                      changeReason: log?.change_reason ?? null,
                      sets: log?.actual_sets ?? null,
                      reps: log?.actual_reps ?? null,
                      duration: log?.actual_duration ?? null,
                      load: log?.actual_load ?? null,
                      variation: log?.actual_variation ?? null,
                      completedSetCount: log?.completed_set_count ?? null,
                      setChecklist: log?.set_checklist ?? [],
                      notes: log?.notes ?? null,
                    },
                    setLogs: sets.map((set) => ({
                      setIndex: set.set_index,
                      variation: set.variation,
                      surface: set.surface,
                      reps: set.reps == null ? null : Number(set.reps),
                      seconds: set.seconds == null ? null : Number(set.seconds),
                      load: set.load,
                      assistance: set.assistance,
                      rangeOfMotion: set.range_of_motion,
                      cardioDurationMinutes:
                        set.cardio_duration_minutes == null
                          ? null
                          : Number(set.cardio_duration_minutes),
                      cardioDistance: set.cardio_distance,
                      intensity: set.intensity,
                      rpe: set.rpe == null ? null : Number(set.rpe),
                      rir: set.rir == null ? null : Number(set.rir),
                      quality: set.quality,
                      skipped: set.skipped,
                      changeReason: set.change_reason,
                      note: set.note,
                    })),
                  };
                }),
            }))
        : [],
    };
  });

  return {
    summary: {
      exportedAt: new Date().toISOString(),
      userId,
      weekStartDate,
      weekEndDate,
      goalContext: plan.goal_context,
      plan: { id: plan.id, name: plan.name, version: plan.version, status: plan.status },
      sessions: summarySessions,
      observations: {},
    },
    raw: { plan, days, blocks, exercises },
  };
}

function effectiveExerciseStatus(log, sets = [], plannedSetsText = null) {
  if (!log) return "not_started";
  if (["completed", "partial", "skipped", "substituted"].includes(log.status)) return log.status;

  const completedSets = sets.filter((set) => !set.skipped).length;
  const completedSetCount = log.completed_set_count ?? completedSets;
  if (completedSetCount > 0) {
    const plannedSets = firstNumber(plannedSetsText);
    if (plannedSets && completedSetCount < plannedSets) return "partial";
    return "completed";
  }

  if (sets.some((set) => set.skipped)) return "skipped";
  if (log.notes || log.actual_name !== log.planned_name) return "partial";
  return log.status ?? "not_started";
}

function firstNumber(value) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

async function createDraftWorkoutPlan(supabase, raw, review) {
  const source = raw.plan;
  const draftSeedKey = `weekly-review-${review.weekStartDate}`;
  const version = Number(source.version || 1) + 1;

  const { data: existingDraft, error: existingDraftError } = await supabase
    .from("workout_plans")
    .select("id")
    .eq("user_id", source.user_id)
    .eq("seed_key", draftSeedKey)
    .eq("version", version)
    .maybeSingle();
  if (existingDraftError) throw new Error(`draft lookup failed: ${existingDraftError.message}`);
  if (existingDraft?.id) return existingDraft.id;

  await supabase
    .from("workout_plans")
    .update({ status: "archived" })
    .eq("user_id", source.user_id)
    .eq("status", "draft")
    .like("seed_key", "weekly-review-%");

  const draft = await single(
    supabase
      .from("workout_plans")
      .insert({
        user_id: source.user_id,
        seed_key: draftSeedKey,
        name: review.draftPlan.name,
        version,
        status: "draft",
        week_start_date: review.draftPlan.targetWeekStartDate,
        goal_context: {
          ...(source.goal_context ?? {}),
          weeklyReview: {
            sourcePlanId: source.id,
            sourceWeekStartDate: review.weekStartDate,
            recommendations: review.recommendations,
          },
        },
      })
      .select("*")
      .single(),
    "draft workout plan insert",
  );

  for (const day of raw.days) {
    const notes = [
      day.notes,
      ...(review.draftPlan.days.find((d) => d.dayOfWeek === day.day_of_week)?.adjustmentNotes ??
        []),
    ]
      .filter(Boolean)
      .join("\n\nWeekly adjustment: ");
    const draftDay = await single(
      supabase
        .from("workout_day_plans")
        .insert({
          plan_id: draft.id,
          seed_key: day.seed_key,
          day_of_week: day.day_of_week,
          day_order: day.day_order,
          title: day.title,
          category: day.category,
          cap_text: day.cap_text,
          notes: notes || null,
        })
        .select("*")
        .single(),
      `draft day insert ${day.day_of_week}`,
    );

    for (const block of raw.blocks.filter((b) => b.day_plan_id === day.id)) {
      const draftBlock = await single(
        supabase
          .from("workout_blocks")
          .insert({
            day_plan_id: draftDay.id,
            seed_key: block.seed_key,
            title: block.title,
            block_type: block.block_type,
            display_order: block.display_order,
            notes: block.notes,
          })
          .select("*")
          .single(),
        `draft block insert ${block.title}`,
      );

      const blockExercises = raw.exercises.filter((ex) => ex.block_id === block.id);
      if (blockExercises.length) {
        const { error } = await supabase.from("workout_exercise_plans").insert(
          blockExercises.map((exercise) => ({
            block_id: draftBlock.id,
            seed_key: exercise.seed_key,
            display_order: exercise.display_order,
            name: exercise.name,
            planned_sets: exercise.planned_sets,
            planned_reps: exercise.planned_reps,
            planned_duration: exercise.planned_duration,
            planned_rest: exercise.planned_rest,
            planned_tempo: exercise.planned_tempo,
            planned_variation: exercise.planned_variation,
            notes: exercise.notes,
          })),
        );
        if (error) throw new Error(`draft exercise insert failed: ${error.message}`);
      }
    }
  }
  return draft.id;
}

async function upsertWeeklyReview(supabase, row) {
  const { error } = await supabase.from("workout_weekly_reviews").upsert(
    {
      user_id: row.userId,
      week_start_date: row.weekStartDate,
      week_end_date: row.weekEndDate,
      source_plan_id: row.sourcePlanId,
      draft_plan_id: row.draftPlanId,
      summary_json: row.review,
      review_markdown: row.markdown,
      draft_plan_json: row.review.draftPlan,
      status: row.draftPlanId ? "draft_created" : "generated",
    },
    { onConflict: "user_id,week_start_date" },
  );
  if (error) {
    const msg = error.message || String(error);
    if (msg.includes("schema cache") || msg.includes("workout_weekly_reviews")) {
      console.warn(
        "warning: workout_weekly_reviews table is not writable yet; draft plan and local artifacts were still generated.",
      );
      return;
    }
    throw new Error(`weekly review upsert failed: ${msg}`);
  }
}

async function single(query, label) {
  const { data, error } = await query;
  if (error) throw new Error(`${label} failed: ${error.message}`);
  if (!data) throw new Error(`${label} returned no data`);
  return data;
}

async function list(query, label) {
  const { data, error } = await query;
  if (error) throw new Error(`${label} failed: ${error.message}`);
  return data ?? [];
}

function getWorkoutWeekDates(weekStartDate) {
  const start = new Date(`${weekStartDate}T00:00:00Z`);
  const dayCodes = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  return dayCodes.map((dayCode, index) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + index);
    return { dayCode, date: d.toISOString().slice(0, 10) };
  });
}

function previousMadridWeekStart() {
  const madridNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
  const day = madridNow.getDay();
  const daysSinceMonday = (day + 6) % 7;
  madridNow.setDate(madridNow.getDate() - daysSinceMonday - 7);
  return madridNow.toISOString().slice(0, 10);
}

function loadEnv(file) {
  if (!file || !fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    )
      value = value.slice(1, -1);
    process.env[key] = value;
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--create-draft-plan") args.createDraft = true;
    else if (arg === "--week-start") args.weekStart = argv[++i];
    else if (arg === "--user-id") args.userId = argv[++i];
    else if (arg === "--env") args.env = argv[++i];
    else if (arg === "--output-dir") args.outputDir = argv[++i];
    else if (arg === "--help") {
      console.log(
        "Usage: node scripts/workouts/run-weekly-review.mjs [--week-start YYYY-MM-DD] [--dry-run] [--create-draft-plan]",
      );
      process.exit(0);
    }
  }
  return args;
}

function redact(text) {
  for (const key of [
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
  ]) {
    if (process.env[key]) text = text.replaceAll(process.env[key], "[REDACTED]");
  }
  return text;
}
