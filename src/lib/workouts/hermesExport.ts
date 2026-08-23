import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { getWorkoutWeekDates } from "@/lib/workouts/dates";

type WorkoutPlan = Database["public"]["Tables"]["workout_plans"]["Row"];
type WorkoutDayPlan = Database["public"]["Tables"]["workout_day_plans"]["Row"];
type WorkoutBlock = Database["public"]["Tables"]["workout_blocks"]["Row"];
type WorkoutExercisePlan = Database["public"]["Tables"]["workout_exercise_plans"]["Row"];
type WorkoutSessionLog = Database["public"]["Tables"]["workout_session_logs"]["Row"];
type WorkoutExerciseLog = Database["public"]["Tables"]["workout_exercise_logs"]["Row"];
type WorkoutSetLog = Database["public"]["Tables"]["workout_sets"]["Row"];

export type WorkoutWeekHermesSummary = {
  exportedAt: string;
  userId: string;
  weekStartDate: string;
  weekEndDate: string;
  goalContext: unknown;
  plan: {
    id: string;
    name: string;
    version: number;
    status: string;
  };
  sessions: Array<{
    date: string;
    dayOfWeek: string;
    title: string;
    category: string;
    capText: string | null;
    status: string;
    durationMinutes: number | null;
    rpe: number | null;
    energy: number | null;
    painFlags: unknown;
    notes: string | null;
    blocks: Array<{
      title: string;
      blockType: string | null;
      notes: string | null;
      exercises: Array<{
        id: string;
        name: string;
        planned: {
          sets: string | null;
          reps: string | null;
          duration: string | null;
          rest: string | null;
          tempo: string | null;
          variation: string | null;
          notes: string | null;
        };
        actual: {
          status: string;
          exerciseType: string | null;
          plannedName: string | null;
          actualName: string | null;
          target: unknown;
          restTarget: string | null;
          changeReason: string | null;
          sets: string | null;
          reps: string | null;
          duration: string | null;
          load: string | null;
          variation: string | null;
          completedSetCount: number | null;
          setChecklist: unknown;
          notes: string | null;
        };
        setLogs: Array<{
          setIndex: number;
          variation: string | null;
          surface: string | null;
          reps: number | null;
          seconds: number | null;
          load: string | null;
          assistance: string | null;
          rangeOfMotion: string | null;
          cardioDurationMinutes: number | null;
          cardioDistance: string | null;
          intensity: string | null;
          rpe: number | null;
          rir: number | null;
          quality: string | null;
          skipped: boolean;
          changeReason: string | null;
          note: string | null;
        }>;
        difference: string | null;
      }>;
    }>;
  }>;
  observations: {
    skippedExercises: string[];
    partialExercises: string[];
    notedExercises: Array<{ exercise: string; note: string }>;
  };
};

export async function exportWorkoutWeekForHermes(
  userId: string,
  weekStartDate: string,
): Promise<WorkoutWeekHermesSummary> {
  const weekDates = getWorkoutWeekDates(weekStartDate);
  const weekEndDate = weekDates[weekDates.length - 1].date;

  const { data: plan, error: planError } = await supabaseAdmin
    .from("workout_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();
  if (planError) throw planError;

  const planRow = plan as WorkoutPlan;

  const { data: days, error: daysError } = await supabaseAdmin
    .from("workout_day_plans")
    .select("*")
    .eq("plan_id", planRow.id)
    .order("day_order", { ascending: true });
  if (daysError) throw daysError;

  const dayRows = (days ?? []) as WorkoutDayPlan[];
  const dayIds = dayRows.map((day) => day.id);

  const { data: blocks, error: blocksError } = await supabaseAdmin
    .from("workout_blocks")
    .select("*")
    .in("day_plan_id", dayIds)
    .order("display_order", { ascending: true });
  if (blocksError) throw blocksError;

  const blockRows = (blocks ?? []) as WorkoutBlock[];
  const blockIds = blockRows.map((block) => block.id);

  const { data: exercises, error: exercisesError } = await supabaseAdmin
    .from("workout_exercise_plans")
    .select("*")
    .in("block_id", blockIds)
    .order("display_order", { ascending: true });
  if (exercisesError) throw exercisesError;

  const exerciseRows = (exercises ?? []) as WorkoutExercisePlan[];

  const { data: sessions, error: sessionsError } = await supabaseAdmin
    .from("workout_session_logs")
    .select("*")
    .eq("user_id", userId)
    .gte("date", weekStartDate)
    .lte("date", weekEndDate)
    .order("date", { ascending: true });
  if (sessionsError) throw sessionsError;

  const sessionRows = (sessions ?? []) as WorkoutSessionLog[];
  const sessionIds = sessionRows.map((session) => session.id);

  let exerciseLogRows: WorkoutExerciseLog[] = [];
  let setRows: WorkoutSetLog[] = [];
  if (sessionIds.length) {
    const { data: exerciseLogs, error: exerciseLogsError } = await supabaseAdmin
      .from("workout_exercise_logs")
      .select("*")
      .in("session_log_id", sessionIds);
    if (exerciseLogsError) throw exerciseLogsError;
    exerciseLogRows = (exerciseLogs ?? []) as WorkoutExerciseLog[];
  }

  const exerciseLogIds = exerciseLogRows.map((log) => log.id);
  if (exerciseLogIds.length) {
    const { data: workoutSets, error: workoutSetsError } = await supabaseAdmin
      .from("workout_sets")
      .select("*")
      .in("session_exercise_log_id", exerciseLogIds)
      .order("set_index", { ascending: true });
    if (workoutSetsError) throw workoutSetsError;
    setRows = (workoutSets ?? []) as WorkoutSetLog[];
  }

  const sessionsForExport = weekDates.map(({ dayCode, date }) => {
    const day = dayRows.find((row) => row.day_of_week === dayCode);
    const sessionLog = day
      ? sessionRows.find((session) => session.date === date && session.day_plan_id === day.id)
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
        ? blockRows
            .filter((block) => block.day_plan_id === day.id)
            .map((block) => ({
              title: block.title,
              blockType: block.block_type,
              notes: block.notes,
              exercises: exerciseRows
                .filter((exercise) => exercise.block_id === block.id)
                .map((exercise) => {
                  const log = sessionLog
                    ? (exerciseLogRows.find(
                        (item) =>
                          item.session_log_id === sessionLog.id &&
                          item.exercise_plan_id === exercise.id,
                      ) ?? null)
                    : null;
                  const sets = log
                    ? setRows.filter((set) => set.session_exercise_log_id === log.id)
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
                    difference: buildExerciseDifference(exercise, log ?? null, sets, actualStatus),
                  };
                }),
            }))
        : [],
    };
  });

  const allExercises = sessionsForExport.flatMap((session) =>
    session.blocks.flatMap((block) => block.exercises),
  );

  return {
    exportedAt: new Date().toISOString(),
    userId,
    weekStartDate,
    weekEndDate,
    goalContext: planRow.goal_context,
    plan: {
      id: planRow.id,
      name: planRow.name,
      version: planRow.version,
      status: planRow.status,
    },
    sessions: sessionsForExport,
    observations: {
      skippedExercises: allExercises
        .filter((exercise) => exercise.actual.status === "skipped")
        .map((exercise) => exercise.name),
      partialExercises: allExercises
        .filter((exercise) => exercise.actual.status === "partial")
        .map((exercise) => exercise.name),
      notedExercises: allExercises
        .filter((exercise) => Boolean(exercise.actual.notes))
        .map((exercise) => ({ exercise: exercise.name, note: exercise.actual.notes ?? "" })),
    },
  };
}

