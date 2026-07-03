ALTER TABLE public.workout_sets
  DROP CONSTRAINT IF EXISTS workout_sets_quality_check;

ALTER TABLE public.workout_sets
  ADD CONSTRAINT workout_sets_quality_check
  CHECK (
    quality IS NULL OR quality IN (
      'clean',
      'okay',
      'normal',
      'mid',
      'bad',
      'shaky',
      'grindy',
      'bad_line',
      'technical_fail',
      'failed',
      'pain'
    )
  );
