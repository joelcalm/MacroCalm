const GOAL_PATTERNS = {
  planche: /planche|pseudo planche|90.?degree|hspu|handstand/i,
  frontLever: /front lever|\bfl\b|pull-up|pull up|row|scap pull/i,
  cardio: /run|track|interval|zone 2|800m|200m|4x4/i,
  legs: /squat|rdl|calf|tibialis|jump|leg/i,
};

export function analyzeWorkoutWeek(summary) {
  const sessions = summary.sessions ?? [];
  const allExercises = sessions.flatMap((session) =>
    (session.blocks ?? []).flatMap((block) =>
      (block.exercises ?? []).map((exercise) => ({ session, block, exercise })),
    ),
  );

  const loggedSessions = sessions.filter((session) => session.status !== "not_started").length;
  const completedSessions = sessions.filter((session) => session.status === "completed").length;
  const partialSessions = sessions.filter(
    (session) => session.status === "partially_completed",
  ).length;
  const skippedSessions = sessions.filter((session) => session.status === "skipped").length;

  const plannedExercises = allExercises.length;
  const completedExercises = allExercises.filter(
    ({ exercise }) => exercise.actual.status === "completed",
  ).length;
  const partialExercises = allExercises.filter(
    ({ exercise }) => exercise.actual.status === "partial",
  ).length;
  const skippedExercises = allExercises.filter(
    ({ exercise }) => exercise.actual.status === "skipped",
  ).length;
  const notStartedExercises = allExercises.filter(
    ({ exercise }) => exercise.actual.status === "not_started",
  ).length;

  const focusAreas = Object.fromEntries(
    Object.keys(GOAL_PATTERNS).map((key) => [key, buildFocusStats(key, allExercises)]),
  );

  const bottlenecks = buildBottlenecks({
    sessions,
    allExercises,
    focusAreas,
    loggedSessions,
    skippedSessions,
    partialSessions,
    plannedExercises,
    completedExercises,
    partialExercises,
    skippedExercises,
  });

  const recommendations = buildRecommendations({
    sessions,
    focusAreas,
    bottlenecks,
    completionRate: plannedExercises ? completedExercises / plannedExercises : 0,
    loggedSessions,
  });

  const draftPlan = buildDraftPlan(summary, recommendations);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    userId: summary.userId,
    weekStartDate: summary.weekStartDate,
    weekEndDate: summary.weekEndDate,
    sourcePlan: summary.plan,
    goalContext: summary.goalContext,
    completion: {
      sessionsPlanned: sessions.length,
      sessionsLogged: loggedSessions,
      sessionsCompleted: completedSessions,
      sessionsPartial: partialSessions,
      sessionsSkipped: skippedSessions,
      exercisesPlanned: plannedExercises,
      exercisesCompleted: completedExercises,
      exercisesPartial: partialExercises,
      exercisesSkipped: skippedExercises,
      exercisesNotStarted: notStartedExercises,
      exerciseCompletionRate: roundRatio(
        plannedExercises ? completedExercises / plannedExercises : 0,
      ),
    },
    focusAreas,
    bottlenecks,
    recommendations,
    draftPlan,
  };
}

export function formatWorkoutReviewMarkdown(review) {
  const lines = [];
  lines.push(`# Weekly Workout Review: ${review.weekStartDate} to ${review.weekEndDate}`);
  lines.push("");
  lines.push(`Plan: ${review.sourcePlan.name} v${review.sourcePlan.version}`);
  lines.push(
    "Goal: progress faster on planche, front lever, 90-degree push-up, and running while managing fatigue.",
  );
  lines.push("");
  lines.push("## Compliance");
  lines.push(
    `- Sessions logged: ${review.completion.sessionsLogged}/${review.completion.sessionsPlanned}`,
  );
  lines.push(`- Sessions completed: ${review.completion.sessionsCompleted}`);
  lines.push(`- Partial sessions: ${review.completion.sessionsPartial}`);
  lines.push(`- Skipped sessions: ${review.completion.sessionsSkipped}`);
  lines.push(
    `- Exercise completion: ${Math.round(review.completion.exerciseCompletionRate * 100)}% (${review.completion.exercisesCompleted}/${review.completion.exercisesPlanned})`,
  );
  lines.push("");
  lines.push("## Focus areas");
  for (const [key, stats] of Object.entries(review.focusAreas)) {
    lines.push(
      `- ${labelFocus(key)}: ${stats.completed}/${stats.planned} completed, ${stats.partial} partial, ${stats.skipped} skipped`,
    );
  }
  lines.push("");
  lines.push("## Bottlenecks");
  if (review.bottlenecks.length === 0)
    lines.push("- No major bottleneck detected from the logged data.");
  for (const item of review.bottlenecks) lines.push(`- ${item}`);
  lines.push("");
  lines.push("## Next-week adjustments");
  for (const item of review.recommendations) lines.push(`- ${item.reason}: ${item.action}`);
  lines.push("");
  lines.push("## Draft plan notes");
  for (const day of review.draftPlan.days) {
    lines.push(
      `- ${day.dayOfWeek} — ${day.title}: ${day.adjustmentNotes.join(" ") || "Keep as planned."}`,
    );
  }
  lines.push("");
  lines.push("Research/training guidance only. No medical advice. Stop/modify if pain appears.");
  return lines.join("\n");
}

