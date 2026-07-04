import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DateSelector } from "@/components/DateSelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Json } from "@/integrations/supabase/types";
import {
  getWorkoutDayCode,
  getWorkoutWeekDates,
  getWorkoutWeekStart,
  todayMadridDateValue,
} from "@/lib/workouts/dates";
import {
  buildWorkoutTarget,
  calculateExerciseStatus,
  calculateSessionStatus,
  getWorkoutWeekData,
  inferExerciseType,
  parseExactSetCount,
  parseTargetRange,
  saveWorkoutSession,
  type SaveWorkoutSetInput,
  type WorkoutChangeReason,
  type WorkoutExercisePlanWithLog,
  type WorkoutExerciseStatus,
  type WorkoutExerciseType,
  type WorkoutSessionLogWithExercises,
  type WorkoutSessionStatus,
  type WorkoutSetLog,
  type WorkoutSetQuality,
  type WorkoutTarget,
  type WorkoutWeekData,
} from "@/lib/workouts/workoutQueries";
import { getErrorMessage } from "@/lib/utils";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Copy,
  Dumbbell,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  SkipForward,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/workout")({
  validateSearch: (search: Record<string, unknown>) => ({
    date: typeof search.date === "string" && isDateValue(search.date) ? search.date : undefined,
  }),
  component: WorkoutPage,
});

type PainState = "fine" | "tight" | "painful";

type SessionDraft = {
  statusOverride: WorkoutSessionStatus | "";
  durationMinutes: string;
  rpe: string;
  energy: string;
  painFlags: Record<"wrists" | "elbows" | "shoulders" | "knees_legs", PainState>;
  notes: string;
};

type SetDraft = {
  setIndex: number;
  variation: string;
  surface: string;
  reps: string;
  seconds: string;
  load: string;
  assistance: string;
  rangeOfMotion: string;
  cardioDurationMinutes: string;
  cardioDistance: string;
  intensity: string;
  rpe: string;
  rir: string;
  quality: WorkoutSetQuality | "";
  skipped: boolean;
  changeReason: WorkoutChangeReason | "";
  note: string;
};

type ExerciseDraft = {
  actualName: string;
  isSwapping: boolean;
  changeReason: WorkoutChangeReason | "";
  notes: string;
  sets: SetDraft[];
  expanded: boolean;
  explicitlySkipped: boolean;
};

type SetEditorState = {
  exerciseId: string;
  setIndex: number | null;
  draft: SetDraft;
};

const changeReasons: { value: WorkoutChangeReason; label: string }[] = [
  { value: "fatigue", label: "Fatigue" },
  { value: "pain", label: "Pain" },
  { value: "time", label: "Time" },
  { value: "felt_strong", label: "Strong" },
  { value: "equipment", label: "Equipment" },
  { value: "other", label: "Other" },
];

const qualityOptions: { value: WorkoutSetQuality; label: string }[] = [
  { value: "clean", label: "Clean" },
  { value: "normal", label: "Normal" },
  { value: "bad", label: "Bad" },
];

const painOptions: { value: PainState; label: string }[] = [
  { value: "fine", label: "Fine" },
  { value: "tight", label: "Tight" },
  { value: "painful", label: "Pain" },
];

const outcomeOptions: { value: WorkoutSessionStatus; label: string }[] = [
  { value: "completed", label: "Completed" },
  { value: "modified", label: "Modified" },
  { value: "cut_short", label: "Cut short" },
  { value: "skipped", label: "Skipped" },
];

