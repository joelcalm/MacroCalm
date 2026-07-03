import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { CURRENT_WORKOUT_PLAN_SEED } from "@/lib/workouts/currentPlanSeed";
import {
  getWorkoutWeekDates,
  getWorkoutWeekStart,
  todayMadridDateValue,
} from "@/lib/workouts/dates";

export type WorkoutPlan = Database["public"]["Tables"]["workout_plans"]["Row"];
export type WorkoutDayPlan = Database["public"]["Tables"]["workout_day_plans"]["Row"];
export type WorkoutBlock = Database["public"]["Tables"]["workout_blocks"]["Row"];
export type WorkoutExercisePlan = Database["public"]["Tables"]["workout_exercise_plans"]["Row"];
export type WorkoutSessionLog = Database["public"]["Tables"]["workout_session_logs"]["Row"];
export type WorkoutExerciseLog = Database["public"]["Tables"]["workout_exercise_logs"]["Row"];
export type WorkoutSetLog = Database["public"]["Tables"]["workout_sets"]["Row"];

export type WorkoutSessionStatus = WorkoutSessionLog["status"];
export type WorkoutExerciseStatus = WorkoutExerciseLog["status"];
export type WorkoutExerciseType = NonNullable<WorkoutExerciseLog["exercise_type"]>;
export type WorkoutChangeReason = NonNullable<WorkoutExerciseLog["change_reason"]>;
export type WorkoutSetQuality = NonNullable<WorkoutSetLog["quality"]>;

export type WorkoutExerciseLogWithSets = WorkoutExerciseLog & {
  sets: WorkoutSetLog[];
};

export type WorkoutExercisePlanWithLog = WorkoutExercisePlan & {
  log: WorkoutExerciseLogWithSets | null;
};

export type WorkoutBlockWithExercises = WorkoutBlock & {
  exercises: WorkoutExercisePlanWithLog[];
};

export type WorkoutDayPlanWithBlocks = WorkoutDayPlan & {
  blocks: WorkoutBlockWithExercises[];
};

export type WorkoutPlanWithDays = WorkoutPlan & {
  days: WorkoutDayPlanWithBlocks[];
};

export type WorkoutSessionLogWithExercises = WorkoutSessionLog & {
  exercise_logs: WorkoutExerciseLogWithSets[];
};

export type WorkoutWeekData = {
  plan: WorkoutPlanWithDays;
  weekStartDate: string;
  weekDates: { dayCode: string; date: string }[];
  sessionLogs: WorkoutSessionLogWithExercises[];
};

export type WorkoutTarget = {
  sets: string | null;
  reps: string | null;
  duration: string | null;
  rest: string | null;
  tempo: string | null;
  variation: string | null;
};

export type SaveWorkoutSetInput = {
  setIndex: number;
  plannedTarget?: Json;
  variation?: string | null;
  surface?: string | null;
  reps?: number | null;
  seconds?: number | null;
  load?: string | null;
  assistance?: string | null;
  rangeOfMotion?: string | null;
  cardioDurationMinutes?: number | null;
  cardioDistance?: string | null;
  intensity?: string | null;
  rpe?: number | null;
  rir?: number | null;
  quality?: WorkoutSetQuality | null;
  skipped?: boolean;
  changeReason?: WorkoutChangeReason | null;
  note?: string | null;
};

export type SaveWorkoutExerciseLogInput = {
  exercisePlanId: string;
  plannedName: string;
  actualName?: string | null;
  orderIndex: number;
  exerciseType: WorkoutExerciseType;
  target: WorkoutTarget;
  restTarget?: string | null;
  status: WorkoutExerciseStatus;
  changeReason?: WorkoutChangeReason | null;
  notes?: string | null;
  sets: SaveWorkoutSetInput[];
};

export type SaveWorkoutSessionInput = {
  date: string;
  planId: string;
  dayPlanId: string;
  status: WorkoutSessionStatus;
  durationMinutes?: number | null;
  startedAt?: string | null;
  endedAt?: string | null;
  rpe?: number | null;
  energy?: number | null;
  painFlags?: Json;
  notes?: string | null;
  exerciseLogs: SaveWorkoutExerciseLogInput[];
};

type CompatibilitySummary = {
  actualSets: string | null;
  actualReps: string | null;
  actualDuration: string | null;
  actualLoad: string | null;
  actualVariation: string | null;
  completedSetCount: number | null;
  setChecklist: boolean[];
};

