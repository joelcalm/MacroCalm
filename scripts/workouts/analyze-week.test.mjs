import test from "node:test";
import assert from "node:assert/strict";
import { analyzeWorkoutWeek, formatWorkoutReviewMarkdown } from "./analyze-week.mjs";

const baseSummary = {
  userId: "user-123",
  weekStartDate: "2026-07-06",
  weekEndDate: "2026-07-12",
  goalContext: { primaryGoal: "planche" },
  plan: { id: "plan-1", name: "Current Workout Plan", version: 1, status: "active" },
  sessions: [
    session("MON", "Push A: Hard Planche", "push", "completed", [
      exercise("Tuck planche holds", "completed"),
      exercise("Pseudo planche push-ups", "completed"),
    ]),
    session("TUE", "Track + Light Front Lever Micro", "cardio", "completed", [
      exercise("Track intervals", "completed"),
      exercise("Easy tuck FL hold", "completed"),
    ]),
    session("WED", "Pull A: Hard Front Lever", "pull", "partially_completed", [
      exercise("Main FL holds", "partial", "elbows felt cooked"),
      exercise("Weighted pull-ups", "skipped"),
    ]),
    session("THU", "Legs + Light Planche + Easy Run", "legs", "skipped", [
      exercise("Bulgarian split squat", "skipped"),
    ]),
    session("FRI", "Push B: Planche Volume", "push", "not_started", [
      exercise("Tuck planche holds", "not_started"),
    ]),
    session("SAT", "Pull B: Front Lever Priority", "pull", "not_started", [
      exercise("Front lever pull-up progression", "not_started"),
    ]),
    session("SUN", "Long Run", "cardio", "not_started", [exercise("Long run", "not_started")]),
  ],
};

test("weekly analyzer detects low compliance and creates conservative recommendations", () => {
  const review = analyzeWorkoutWeek(baseSummary);
  assert.equal(review.completion.sessionsPlanned, 7);
  assert.equal(review.completion.sessionsLogged, 4);
  assert.equal(review.completion.sessionsSkipped, 1);
  assert.ok(review.completion.exerciseCompletionRate < 0.7);
  assert.ok(review.bottlenecks.some((item) => item.includes("Too little workout logging")));
  assert.ok(review.recommendations.some((item) => item.type === "deload"));
  assert.ok(
    review.draftPlan.days
      .find((day) => day.dayOfWeek === "WED")
      .adjustmentNotes.join(" ")
      .includes("FL"),
  );
});

test("weekly analyzer recommends progression when completion is high", () => {
  const summary = {
    ...baseSummary,
    sessions: baseSummary.sessions.map((s) => ({
      ...s,
      status: "completed",
      blocks: s.blocks.map((b) => ({
        ...b,
        exercises: b.exercises.map((e) => ({
          ...e,
          actual: { ...e.actual, status: "completed", notes: null },
        })),
      })),
    })),
  };
  const review = analyzeWorkoutWeek(summary);
  assert.ok(review.completion.exerciseCompletionRate >= 0.85);
  assert.ok(review.recommendations.some((item) => item.type === "progression"));
  assert.ok(formatWorkoutReviewMarkdown(review).includes("Next-week adjustments"));
});

function session(dayOfWeek, title, category, status, exercises) {
  return {
    date: `2026-07-${dayOfWeek === "MON" ? "06" : "07"}`,
    dayOfWeek,
    title,
    category,
    capText: "70-75 min",
    status,
    durationMinutes: null,
    rpe: null,
    notes: null,
    blocks: [{ title: "Main", blockType: "main", notes: null, exercises }],
  };
}

function exercise(name, status, notes = null) {
  return {
    id: name.toLowerCase().replaceAll(" ", "-"),
    name,
    planned: {
      sets: "3",
      reps: "4-8",
      duration: null,
      rest: null,
      tempo: null,
      variation: null,
      notes: null,
    },
    actual: {
      status,
      sets: null,
      reps: null,
      duration: null,
      load: null,
      variation: null,
      completedSetCount: null,
      setChecklist: [],
      notes,
    },
  };
}
