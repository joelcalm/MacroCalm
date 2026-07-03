CREATE TABLE public.workout_weekly_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  source_plan_id UUID REFERENCES public.workout_plans(id) ON DELETE SET NULL,
  draft_plan_id UUID REFERENCES public.workout_plans(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'draft_created', 'archived')),
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  review_markdown TEXT NOT NULL DEFAULT '',
  draft_plan_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start_date)
);

CREATE INDEX workout_weekly_reviews_user_week_idx
  ON public.workout_weekly_reviews(user_id, week_start_date DESC);

ALTER TABLE public.workout_weekly_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own workout weekly reviews select" ON public.workout_weekly_reviews
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "own workout weekly reviews insert" ON public.workout_weekly_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own workout weekly reviews update" ON public.workout_weekly_reviews
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own workout weekly reviews delete" ON public.workout_weekly_reviews
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER workout_weekly_reviews_updated
  BEFORE UPDATE ON public.workout_weekly_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