export function formatWorkoutWeekForHermesMarkdown(summary: WorkoutWeekHermesSummary) {
  const lines = [
    `# Workout Week Review: ${summary.weekStartDate} to ${summary.weekEndDate}`,
    "",
    `Plan: ${summary.plan.name} v${summary.plan.version}`,
    "",
  ];

  for (const session of summary.sessions) {
    lines.push(`## ${session.dayOfWeek} ${session.date} - ${session.title}`);
    lines.push(`Status: ${session.status}`);
    if (session.notes) lines.push(`Notes: ${session.notes}`);

    for (const block of session.blocks) {
      lines.push("");
      lines.push(`### ${block.title}`);
      for (const exercise of block.exercises) {
        const actual = [
          exercise.actual.status,
          exercise.actual.sets ? `${exercise.actual.sets} sets` : null,
          exercise.actual.reps ? `${exercise.actual.reps} reps` : null,
          exercise.actual.duration ? `${exercise.actual.duration}` : null,
          exercise.actual.variation ? `variation: ${exercise.actual.variation}` : null,
        ]
          .filter(Boolean)
          .join(", ");
        lines.push(`- ${exercise.name}: ${actual || "not logged"}`);
        if (exercise.setLogs.length) {
          const sets = exercise.setLogs
            .map((set) =>
              [
                `set ${set.setIndex}`,
                set.variation,
                set.surface ?? set.assistance ?? set.load,
                set.seconds == null ? null : `${set.seconds}s`,
                set.reps == null ? null : `${set.reps} reps`,
                set.cardioDurationMinutes == null ? null : `${set.cardioDurationMinutes} min`,
                set.quality,
                set.changeReason,
              ]
                .filter(Boolean)
                .join(" / "),
            )
            .join("; ");
          lines.push(`  Sets: ${sets}`);
        }
        if (exercise.actual.notes) lines.push(`  Note: ${exercise.actual.notes}`);
      }
    }

    lines.push("");
  }

  return lines.join("\n");
}

function buildExerciseDifference(
  exercise: WorkoutExercisePlan,
  log: WorkoutExerciseLog | null,
  sets: WorkoutSetLog[] = [],
  actualStatus = log?.status ?? "not_started",
) {
  if (!log || actualStatus === "not_started") return null;
  if (actualStatus === "skipped") return "Skipped planned exercise.";
  if (actualStatus === "partial") return "Marked partial completion.";
  if (actualStatus === "substituted")
    return `Substituted with ${log.actual_name ?? "another exercise"}.`;
  if (sets.length && exercise.planned_sets) {
    return `Logged ${sets.filter((set) => !set.skipped).length} of planned ${exercise.planned_sets} sets.`;
  }
  if (log.completed_set_count != null && exercise.planned_sets) {
    return `Completed ${log.completed_set_count} of planned ${exercise.planned_sets} sets.`;
  }
  return null;
}

function effectiveExerciseStatus(
  log: WorkoutExerciseLog | null,
  sets: WorkoutSetLog[] = [],
  plannedSetsText: string | null = null,
) {
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

function firstNumber(value: string | null) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : null;
}