export async function getWorkoutWeekData(date = todayMadridDateValue()): Promise<WorkoutWeekData> {
  const plan = await ensureCurrentWorkoutPlan();
  const weekStartDate = getWorkoutWeekStart(date);
  const weekDates = getWorkoutWeekDates(weekStartDate);
  const weekEndDate = weekDates[weekDates.length - 1].date;

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Not signed in");

  const { data: sessions, error: sessionsError } = await supabase
    .from("workout_session_logs")
    .select("*")
    .eq("user_id", userData.user.id)
    .gte("date", weekStartDate)
    .lte("date", weekEndDate)
    .order("date", { ascending: true });

  if (sessionsError) throw sessionsError;

  const sessionRows = (sessions ?? []) as WorkoutSessionLog[];
  const sessionIds = sessionRows.map((session) => session.id);
  let exerciseLogs: WorkoutExerciseLog[] = [];
  let setRows: WorkoutSetLog[] = [];

  if (sessionIds.length) {
    const { data, error } = await supabase
      .from("workout_exercise_logs")
      .select("*")
      .in("session_log_id", sessionIds)
      .order("order_index", { ascending: true });
    if (error) throw error;
    exerciseLogs = (data ?? []) as WorkoutExerciseLog[];
  }

  const exerciseLogIds = exerciseLogs.map((log) => log.id);
  if (exerciseLogIds.length) {
    const { data, error } = await supabase
      .from("workout_sets")
      .select("*")
      .in("session_exercise_log_id", exerciseLogIds)
      .order("set_index", { ascending: true });
    if (error) throw error;
    setRows = (data ?? []) as WorkoutSetLog[];
  }

  const exerciseLogsWithSets = exerciseLogs.map((log) => ({
    ...log,
    sets: setRows.filter((set) => set.session_exercise_log_id === log.id),
  }));

  return {
    plan: attachLogsToPlan(plan, sessionRows, exerciseLogsWithSets),
    weekStartDate,
    weekDates,
    sessionLogs: sessionRows.map((session) => ({
      ...session,
      exercise_logs: exerciseLogsWithSets.filter((log) => log.session_log_id === session.id),
    })),
  };
}

export async function saveWorkoutSession(input: SaveWorkoutSessionInput) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Not signed in");

  const { data: session, error: sessionError } = await supabase
    .from("workout_session_logs")
    .upsert(
      {
        user_id: userData.user.id,
        date: input.date,
        plan_id: input.planId,
        day_plan_id: input.dayPlanId,
        status: input.status,
        duration_minutes: input.durationMinutes ?? null,
        started_at: input.startedAt ?? null,
        ended_at: input.endedAt ?? null,
        rpe: input.rpe ?? null,
        energy: input.energy ?? null,
        pain_flags: input.painFlags ?? {},
        notes: emptyToNull(input.notes),
      },
      { onConflict: "user_id,date,day_plan_id" },
    )
    .select("*")
    .single();

  if (sessionError) throw sessionError;

  const exerciseRows = input.exerciseLogs.map((log) => {
    const summary = buildCompatibilitySummary(log.sets);
    const actualName = emptyToNull(log.actualName) ?? log.plannedName;

    return {
      session_log_id: session.id,
      exercise_plan_id: log.exercisePlanId,
      status: log.status,
      planned_name: log.plannedName,
      actual_name: actualName,
      order_index: log.orderIndex,
      exercise_type: log.exerciseType,
      target: log.target as Json,
      rest_target: emptyToNull(log.restTarget),
      change_reason: log.changeReason ?? null,
      actual_sets: summary.actualSets,
      actual_reps: summary.actualReps,
      actual_duration: summary.actualDuration,
      actual_load: summary.actualLoad,
      actual_variation: summary.actualVariation,
      completed_set_count: summary.completedSetCount,
      set_checklist: summary.setChecklist as Json,
      notes: emptyToNull(log.notes),
    };
  });

  if (!exerciseRows.length) return session as WorkoutSessionLog;

  const { data: savedExerciseLogs, error: exerciseError } = await supabase
    .from("workout_exercise_logs")
    .upsert(exerciseRows, { onConflict: "session_log_id,exercise_plan_id" })
    .select("*");
  if (exerciseError) throw exerciseError;

  const savedLogs = (savedExerciseLogs ?? []) as WorkoutExerciseLog[];
  const savedByPlanId = new Map(savedLogs.map((log) => [log.exercise_plan_id, log]));
  const savedLogIds = savedLogs.map((log) => log.id);

  if (savedLogIds.length) {
    const { error } = await supabase
      .from("workout_sets")
      .delete()
      .in("session_exercise_log_id", savedLogIds);
    if (error) throw error;
  }

  const setRows = input.exerciseLogs.flatMap((exercise) => {
    const saved = savedByPlanId.get(exercise.exercisePlanId);
    if (!saved) return [];
    return exercise.sets.map((set, index) => ({
      session_exercise_log_id: saved.id,
      set_index: set.setIndex || index + 1,
      planned_target: (set.plannedTarget ?? exercise.target) as Json,
      variation: emptyToNull(set.variation),
      surface: emptyToNull(set.surface),
      reps: set.reps ?? null,
      seconds: set.seconds ?? null,
      load: emptyToNull(set.load),
      assistance: emptyToNull(set.assistance),
      range_of_motion: emptyToNull(set.rangeOfMotion),
      cardio_duration_minutes: set.cardioDurationMinutes ?? null,
      cardio_distance: emptyToNull(set.cardioDistance),
      intensity: emptyToNull(set.intensity),
      rpe: set.rpe ?? null,
      rir: set.rir ?? null,
      quality: set.quality ?? null,
      skipped: set.skipped ?? false,
      change_reason: set.changeReason ?? null,
      note: emptyToNull(set.note),
    }));
  });

  if (setRows.length) {
    const { error } = await supabase.from("workout_sets").insert(setRows);
    if (error) throw error;
  }

  return session as WorkoutSessionLog;
}

