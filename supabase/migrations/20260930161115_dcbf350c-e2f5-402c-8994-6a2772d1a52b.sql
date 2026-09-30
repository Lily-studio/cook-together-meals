ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS recipes_active_idx ON public.recipes (household_id) WHERE archived_at IS NULL;