function WorkoutPage() {
  const search = Route.useSearch();
  const [date, setDate] = useState(() => search.date ?? todayMadridDateValue());
  const [data, setData] = useState<WorkoutWeekData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionDraft, setSessionDraft] = useState<SessionDraft>(() => emptySessionDraft());
  const [exerciseDrafts, setExerciseDrafts] = useState<Record<string, ExerciseDraft>>({});
  const [setEditor, setSetEditor] = useState<SetEditorState | null>(null);

  const weekStartDate = useMemo(() => getWorkoutWeekStart(date), [date]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getWorkoutWeekData(date)
      .then((nextData) => {
        if (!cancelled) setData(nextData);
      })
      .catch((error: unknown) => {
        if (!cancelled) toast.error(getErrorMessage(error, "Could not load workout"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [date]);

  const selectedDay = useMemo(() => {
    if (!data) return null;
    const dayCode = getWorkoutDayCode(date);
    return data.plan.days.find((day) => day.day_of_week === dayCode) ?? null;
  }, [data, date]);

  const selectedSession = useMemo(() => {
    if (!data || !selectedDay) return null;
    return (
      data.sessionLogs.find(
        (session) => session.date === date && session.day_plan_id === selectedDay.id,
      ) ?? null
    );
  }, [data, selectedDay, date]);

  const selectedExercises = useMemo(() => {
    return selectedDay?.blocks.flatMap((block) => block.exercises) ?? [];
  }, [selectedDay]);

  const exerciseTypes = useMemo(() => {
    const next: Record<string, WorkoutExerciseType> = {};
    if (!selectedDay) return next;
    for (const block of selectedDay.blocks) {
      for (const exercise of block.exercises) {
        next[exercise.id] =
          exercise.log?.exercise_type ?? inferExerciseType(exercise, block.block_type);
      }
    }
    return next;
  }, [selectedDay]);

  const exerciseStatuses = useMemo(() => {
    const next: Record<string, WorkoutExerciseStatus> = {};
    for (const exercise of selectedExercises) {
      const draft = exerciseDrafts[exercise.id] ?? buildExerciseDraft(exercise);
      next[exercise.id] = getDraftExerciseStatus(exercise, draft);
    }
    return next;
  }, [selectedExercises, exerciseDrafts]);

  const calculatedSessionStatus = useMemo(
    () => calculateSessionStatus(Object.values(exerciseStatuses)),
    [exerciseStatuses],
  );

  useEffect(() => {
    if (!selectedDay) return;
    setSessionDraft(buildSessionDraft(selectedSession));

    const nextDrafts: Record<string, ExerciseDraft> = {};
    for (const exercise of selectedExercises) {
      nextDrafts[exercise.id] = buildExerciseDraft(exercise);
    }
    setExerciseDrafts(nextDrafts);
  }, [selectedDay, selectedSession, selectedExercises]);

  async function save() {
    if (!data || !selectedDay) return;

    const finalSessionStatus = sessionDraft.statusOverride || calculatedSessionStatus;
    setSaving(true);
    try {
      const durationMinutes = parseOptionalNumber(sessionDraft.durationMinutes, {
        label: "Minutes",
        min: 0,
        integer: true,
      });
      const rpe = parseOptionalNumber(sessionDraft.rpe, {
        label: "Workout RPE",
        min: 1,
        max: 10,
      });
      const energy = parseOptionalNumber(sessionDraft.energy, {
        label: "Energy",
        min: 1,
        max: 5,
        integer: true,
      });

      await saveWorkoutSession({
        date,
        planId: data.plan.id,
        dayPlanId: selectedDay.id,
        status: finalSessionStatus,
        durationMinutes,
        rpe,
        energy,
        painFlags: sessionDraft.painFlags as Json,
        notes: sessionDraft.notes,
        exerciseLogs: selectedDay.blocks.flatMap((block) =>
          block.exercises.map((exercise) => {
            const draft = exerciseDrafts[exercise.id] ?? buildExerciseDraft(exercise);
            const target = buildWorkoutTarget(exercise);
            const status = getDraftExerciseStatus(exercise, draft);
            return {
              exercisePlanId: exercise.id,
              plannedName: exercise.name,
              actualName: draft.actualName,
              orderIndex: exercise.display_order,
              exerciseType:
                exerciseTypes[exercise.id] ?? inferExerciseType(exercise, block.block_type),
              target,
              restTarget: exercise.planned_rest,
              status,
              changeReason: draft.changeReason || null,
              notes: draft.notes,
              sets: draft.sets.map((set, index) =>
                toSaveSet(set, index + 1, target, exercise.name),
              ),
            };
          }),
        ),
      });

      const refreshed = await getWorkoutWeekData(date);
      setData(refreshed);
      toast.success("Workout saved");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Could not save workout"));
    } finally {
      setSaving(false);
    }
  }

  function updateExercise(exerciseId: string, updater: (draft: ExerciseDraft) => ExerciseDraft) {
    const exercise = selectedExercises.find((item) => item.id === exerciseId);
    if (!exercise) return;
    setExerciseDrafts((prev) => ({
      ...prev,
      [exerciseId]: updater(prev[exerciseId] ?? buildExerciseDraft(exercise)),
    }));
  }

  function openNewSet(exercise: WorkoutExercisePlanWithLog) {
    const draft = exerciseDrafts[exercise.id] ?? buildExerciseDraft(exercise);
    const previous = draft.sets.at(-1);
    setSetEditor({
      exerciseId: exercise.id,
      setIndex: null,
      draft: buildPrefilledSetDraft(
        exercise,
        exerciseTypes[exercise.id] ?? "reps",
        draft.sets.length + 1,
        previous,
      ),
    });
  }

  function openEditSet(exercise: WorkoutExercisePlanWithLog, set: SetDraft) {
    setSetEditor({ exerciseId: exercise.id, setIndex: set.setIndex, draft: { ...set } });
  }

  function saveEditorSet() {
    if (!setEditor) return;
    updateExercise(setEditor.exerciseId, (draft) => {
      const nextSet =
        setEditor.setIndex == null
          ? { ...setEditor.draft, setIndex: draft.sets.length + 1 }
          : setEditor.draft;
      const sets =
        setEditor.setIndex == null
          ? [...draft.sets, nextSet]
          : draft.sets.map((set) => (set.setIndex === setEditor.setIndex ? nextSet : set));
      return renumberDraftSets({ ...draft, sets, explicitlySkipped: false, expanded: true });
    });
    setSetEditor(null);
  }

  function deleteEditorSet() {
    if (!setEditor?.setIndex) return;
    deleteSet(setEditor.exerciseId, setEditor.setIndex);
    setSetEditor(null);
  }

  function deleteSet(exerciseId: string, setIndex: number) {
    updateExercise(exerciseId, (draft) =>
      renumberDraftSets({
        ...draft,
        sets: draft.sets.filter((set) => set.setIndex !== setIndex),
      }),
    );
  }

  function addTargetSet(exercise: WorkoutExercisePlanWithLog) {
    const type = exerciseTypes[exercise.id] ?? "reps";
    updateExercise(exercise.id, (draft) =>
      renumberDraftSets({
        ...draft,
        sets: [
          ...draft.sets,
          buildPrefilledSetDraft(exercise, type, draft.sets.length + 1, draft.sets.at(-1)),
        ],
        explicitlySkipped: false,
        expanded: true,
      }),
    );
  }

  function completeRemainingAsPlanned(exercise: WorkoutExercisePlanWithLog) {
    const plannedSetCount =
      parseExactSetCount(exercise.planned_sets) ?? exerciseDrafts[exercise.id]?.sets.length ?? 1;
    const type = exerciseTypes[exercise.id] ?? "reps";
    updateExercise(exercise.id, (draft) => {
      const nextSets = [...draft.sets];
      while (nextSets.length < plannedSetCount) {
        nextSets.push(buildPrefilledSetDraft(exercise, type, nextSets.length + 1, nextSets.at(-1)));
      }
      return renumberDraftSets({
        ...draft,
        sets: nextSets,
        explicitlySkipped: false,
        expanded: true,
      });
    });
  }

  function duplicateLastSet(exercise: WorkoutExercisePlanWithLog) {
    updateExercise(exercise.id, (draft) => {
      const last = draft.sets.at(-1);
      if (!last) return draft;
      return renumberDraftSets({
        ...draft,
        sets: [...draft.sets, { ...last, setIndex: draft.sets.length + 1 }],
        expanded: true,
      });
    });
  }

  return (
    <AppShell title="Workout">
      <DateSelector value={date} onChange={setDate} />

      <div className="mt-4">
        <WeeklyOverview
          selectedDate={date}
          weekStartDate={weekStartDate}
          sessionLogs={data?.sessionLogs ?? []}
          onSelectDate={setDate}
        />
      </div>

      {loading ? (
        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading workout...
        </div>
      ) : !data || !selectedDay ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">No workout plan found for this day.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-4 pb-28">
          <section className="rounded-2xl border border-border bg-card p-3.5 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {selectedDay.day_of_week} · {selectedDay.category}
                </p>
                <h2 className="mt-1 font-display text-xl font-semibold">{selectedDay.title}</h2>
                {selectedDay.cap_text && (
                  <p className="mt-1 text-sm text-muted-foreground">{selectedDay.cap_text}</p>
                )}
              </div>
              <StatusBadge status={sessionDraft.statusOverride || calculatedSessionStatus} />
            </div>
            {selectedDay.notes && (
              <p className="mt-3 text-sm text-muted-foreground">{selectedDay.notes}</p>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2">
              <NumberField
                label="Min"
                value={sessionDraft.durationMinutes}
                onChange={(durationMinutes) =>
                  setSessionDraft((prev) => ({ ...prev, durationMinutes }))
                }
              />
              <NumberField
                label="RPE"
                value={sessionDraft.rpe}
                onChange={(rpe) => setSessionDraft((prev) => ({ ...prev, rpe }))}
              />
              <NumberField
                label="Energy"
                value={sessionDraft.energy}
                onChange={(energy) => setSessionDraft((prev) => ({ ...prev, energy }))}
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSessionDraft((prev) => ({ ...prev, statusOverride: "" }))}
                className={chipClass(!sessionDraft.statusOverride)}
              >
                Auto
              </button>
              {outcomeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setSessionDraft((prev) => ({ ...prev, statusOverride: option.value }))
                  }
                  className={chipClass(sessionDraft.statusOverride === option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="mt-3 grid gap-2">
              {Object.entries(sessionDraft.painFlags).map(([area, value]) => (
                <div key={area} className="flex items-center justify-between gap-2">
                  <span className="text-xs capitalize text-muted-foreground">
                    {area.replace("_", "/")}
                  </span>
                  <div className="flex gap-1">
                    {painOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setSessionDraft((prev) => ({
                            ...prev,
                            painFlags: { ...prev.painFlags, [area]: option.value },
                          }))
                        }
                        className={smallChipClass(value === option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <Textarea
              value={sessionDraft.notes}
              onChange={(event) =>
                setSessionDraft((prev) => ({ ...prev, notes: event.target.value }))
              }
              placeholder="Session note"
              className="mt-3 min-h-14 rounded-xl bg-input text-sm"
            />
          </section>

          {selectedDay.blocks.map((block) => (
            <section key={block.id}>
              <div className="mb-2 px-1">
                <h3 className="font-display text-base font-semibold">{block.title}</h3>
              </div>
              {block.exercises.length === 0 ? (
                <div className="rounded-2xl border border-border bg-card p-3.5 text-sm text-muted-foreground shadow-card">
                  {compactBlockSummary(block.title, block.notes)}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {block.exercises.map((exercise) => (
                    <ExerciseCard
                      key={exercise.id}
                      exercise={exercise}
                      type={
                        exerciseTypes[exercise.id] ?? inferExerciseType(exercise, block.block_type)
                      }
                      draft={exerciseDrafts[exercise.id] ?? buildExerciseDraft(exercise)}
                      status={exerciseStatuses[exercise.id] ?? "not_started"}
                      onChange={(nextDraft) =>
                        setExerciseDrafts((prev) => ({ ...prev, [exercise.id]: nextDraft }))
                      }
                      onAddSet={() => openNewSet(exercise)}
                      onUseTarget={() => addTargetSet(exercise)}
                      onDuplicateLast={() => duplicateLastSet(exercise)}
                      onCompleteRemaining={() => completeRemainingAsPlanned(exercise)}
                      onEditSet={(set) => openEditSet(exercise, set)}
                      onDeleteSet={(setIndex) => deleteSet(exercise.id, setIndex)}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="sticky bottom-24 z-10 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save workout"}
          </button>
        </div>
      )}

      <SetEditorDrawer
        state={setEditor}
        exercise={
          setEditor ? selectedExercises.find((item) => item.id === setEditor.exerciseId) : null
        }
        type={setEditor ? (exerciseTypes[setEditor.exerciseId] ?? "reps") : "reps"}
        onChange={(draft) => setSetEditor((prev) => (prev ? { ...prev, draft } : prev))}
        onClose={() => setSetEditor(null)}
        onSave={saveEditorSet}
        onDelete={deleteEditorSet}
      />
    </AppShell>
  );
}

function WeeklyOverview({
  selectedDate,
  weekStartDate,
  sessionLogs,
  onSelectDate,
}: {
  selectedDate: string;
  weekStartDate: string;
  sessionLogs: WorkoutSessionLogWithExercises[];
  onSelectDate: (date: string) => void;
}) {
  const weekDates = getWorkoutWeekDates(weekStartDate);

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {weekDates.map(({ dayCode, date }) => {
        const status =
          sessionLogs.find((session) => session.date === date)?.status ?? "not_started";
        return (
          <button
            type="button"
            key={date}
            onClick={() => onSelectDate(date)}
            className={[
              "min-w-0 rounded-xl border p-2 text-center transition-colors",
              selectedDate === date
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            <span className="block text-[10px] font-semibold">{dayCode.slice(0, 3)}</span>
            <span className="mt-1 block text-xs">{Number(date.slice(-2))}</span>
            <span className={`mx-auto mt-1 block h-1.5 w-1.5 rounded-full ${dotClass(status)}`} />
          </button>
        );
      })}
    </div>
  );
}

function ExerciseCard({
  exercise,
  type,
  draft,
  status,
  onChange,
  onAddSet,
  onUseTarget,
  onDuplicateLast,
  onCompleteRemaining,
  onEditSet,
  onDeleteSet,
}: {
  exercise: WorkoutExercisePlanWithLog;
  type: WorkoutExerciseType;
  draft: ExerciseDraft;
  status: WorkoutExerciseStatus;
  onChange: (draft: ExerciseDraft) => void;
  onAddSet: () => void;
  onUseTarget: () => void;
  onDuplicateLast: () => void;
  onCompleteRemaining: () => void;
  onEditSet: (set: SetDraft) => void;
  onDeleteSet: (setIndex: number) => void;
}) {
  const plannedSetCount = parseExactSetCount(exercise.planned_sets);
  const performedSets = draft.sets.filter(setHasActualWork);
  const actualSummary = buildActualSummary(draft.sets, type);

  return (
    <article className="rounded-2xl border border-border bg-card p-3.5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => onChange({ ...draft, expanded: !draft.expanded })}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold leading-tight">{exercise.name}</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Target: {targetText(exercise)}
                {exercise.planned_rest ? ` · Rest ${exercise.planned_rest}` : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Actual:{" "}
                {actualSummary || `${performedSets.length}/${plannedSetCount ?? "?"} sets logged`}
              </p>
            </div>
            {draft.expanded ? (
              <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </div>
        </button>
        <StatusBadge status={status} />
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        <Button type="button" size="sm" onClick={onAddSet} className="px-2">
          <Plus className="h-4 w-4" />
          Set
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onUseTarget} className="px-2">
          <Activity className="h-4 w-4" />
          Target
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() =>
            onChange({
              ...draft,
              expanded: true,
              isSwapping: true,
              actualName: draft.actualName,
            })
          }
          className="px-2"
        >
          <RefreshCcw className="h-4 w-4" />
          Swap
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() =>
            onChange({
              ...draft,
              explicitlySkipped: !draft.explicitlySkipped,
              expanded: true,
              sets: draft.explicitlySkipped ? draft.sets : [],
            })
          }
          className="px-2"
        >
          <SkipForward className="h-4 w-4" />
          Skip
        </Button>
      </div>

      {draft.expanded && (
        <div className="mt-3 space-y-3">
          {(draft.isSwapping || draft.actualName) && (
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Actual exercise</label>
              <Input
                value={draft.actualName}
                onChange={(event) =>
                  onChange({ ...draft, isSwapping: true, actualName: event.target.value })
                }
                placeholder={`Instead of ${exercise.name}`}
                className="rounded-xl bg-input"
              />
              {draft.actualName && draft.actualName !== exercise.name && (
                <p className="text-xs text-muted-foreground">This will be saved as a swap.</p>
              )}
            </div>
          )}

          {(draft.explicitlySkipped || draft.isSwapping || draft.changeReason) && (
            <ReasonPicker
              value={draft.changeReason}
              onChange={(changeReason) => onChange({ ...draft, changeReason })}
            />
          )}

          {draft.sets.length ? (
            <div className="space-y-1.5">
              {draft.sets.map((set) => (
                <div
                  key={set.setIndex}
                  className="flex items-center gap-2 rounded-xl border border-border bg-secondary/60 px-3 py-2 text-sm"
                >
                  <button
                    type="button"
                    onClick={() => onEditSet(set)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate">
                      Set {set.setIndex}: {formatSetLine(set, type)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSet(set.setIndex)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background/60 text-destructive"
                    aria-label={`Remove set ${set.setIndex}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
              No sets logged.
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onDuplicateLast}
              disabled={!draft.sets.length}
            >
              <Copy className="h-4 w-4" />
              Duplicate last
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onCompleteRemaining}>
              <Dumbbell className="h-4 w-4" />
              Fill remaining
            </Button>
          </div>

          <Textarea
            value={draft.notes}
            onChange={(event) => onChange({ ...draft, notes: event.target.value })}
            placeholder="Exercise note"
            className="min-h-12 rounded-xl bg-input text-sm"
          />
        </div>
      )}
    </article>
  );
}

function SetEditorDrawer({
  state,
  exercise,
  type,
  onChange,
  onClose,
  onSave,
  onDelete,
}: {
  state: SetEditorState | null;
  exercise: WorkoutExercisePlanWithLog | null | undefined;
  type: WorkoutExerciseType;
  onChange: (draft: SetDraft) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const draft = state?.draft;

  return (
    <Drawer open={Boolean(state)} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[92vh] overflow-y-auto border-border bg-card px-4 pb-4">
        <DrawerHeader className="px-0 pb-2 text-left">
          <DrawerTitle>{exercise ? exercise.name : "Set"}</DrawerTitle>
        </DrawerHeader>

        {draft && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onChange({ ...draft, skipped: false })}
                className={chipClass(!draft.skipped)}
              >
                Logged
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...draft, skipped: true })}
                className={chipClass(draft.skipped)}
              >
                Skipped
              </button>
            </div>

            {type === "isometric" && <IsometricFields draft={draft} onChange={onChange} />}
            {type === "reps" && <RepFields draft={draft} onChange={onChange} />}
            {type === "assisted" && <AssistedFields draft={draft} onChange={onChange} />}
            {type === "accessory" && <AccessoryFields draft={draft} onChange={onChange} />}
            {type === "cardio" && <CardioFields draft={draft} onChange={onChange} />}
            {type === "notes" && <RepFields draft={draft} onChange={onChange} />}

            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="RPE"
                value={draft.rpe}
                onChange={(rpe) => onChange({ ...draft, rpe })}
              />
              <NumberField
                label="RIR"
                value={draft.rir}
                onChange={(rir) => onChange({ ...draft, rir })}
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Quality</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {qualityOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...draft,
                        quality: draft.quality === option.value ? "" : option.value,
                      })
                    }
                    className={chipClass(draft.quality === option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <ReasonPicker
              value={draft.changeReason}
              onChange={(changeReason) => onChange({ ...draft, changeReason })}
            />

            <Textarea
              value={draft.note}
              onChange={(event) => onChange({ ...draft, note: event.target.value })}
              placeholder="Set note"
              className="min-h-12 rounded-xl bg-input text-sm"
            />
          </div>
        )}

        <DrawerFooter className="px-0">
          <Button type="button" onClick={onSave}>
            Save set
          </Button>
          {state?.setIndex != null && (
            <Button type="button" variant="destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
              Delete set
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function IsometricFields({ draft, onChange }: FieldProps) {
  return (
    <div className="grid gap-3">
      <TextField
        label="Variation"
        value={draft.variation}
        onChange={(variation) => onChange({ ...draft, variation })}
      />
      <TextField
        label="Surface"
        value={draft.surface}
        onChange={(surface) => onChange({ ...draft, surface })}
      />
      <NumberField
        label="Seconds"
        value={draft.seconds}
        onChange={(seconds) => onChange({ ...draft, seconds })}
      />
    </div>
  );
}

function RepFields({ draft, onChange }: FieldProps) {
  return (
    <div className="grid gap-3">
      <TextField
        label="Variation"
        value={draft.variation}
        onChange={(variation) => onChange({ ...draft, variation })}
      />
      <TextField
        label="Load"
        value={draft.load}
        onChange={(load) => onChange({ ...draft, load })}
      />
      <NumberField
        label="Reps"
        value={draft.reps}
        onChange={(reps) => onChange({ ...draft, reps })}
      />
    </div>
  );
}

function AssistedFields({ draft, onChange }: FieldProps) {
  return (
    <div className="grid gap-3">
      <TextField
        label="Variation"
        value={draft.variation}
        onChange={(variation) => onChange({ ...draft, variation })}
      />
      <TextField
        label="Assistance"
        value={draft.assistance}
        onChange={(assistance) => onChange({ ...draft, assistance })}
      />
      <TextField
        label="ROM"
        value={draft.rangeOfMotion}
        onChange={(rangeOfMotion) => onChange({ ...draft, rangeOfMotion })}
      />
      <NumberField
        label="Reps"
        value={draft.reps}
        onChange={(reps) => onChange({ ...draft, reps })}
      />
    </div>
  );
}

function AccessoryFields({ draft, onChange }: FieldProps) {
  return (
    <div className="grid gap-3">
      <TextField
        label="Variation"
        value={draft.variation}
        onChange={(variation) => onChange({ ...draft, variation })}
      />
      <TextField
        label="Load"
        value={draft.load}
        onChange={(load) => onChange({ ...draft, load })}
      />
      <NumberField
        label="Reps"
        value={draft.reps}
        onChange={(reps) => onChange({ ...draft, reps })}
      />
    </div>
  );
}

function CardioFields({ draft, onChange }: FieldProps) {
  return (
    <div className="grid gap-3">
      <NumberField
        label="Duration min"
        value={draft.cardioDurationMinutes}
        onChange={(cardioDurationMinutes) => onChange({ ...draft, cardioDurationMinutes })}
      />
      <TextField
        label="Distance"
        value={draft.cardioDistance}
        onChange={(cardioDistance) => onChange({ ...draft, cardioDistance })}
      />
      <TextField
        label="Intensity"
        value={draft.intensity}
        onChange={(intensity) => onChange({ ...draft, intensity })}
      />
    </div>
  );
}

type FieldProps = {
  draft: SetDraft;
  onChange: (draft: SetDraft) => void;
};

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl bg-input"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl bg-input"
      />
    </label>
  );
}

function ReasonPicker({
  value,
  onChange,
}: {
  value: WorkoutChangeReason | "";
  onChange: (value: WorkoutChangeReason | "") => void;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">Reason</Label>
      <div className="mt-2 flex flex-wrap gap-2">
        {changeReasons.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(value === option.value ? "" : option.value)}
            className={chipClass(value === option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: WorkoutExerciseStatus | WorkoutSessionStatus }) {
  return (
    <Badge variant="secondary" className={`shrink-0 border ${statusBadgeClass(status)}`}>
      {statusLabel(status)}
    </Badge>
  );
}

function buildSessionDraft(session: WorkoutSessionLogWithExercises | null): SessionDraft {
  const painFlags = isRecord(session?.pain_flags) ? session.pain_flags : {};
  return {
    statusOverride:
      session?.status &&
      !["not_started", "in_progress", "partially_completed"].includes(session.status)
        ? session.status
        : "",
    durationMinutes: session?.duration_minutes == null ? "" : String(session.duration_minutes),
    rpe: session?.rpe == null ? "" : String(session.rpe),
    energy: session?.energy == null ? "" : String(session.energy),
    painFlags: {
      wrists: normalizePainFlag(painFlags.wrists),
      elbows: normalizePainFlag(painFlags.elbows),
      shoulders: normalizePainFlag(painFlags.shoulders),
      knees_legs: normalizePainFlag(painFlags.knees_legs),
    },
    notes: session?.notes ?? "",
  };
}

function buildExerciseDraft(exercise: WorkoutExercisePlanWithLog): ExerciseDraft {
  const log = exercise.log;
  const sets = log?.sets.length ? log.sets.map(setLogToDraft) : legacySetsToDrafts(log);
  return {
    actualName: log?.actual_name && log.actual_name !== exercise.name ? log.actual_name : "",
    isSwapping: Boolean(log?.actual_name && log.actual_name !== exercise.name),
    changeReason: log?.change_reason ?? "",
    notes: log?.notes ?? "",
    sets,
    expanded: sets.length > 0 || Boolean(log?.notes),
    explicitlySkipped: log?.status === "skipped",
  };
}

function emptySessionDraft(): SessionDraft {
  return {
    statusOverride: "",
    durationMinutes: "",
    rpe: "",
    energy: "",
    painFlags: {
      wrists: "fine",
      elbows: "fine",
      shoulders: "fine",
      knees_legs: "fine",
    },
    notes: "",
  };
}

function buildPrefilledSetDraft(
  exercise: WorkoutExercisePlanWithLog,
  type: WorkoutExerciseType,
  setIndex: number,
  previous?: SetDraft,
): SetDraft {
  const target = buildWorkoutTarget(exercise);
  const durationRange = parseTargetRange(target.duration);
  const repsRange = parseTargetRange(target.reps);
  const isCardio = type === "cardio";
  return {
    setIndex,
    variation: previous?.variation || target.variation || guessVariation(exercise.name),
    surface: previous?.surface || "",
    reps: previous?.reps || (repsRange && !isCardio ? formatNumber(repsRange.max) : ""),
    seconds:
      previous?.seconds || (durationRange && !isCardio ? formatNumber(durationRange.max) : ""),
    load: previous?.load || "",
    assistance: previous?.assistance || (type === "assisted" ? "light_band" : ""),
    rangeOfMotion: previous?.rangeOfMotion || (type === "assisted" ? "full" : ""),
    cardioDurationMinutes:
      previous?.cardioDurationMinutes ||
      (durationRange && isCardio ? formatNumber(durationRange.max) : ""),
    cardioDistance: previous?.cardioDistance || "",
    intensity: previous?.intensity || (isCardio ? "zone 2" : ""),
    rpe: previous?.rpe || "",
    rir: previous?.rir || "",
    quality: previous?.quality || "clean",
    skipped: false,
    changeReason: "",
    note: "",
  };
}

function setLogToDraft(set: WorkoutSetLog): SetDraft {
  return {
    setIndex: set.set_index,
    variation: set.variation ?? "",
    surface: set.surface ?? "",
    reps: set.reps == null ? "" : String(set.reps),
    seconds: set.seconds == null ? "" : String(set.seconds),
    load: set.load ?? "",
    assistance: set.assistance ?? "",
    rangeOfMotion: set.range_of_motion ?? "",
    cardioDurationMinutes:
      set.cardio_duration_minutes == null ? "" : String(set.cardio_duration_minutes),
    cardioDistance: set.cardio_distance ?? "",
    intensity: set.intensity ?? "",
    rpe: set.rpe == null ? "" : String(set.rpe),
    rir: set.rir == null ? "" : String(set.rir),
    quality: set.quality ?? "",
    skipped: set.skipped,
    changeReason: set.change_reason ?? "",
    note: set.note ?? "",
  };
}

function legacySetsToDrafts(log: WorkoutExercisePlanWithLog["log"]): SetDraft[] {
  if (!log || log.status === "not_started") return [];
  const count = log.completed_set_count ?? legacyChecklistCount(log.set_checklist);
  if (!count) return [];
  const durations = splitLegacyValues(log.actual_duration);
  const reps = splitLegacyValues(log.actual_reps);
  return Array.from({ length: count }, (_, index) => ({
    ...emptySetDraft(index + 1),
    variation: log.actual_variation ?? "",
    load: log.actual_load ?? "",
    seconds: parseSeconds(durations[index]) ?? "",
    reps: reps[index] ?? "",
    quality: "normal",
  }));
}

function emptySetDraft(setIndex: number): SetDraft {
  return {
    setIndex,
    variation: "",
    surface: "",
    reps: "",
    seconds: "",
    load: "",
    assistance: "",
    rangeOfMotion: "",
    cardioDurationMinutes: "",
    cardioDistance: "",
    intensity: "",
    rpe: "",
    rir: "",
    quality: "",
    skipped: false,
    changeReason: "",
    note: "",
  };
}

function getDraftExerciseStatus(exercise: WorkoutExercisePlanWithLog, draft: ExerciseDraft) {
  return calculateExerciseStatus({
    sets: draft.sets.map((set) => toSaveSet(set, set.setIndex, buildWorkoutTarget(exercise))),
    plannedSetCount: parseExactSetCount(exercise.planned_sets),
    plannedName: exercise.name,
    actualName: draft.actualName,
    changeReason: draft.changeReason || null,
    explicitlySkipped: draft.explicitlySkipped,
    target: buildWorkoutTarget(exercise),
  });
}

function toSaveSet(
  set: SetDraft,
  setIndex: number,
  target: WorkoutTarget,
  exerciseName?: string,
): SaveWorkoutSetInput {
  const labelPrefix = exerciseName ? `${exerciseName}, set ${setIndex}` : null;

  return {
    setIndex,
    plannedTarget: target as Json,
    variation: set.variation,
    surface: set.surface,
    reps: parseOptionalNumber(
      set.reps,
      labelPrefix ? { label: `${labelPrefix} reps`, min: 0 } : undefined,
    ),
    seconds: parseOptionalNumber(
      set.seconds,
      labelPrefix ? { label: `${labelPrefix} seconds`, min: 0 } : undefined,
    ),
    load: set.load,
    assistance: set.assistance,
    rangeOfMotion: set.rangeOfMotion,
    cardioDurationMinutes: parseOptionalNumber(
      set.cardioDurationMinutes,
      labelPrefix ? { label: `${labelPrefix} cardio minutes`, min: 0 } : undefined,
    ),
    cardioDistance: set.cardioDistance,
    intensity: set.intensity,
    rpe: parseOptionalNumber(
      set.rpe,
      labelPrefix ? { label: `${labelPrefix} RPE`, min: 1, max: 10 } : undefined,
    ),
    rir: parseOptionalNumber(
      set.rir,
      labelPrefix ? { label: `${labelPrefix} RIR`, min: 0 } : undefined,
    ),
    quality: set.quality || null,
    skipped: set.skipped,
    changeReason: set.changeReason || null,
    note: set.note,
  };
}

function renumberDraftSets(draft: ExerciseDraft): ExerciseDraft {
  return {
    ...draft,
    sets: draft.sets.map((set, index) => ({ ...set, setIndex: index + 1 })),
  };
}

function buildActualSummary(sets: SetDraft[], type: WorkoutExerciseType) {
  const performed = sets.filter(setHasActualWork);
  if (!performed.length) return "";
  if (type === "cardio") {
    return performed
      .map((set) =>
        [
          set.cardioDurationMinutes ? `${set.cardioDurationMinutes} min` : null,
          set.cardioDistance,
          set.intensity,
        ]
          .filter(Boolean)
          .join(" / "),
      )
      .filter(Boolean)
      .join(", ");
  }
  const values = performed.map((set) => {
    const core = set.seconds ? `${set.seconds}s` : set.reps ? `${set.reps} reps` : "logged";
    return [set.variation, set.surface || set.assistance || set.load, core]
      .filter(Boolean)
      .join(" / ");
  });
  return `${performed.length} sets - ${values.join(", ")}`;
}

function formatSetLine(set: SetDraft, type: WorkoutExerciseType) {
  if (set.skipped) return `skipped${set.changeReason ? ` / ${reasonLabel(set.changeReason)}` : ""}`;
  if (type === "cardio") {
    return [
      set.cardioDurationMinutes ? `${set.cardioDurationMinutes} min` : null,
      set.cardioDistance,
      set.intensity,
      set.rpe ? `RPE ${set.rpe}` : null,
    ]
      .filter(Boolean)
      .join(" / ");
  }
  return [
    set.variation,
    set.surface || set.assistance || set.load,
    set.seconds ? `${set.seconds}s` : null,
    set.reps ? `${set.reps} reps` : null,
    set.rangeOfMotion,
    set.rpe ? `RPE ${set.rpe}` : null,
    set.quality,
  ]
    .filter(Boolean)
    .join(" / ");
}

function targetText(exercise: WorkoutExercisePlanWithLog) {
  const first = [exercise.planned_sets, exercise.planned_reps || exercise.planned_duration].filter(
    Boolean,
  );
  if (first.length === 2) return `${first[0]} x ${first[1]}`;
  return (
    [
      exercise.planned_sets ? `${exercise.planned_sets} sets` : null,
      exercise.planned_reps ? `${exercise.planned_reps} reps` : null,
      exercise.planned_duration,
      exercise.planned_tempo,
      exercise.planned_variation,
    ]
      .filter(Boolean)
      .join(" · ") || "Open"
  );
}

function compactBlockSummary(title: string, notes: string | null) {
  if (!notes) return title;
  const compactNotes = notes
    .replace(/\bmin\./i, "min:")
    .replace(/\s+/g, " ")
    .trim();
  return `${title}: ${compactNotes}`;
}

function parseOptionalNumber(
  value: string,
  rules?: { label: string; min?: number; max?: number; integer?: boolean },
) {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const number = Number(trimmed);
  if (!Number.isFinite(number)) {
    if (!rules) return null;
    throw new Error(`${rules.label} must be a number`);
  }
  if (!rules) return number;
  if (rules.integer && !Number.isInteger(number)) {
    throw new Error(`${rules.label} must be a whole number`);
  }
  if (rules.min != null && number < rules.min) {
    throw new Error(`${rules.label} must be at least ${rules.min}`);
  }
  if (rules.max != null && number > rules.max) {
    throw new Error(`${rules.label} must be ${rules.max} or less`);
  }
  return number;
}

function isDateValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function setHasActualWork(set: SetDraft) {
  return Boolean(
    !set.skipped &&
    (set.seconds.trim() ||
      set.reps.trim() ||
      set.cardioDurationMinutes.trim() ||
      set.variation.trim() ||
      set.load.trim()),
  );
}

function legacyChecklistCount(value: Json) {
  return Array.isArray(value) ? value.filter(Boolean).length : 0;
}

function splitLegacyValues(value: string | null) {
  return (
    value
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? []
  );
}

function parseSeconds(value: string | undefined) {
  const match = value?.match(/(\d+(?:\.\d+)?)/);
  return match ? match[1] : "";
}

function normalizePainFlag(value: unknown): PainState {
  return value === "tight" || value === "painful" ? value : "fine";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function guessVariation(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("tuck")) return "tuck";
  if (lower.includes("advanced tuck")) return "advanced tuck";
  if (lower.includes("one-leg")) return "one-leg";
  if (lower.includes("straddle")) return "straddle";
  return "";
}

function statusLabel(status: WorkoutExerciseStatus | WorkoutSessionStatus) {
  return status
    .replace("completed_as_planned", "planned")
    .replace("completed_modified", "modified")
    .replace("partially_completed", "partial")
    .replace(/_/g, " ");
}

function reasonLabel(reason: WorkoutChangeReason) {
  return changeReasons.find((option) => option.value === reason)?.label ?? reason;
}

function dotClass(status: WorkoutSessionStatus) {
  if (status === "completed") return "bg-primary";
  if (status === "modified" || status === "partially_completed" || status === "in_progress") {
    return "bg-amber-300";
  }
  if (status === "cut_short" || status === "skipped") return "bg-destructive";
  return "bg-muted-foreground/40";
}

function statusBadgeClass(status: WorkoutExerciseStatus | WorkoutSessionStatus) {
  if (status === "completed" || status === "completed_as_planned") {
    return "border-primary/40 bg-primary/15 text-primary";
  }
  if (
    status === "modified" ||
    status === "completed_modified" ||
    status === "overperformed" ||
    status === "substituted"
  ) {
    return "border-amber-300/40 bg-amber-300/10 text-amber-200";
  }
  if (status === "partial" || status === "cut_short" || status === "skipped") {
    return "border-destructive/50 bg-destructive/10 text-destructive";
  }
  return "border-border bg-secondary text-muted-foreground";
}

function chipClass(active: boolean) {
  return [
    "h-8 rounded-xl px-3 text-sm font-medium transition-colors",
    active
      ? "bg-primary text-primary-foreground"
      : "bg-secondary text-muted-foreground hover:text-foreground",
  ].join(" ");
}

function smallChipClass(active: boolean) {
  return [
    "h-7 rounded-lg px-2 text-xs font-medium transition-colors",
    active
      ? "bg-primary text-primary-foreground"
      : "bg-secondary text-muted-foreground hover:text-foreground",
  ].join(" ");
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}