function buildFocusStats(key, allExercises) {
  const pattern = GOAL_PATTERNS[key];
  const matching = allExercises.filter(({ exercise, session }) =>
    pattern.test([exercise.name, session.title, session.category].filter(Boolean).join(" ")),
  );
  return {
    planned: matching.length,
    completed: matching.filter(({ exercise }) => exercise.actual.status === "completed").length,
    partial: matching.filter(({ exercise }) => exercise.actual.status === "partial").length,
    skipped: matching.filter(({ exercise }) => exercise.actual.status === "skipped").length,
    notes: matching
      .filter(({ exercise }) => exercise.actual.notes)
      .map(({ exercise }) => ({ exercise: exercise.name, note: exercise.actual.notes })),
  };
}

function buildBottlenecks(input) {
  const out = [];
  if (input.loggedSessions < 5)
    out.push(
      "Too little workout logging for aggressive changes; preserve plan and improve consistency first.",
    );
  if (input.skippedSessions >= 2)
    out.push(
      "Two or more skipped sessions; total weekly load is probably too high or schedule friction is high.",
    );
  if (input.partialSessions >= 2)
    out.push(
      "Multiple partial sessions; reduce low-priority volume before changing main skill work.",
    );
  if (input.plannedExercises && input.completedExercises / input.plannedExercises < 0.7)
    out.push("Exercise completion below 70%; plan should be simplified rather than intensified.");
  if (
    input.focusAreas.planche.planned &&
    input.focusAreas.planche.completed / input.focusAreas.planche.planned < 0.65
  )
    out.push("Planche completion is weak; keep frequency but cut accessory pushing volume.");
  if (
    input.focusAreas.frontLever.planned &&
    input.focusAreas.frontLever.completed / input.focusAreas.frontLever.planned < 0.65
  )
    out.push(
      "Front lever completion is weak; protect hard pull days and reduce optional pulling volume.",
    );
  if (hasPainOrFatigueNote(input.allExercises))
    out.push(
      "Pain/fatigue notes detected; next week should reduce intensity/volume on affected movements.",
    );
  return out;
}

