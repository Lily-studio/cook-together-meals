ALTER TABLE public.meal_plan_entries
  ADD COLUMN IF NOT EXISTS swaps JSONB NOT NULL DEFAULT '{}'::jsonb;