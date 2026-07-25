ALTER TABLE public.daily_log_items
  ADD COLUMN IF NOT EXISTS meal_instance_id UUID;

CREATE INDEX IF NOT EXISTS daily_log_items_meal_instance_idx
  ON public.daily_log_items(daily_log_id, meal_instance_id)
  WHERE meal_instance_id IS NOT NULL;