function buildRecommendations({ focusAreas, bottlenecks, completionRate, loggedSessions }) {
  const recs = [];
  if (loggedSessions < 5) {
    recs.push({
      type: "logging",
      reason: "Insufficient complete weekly data",
      action: "Do not overhaul the plan; run the same structure and log every session.",
    });
  }
  if (
    completionRate >= 0.85 &&
    loggedSessions >= 5 &&
    !hasBottleneck(bottlenecks, "Pain/fatigue")
  ) {
    recs.push({
      type: "progression",
      reason: "High completion with enough logs",
      action:
        "Progress one main skill slot slightly: +1 set OR harder variation OR +2-5 seconds/reps, not all at once.",
    });
  }
  if (completionRate < 0.7) {
    recs.push({
      type: "deload",
      reason: "Low completion",
      action: "Cut 10-20% accessory volume and preserve only main skill exposures.",
    });
  }
  if (
    focusAreas.planche.planned &&
    focusAreas.planche.completed / focusAreas.planche.planned < 0.75
  ) {
    recs.push({
      type: "planche",
      reason: "Planche work under-completed",
      action:
        "Keep Monday/F Friday planche priorities, but reduce optional/micro planche volume by 1-2 sets.",
    });
  } else if (
    focusAreas.planche.planned &&
    focusAreas.planche.completed / focusAreas.planche.planned >= 0.85
  ) {
    recs.push({
      type: "planche",
      reason: "Planche work tolerated",
      action: "Add a small progression to the first planche hold only; keep accessories unchanged.",
    });
  }
  if (
    focusAreas.frontLever.planned &&
    focusAreas.frontLever.completed / focusAreas.frontLever.planned < 0.75
  ) {
    recs.push({
      type: "frontLever",
      reason: "Front lever work under-completed",
      action:
        "Keep Wednesday/Saturday hard FL, but skip optional FL micro when elbows/shoulders feel taxed.",
    });
  } else if (
    focusAreas.frontLever.planned &&
    focusAreas.frontLever.completed / focusAreas.frontLever.planned >= 0.85
  ) {
    recs.push({
      type: "frontLever",
      reason: "Front lever work tolerated",
      action:
        "Progress one FL hold/negative variable only: cleaner form first, then duration/reps.",
    });
  }
  if (focusAreas.cardio.planned && focusAreas.cardio.completed / focusAreas.cardio.planned < 0.75) {
    recs.push({
      type: "cardio",
      reason: "Cardio under-completed",
      action:
        "Keep one quality interval day and one easy long run; avoid adding extra leg fatigue.",
    });
  }
  if (recs.length === 0)
    recs.push({
      type: "maintain",
      reason: "No clear signal",
      action: "Repeat current plan and collect better notes before changing volume.",
    });
  return recs;
}

function buildDraftPlan(summary, recommendations) {
  const sessions = summary.sessions ?? [];
  return {
    name: `Draft plan after ${summary.weekStartDate}`,
    sourcePlanId: summary.plan.id,
    sourcePlanVersion: summary.plan.version,
    targetWeekStartDate: addDays(summary.weekEndDate, 1),
    adjustmentSummary: recommendations.map((r) => `${r.reason}: ${r.action}`),
    days: sessions.map((session) => ({
      dayOfWeek: session.dayOfWeek,
      title: session.title,
      category: session.category,
      adjustmentNotes: dayAdjustmentNotes(session, recommendations),
    })),
  };
}

function dayAdjustmentNotes(session, recommendations) {
  const notes = [];
  const text = `${session.title} ${session.category}`.toLowerCase();
  if (recommendations.some((r) => r.type === "deload"))
    notes.push("Cut low-priority accessory volume 10-20%; keep main skill exposure.");
  if (recommendations.some((r) => r.type === "progression") && /push|pull|planche|front/.test(text))
    notes.push("Progress only the first main skill movement slightly if warm-up feels sharp.");
  if (recommendations.some((r) => r.type === "planche") && /push|planche/.test(text))
    notes.push("Bias quality planche sets; reduce optional planche micro if completion was poor.");
  if (recommendations.some((r) => r.type === "frontLever") && /pull|front/.test(text))
    notes.push(
      "Bias clean FL holds/negatives; do not add extra pulling volume if elbows feel taxed.",
    );
  if (recommendations.some((r) => r.type === "cardio") && /cardio|track|run/.test(text))
    notes.push(
      "Keep cardio dose repeatable; do not chase intensity if legs compromise skill days.",
    );
  if (session.status === "skipped")
    notes.push("This day was skipped; keep structure unchanged until it is completed once.");
  if (session.status === "partially_completed")
    notes.push("This day was partial; preserve main work and trim accessories first.");
  return [...new Set(notes)];
}

function hasPainOrFatigueNote(allExercises) {
  return allExercises.some(({ exercise, session }) =>
    /pain|ache|elbow|shoulder|wrist|fatigue|tired|cooked|sore/i.test(
      `${exercise.actual.notes ?? ""} ${session.notes ?? ""}`,
    ),
  );
}

function hasBottleneck(bottlenecks, text) {
  return bottlenecks.some((item) => item.toLowerCase().includes(text.toLowerCase()));
}

function roundRatio(value) {
  return Math.round(value * 1000) / 1000;
}

function addDays(dateString, days) {
  const d = new Date(`${dateString}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function labelFocus(key) {
  return (
    {
      planche: "Planche / 90-degree push-up",
      frontLever: "Front lever / pulling",
      cardio: "Running / cardio",
      legs: "Legs / lower body",
    }[key] ?? key
  );
}
