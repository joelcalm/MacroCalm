ALTER TABLE public.workout_session_logs
  DROP CONSTRAINT IF EXISTS workout_session_logs_status_check;

ALTER TABLE public.workout_session_logs
  ADD CONSTRAINT workout_session_logs_status_check
  CHECK (
    status IN (
      'not_started',
      'in_progress',
      'completed',
      'partially_completed',
      'modified',
      'cut_short',
      'skipped'
    )
  );

ALTER TABLE public.workout_session_logs
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS energy INTEGER CHECK (energy IS NULL OR energy BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS pain_flags JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.workout_exercise_logs
  DROP CONSTRAINT IF EXISTS workout_exercise_logs_status_check;

ALTER TABLE public.workout_exercise_logs
  ADD CONSTRAINT workout_exercise_logs_status_check
  CHECK (
    status IN (
      'not_started',
      'in_progress',
      'completed',
      'partial',
      'skipped',
      'completed_as_planned',
      'completed_modified',
      'substituted',
      'overperformed'
    )
  );

ALTER TABLE public.workout_exercise_logs
  ADD COLUMN IF NOT EXISTS planned_name TEXT,
  ADD COLUMN IF NOT EXISTS actual_name TEXT,
  ADD COLUMN IF NOT EXISTS order_index INTEGER,
  ADD COLUMN IF NOT EXISTS exercise_type TEXT CHECK (
    exercise_type IS NULL OR exercise_type IN (
      'isometric',
      'reps',
      'assisted',
      'accessory',
      'cardio',
      'notes'
    )
  ),
  ADD COLUMN IF NOT EXISTS target JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rest_target TEXT,
  ADD COLUMN IF NOT EXISTS change_reason TEXT CHECK (
    change_reason IS NULL OR change_reason IN (
      'fatigue',
      'pain',
      'time',
      'felt_strong',
      'equipment',
      'other'
    )
  );

CREATE TABLE IF NOT EXISTS public.workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_exercise_log_id UUID NOT NULL REFERENCES public.workout_exercise_logs(id) ON DELETE CASCADE,
  set_index INTEGER NOT NULL CHECK (set_index > 0),
  planned_target JSONB NOT NULL DEFAULT '{}'::jsonb,
  variation TEXT,
  surface TEXT,
  reps NUMERIC CHECK (reps IS NULL OR reps >= 0),
  seconds NUMERIC CHECK (seconds IS NULL OR seconds >= 0),
  load TEXT,
  assistance TEXT,
  range_of_motion TEXT,
  cardio_duration_minutes NUMERIC CHECK (
    cardio_duration_minutes IS NULL OR cardio_duration_minutes >= 0
  ),
  cardio_distance TEXT,
  intensity TEXT,
  rpe NUMERIC CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10)),
  rir NUMERIC CHECK (rir IS NULL OR rir >= 0),
  quality TEXT CHECK (
    quality IS NULL OR quality IN (
      'clean',
      'okay',
      'normal',
      'shaky',
      'grindy',
      'bad_line',
      'technical_fail',
      'failed',
      'pain'
    )
  ),
  skipped BOOLEAN NOT NULL DEFAULT false,
  change_reason TEXT CHECK (
    change_reason IS NULL OR change_reason IN (
      'fatigue',
      'pain',
      'time',
      'felt_strong',
      'equipment',
      'other'
    )
  ),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_exercise_log_id, set_index)
);

CREATE INDEX IF NOT EXISTS workout_sets_exercise_idx
  ON public.workout_sets(session_exercise_log_id, set_index);

ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own workout sets select" ON public.workout_sets FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workout_exercise_logs e
      JOIN public.workout_session_logs s ON s.id = e.session_log_id
      WHERE e.id = session_exercise_log_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "own workout sets insert" ON public.workout_sets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.workout_exercise_logs e
      JOIN public.workout_session_logs s ON s.id = e.session_log_id
      WHERE e.id = session_exercise_log_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "own workout sets update" ON public.workout_sets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.workout_exercise_logs e
      JOIN public.workout_session_logs s ON s.id = e.session_log_id
      WHERE e.id = session_exercise_log_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.workout_exercise_logs e
      JOIN public.workout_session_logs s ON s.id = e.session_log_id
      WHERE e.id = session_exercise_log_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "own workout sets delete" ON public.workout_sets FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.workout_exercise_logs e
      JOIN public.workout_session_logs s ON s.id = e.session_log_id
      WHERE e.id = session_exercise_log_id AND s.user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS workout_sets_updated ON public.workout_sets;
CREATE TRIGGER workout_sets_updated
  BEFORE UPDATE ON public.workout_sets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