export async function ensureCurrentWorkoutPlan(): Promise<WorkoutPlanWithDays> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Not signed in");

  const { data: active, error: activeError } = await supabase
    .from("workout_plans")
    .select("*")
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();

  if (activeError) throw activeError;

  if (active) {
    const details = await getWorkoutPlanDetails(active.id);
    if (
      active.seed_key === CURRENT_WORKOUT_PLAN_SEED.seedKey &&
      details.days.length < CURRENT_WORKOUT_PLAN_SEED.days.length
    ) {
      await upsertSeedChildren(active.id);
      return getWorkoutPlanDetails(active.id);
    }

    return details;
  }

  const { data: plan, error: planError } = await supabase
    .from("workout_plans")
    .insert({
      user_id: userData.user.id,
      seed_key: CURRENT_WORKOUT_PLAN_SEED.seedKey,
      name: CURRENT_WORKOUT_PLAN_SEED.name,
      version: CURRENT_WORKOUT_PLAN_SEED.version,
      status: "active",
      week_start_date: getWorkoutWeekStart(todayMadridDateValue()),
      goal_context: CURRENT_WORKOUT_PLAN_SEED.goalContext as Json,
    })
    .select("*")
    .single();

  if (planError) throw planError;

  await upsertSeedChildren(plan.id);
  return getWorkoutPlanDetails(plan.id);
}

export function buildWorkoutTarget(exercise: WorkoutExercisePlan): WorkoutTarget {
  return {
    sets: exercise.planned_sets,
    reps: exercise.planned_reps,
    duration: exercise.planned_duration,
    rest: exercise.planned_rest,
    tempo: exercise.planned_tempo,
    variation: exercise.planned_variation,
  };
}

export function inferExerciseType(
  exercise: Pick<
    WorkoutExercisePlan,
    "name" | "planned_reps" | "planned_duration" | "planned_sets"
  >,
  blockType?: string | null,
): WorkoutExerciseType {
  const name = exercise.name.toLowerCase();
  const block = blockType?.toLowerCase() ?? "";
  if (block.includes("cardio") || name.includes("run") || name.includes("track")) return "cardio";
  if (
    name.includes("assisted") ||
    name.includes("partial") ||
    name.includes("negative") ||
    name.includes("90-degree")
  ) {
    return "assisted";
  }
  if (
    name.includes("face pull") ||
    name.includes("external rotation") ||
    name.includes("tibialis") ||
    name.includes("calves") ||
    name.includes("wrist") ||
    block.includes("prehab")
  ) {
    return "accessory";
  }
  if (exercise.planned_duration || name.includes("hold") || name.includes("lean")) {
    return "isometric";
  }
  if (!exercise.planned_reps && !exercise.planned_duration && !exercise.planned_sets) {
    return "notes";
  }
  return "reps";
}

