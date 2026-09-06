ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS goal_weight_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS ingredient_rules JSONB NOT NULL DEFAULT '{}'::jsonb;