export function calculateExerciseStatus({
  sets,
  plannedSetCount,
  plannedName,
  actualName,
  changeReason,
  explicitlySkipped,
  target,
}: {
  sets: Array<
    Pick<
      SaveWorkoutSetInput,
      "skipped" | "seconds" | "reps" | "quality" | "changeReason" | "cardioDurationMinutes"
    >
  >;
  plannedSetCount: number | null;
  plannedName: string;
  actualName?: string | null;
  changeReason?: WorkoutChangeReason | null;
  explicitlySkipped?: boolean;
  target: WorkoutTarget;
}): WorkoutExerciseStatus {
  const performedSets = sets.filter(hasActualWork);
  const skippedSets = sets.filter((set) => set.skipped);
  const substituted = Boolean(actualName?.trim() && actualName.trim() !== plannedName.trim());

  if (substituted) return "substituted";
  if (explicitlySkipped && performedSets.length === 0) return "skipped";
  if (performedSets.length === 0) return "not_started";
  if (plannedSetCount && performedSets.length > plannedSetCount) return "overperformed";
  if (plannedSetCount && performedSets.length < plannedSetCount) return "partial";

  const modified =
    Boolean(changeReason) ||
    skippedSets.length > 0 ||
    performedSets.some((set) => Boolean(set.changeReason)) ||
    performedSets.some((set) =>
      set.quality ? !["clean", "normal", "okay", "mid"].includes(set.quality) : false,
    ) ||
    performedSets.some((set) => isOutsideTarget(set, target));

  return modified ? "completed_modified" : "completed_as_planned";
}

export function calculateSessionStatus(statuses: WorkoutExerciseStatus[]): WorkoutSessionStatus {
  const activeStatuses = statuses.filter((status) => status !== "not_started");
  if (!activeStatuses.length) return "not_started";
  if (activeStatuses.every((status) => status === "skipped")) return "skipped";
  if (statuses.some((status) => status === "partial" || status === "skipped")) return "cut_short";
  if (
    statuses.some((status) =>
      ["completed_modified", "substituted", "overperformed"].includes(status),
    )
  ) {
    return "modified";
  }
  if (statuses.every((status) => status === "completed_as_planned")) return "completed";
  return "in_progress";
}

export function parseExactSetCount(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const count = Number(trimmed);
  return Number.isFinite(count) && count > 0 && count <= 20 ? count : null;
}

export function parseTargetRange(value: string | null) {
  if (!value) return null;
  const normalized = value.replace(",", ".").trim();
  const range = normalized.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const exact = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!exact) return null;
  const number = Number(exact[1]);
  return { min: number, max: number };
}

async function upsertSeedChildren(planId: string) {
  for (const day of CURRENT_WORKOUT_PLAN_SEED.days) {
    const { data: dayRow, error: dayError } = await supabase
      .from("workout_day_plans")
      .upsert(
        {
          plan_id: planId,
          seed_key: day.seedKey,
          day_of_week: day.dayOfWeek,
          day_order: day.dayOrder,
          title: day.title,
          category: day.category,
          cap_text: day.capText,
          notes: day.notes ?? null,
        },
        { onConflict: "plan_id,seed_key" },
      )
      .select("*")
      .single();

    if (dayError) throw dayError;

    for (const [blockIndex, block] of day.blocks.entries()) {
      const { data: blockRow, error: blockError } = await supabase
        .from("workout_blocks")
        .upsert(
          {
            day_plan_id: dayRow.id,
            seed_key: block.seedKey,
            title: block.title,
            block_type: block.blockType,
            display_order: blockIndex + 1,
            notes: block.notes ?? null,
          },
          { onConflict: "day_plan_id,seed_key" },
        )
        .select("*")
        .single();

      if (blockError) throw blockError;

      if (block.exercises.length) {
        const { error: exerciseError } = await supabase.from("workout_exercise_plans").upsert(
          block.exercises.map((exercise, exerciseIndex) => ({
            block_id: blockRow.id,
            seed_key: exercise.seedKey,
            display_order: exerciseIndex + 1,
            name: exercise.name,
            planned_sets: exercise.plannedSets ?? null,
            planned_reps: exercise.plannedReps ?? null,
            planned_duration: exercise.plannedDuration ?? null,
            planned_rest: exercise.plannedRest ?? null,
            planned_tempo: exercise.plannedTempo ?? null,
            planned_variation: exercise.plannedVariation ?? null,
            notes: exercise.notes ?? null,
          })),
          { onConflict: "block_id,seed_key" },
        );

        if (exerciseError) throw exerciseError;
      }
    }
  }
}

async function getWorkoutPlanDetails(planId: string): Promise<WorkoutPlanWithDays> {
  const { data: plan, error: planError } = await supabase
    .from("workout_plans")
    .select("*")
    .eq("id", planId)
    .single();
  if (planError) throw planError;

  const { data: days, error: daysError } = await supabase
    .from("workout_day_plans")
    .select("*")
    .eq("plan_id", planId)
    .order("day_order", { ascending: true });
  if (daysError) throw daysError;

  const dayRows = (days ?? []) as WorkoutDayPlan[];
  const dayIds = dayRows.map((day) => day.id);

  let blockRows: WorkoutBlock[] = [];
  if (dayIds.length) {
    const { data: blocks, error: blocksError } = await supabase
      .from("workout_blocks")
      .select("*")
      .in("day_plan_id", dayIds)
      .order("display_order", { ascending: true });
    if (blocksError) throw blocksError;
    blockRows = (blocks ?? []) as WorkoutBlock[];
  }

  const blockIds = blockRows.map((block) => block.id);
  let exerciseRows: WorkoutExercisePlan[] = [];
  if (blockIds.length) {
    const { data: exercises, error: exercisesError } = await supabase
      .from("workout_exercise_plans")
      .select("*")
      .in("block_id", blockIds)
      .order("display_order", { ascending: true });
    if (exercisesError) throw exercisesError;
    exerciseRows = (exercises ?? []) as WorkoutExercisePlan[];
  }

  return {
    ...(plan as WorkoutPlan),
    days: dayRows.map((day) => ({
      ...day,
      blocks: blockRows
        .filter((block) => block.day_plan_id === day.id)
        .map((block) => ({
          ...block,
          exercises: exerciseRows
            .filter((exercise) => exercise.block_id === block.id)
            .map((exercise) => ({ ...exercise, log: null })),
        })),
    })),
  };
}

function attachLogsToPlan(
  plan: WorkoutPlanWithDays,
  sessions: WorkoutSessionLog[],
  exerciseLogs: WorkoutExerciseLogWithSets[],
): WorkoutPlanWithDays {
  const selectedSessionByDayPlanId = new Map(
    sessions.map((session) => [session.day_plan_id, session]),
  );

  return {
    ...plan,
    days: plan.days.map((day) => {
      const session = selectedSessionByDayPlanId.get(day.id);
      return {
        ...day,
        blocks: day.blocks.map((block) => ({
          ...block,
          exercises: block.exercises.map((exercise) => ({
            ...exercise,
            log: session
              ? (exerciseLogs.find(
                  (log) =>
                    log.session_log_id === session.id && log.exercise_plan_id === exercise.id,
                ) ?? null)
              : null,
          })),
        })),
      };
    }),
  };
}

function buildCompatibilitySummary(sets: SaveWorkoutSetInput[]): CompatibilitySummary {
  const performedSets = sets.filter(hasActualWork);
  const reps = performedSets
    .map((set) => (set.reps == null ? null : formatNumber(set.reps)))
    .filter(Boolean);
  const seconds = performedSets
    .map((set) => (set.seconds == null ? null : `${formatNumber(set.seconds)}s`))
    .filter(Boolean);
  const cardioMinutes = performedSets
    .map((set) =>
      set.cardioDurationMinutes == null ? null : `${formatNumber(set.cardioDurationMinutes)} min`,
    )
    .filter(Boolean);
  const loads = uniqueFilled(performedSets.map((set) => set.load));
  const variations = uniqueFilled(performedSets.map((set) => set.variation));

  return {
    actualSets: performedSets.length ? String(performedSets.length) : null,
    actualReps: reps.length ? reps.join(", ") : null,
    actualDuration: [...seconds, ...cardioMinutes].join(", ") || null,
    actualLoad: loads.join(", ") || null,
    actualVariation: variations.join(", ") || null,
    completedSetCount: performedSets.length || null,
    setChecklist: sets.map((set) => hasActualWork(set)),
  };
}

function hasActualWork(set: {
  skipped?: boolean;
  seconds?: number | null;
  reps?: number | null;
  cardioDurationMinutes?: number | null;
  variation?: string | null;
  load?: string | null;
}) {
  return Boolean(
    !set.skipped &&
    (set.seconds != null ||
      set.reps != null ||
      set.cardioDurationMinutes != null ||
      emptyToNull(set.variation) ||
      emptyToNull(set.load)),
  );
}

function isOutsideTarget(
  set: Pick<SaveWorkoutSetInput, "seconds" | "reps" | "cardioDurationMinutes">,
  target: WorkoutTarget,
) {
  const secondsRange = parseTargetRange(target.duration);
  if (secondsRange && set.seconds != null) {
    return set.seconds < secondsRange.min || set.seconds > secondsRange.max;
  }

  const repsRange = parseTargetRange(target.reps);
  if (repsRange && set.reps != null) {
    return set.reps < repsRange.min || set.reps > repsRange.max;
  }

  const cardioRange = parseTargetRange(target.duration);
  if (cardioRange && set.cardioDurationMinutes != null) {
    return (
      set.cardioDurationMinutes < cardioRange.min || set.cardioDurationMinutes > cardioRange.max
    );
  }

  return false;
}

function uniqueFilled(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map(emptyToNull).filter(Boolean))) as string[];
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
