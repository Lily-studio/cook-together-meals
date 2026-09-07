CREATE TABLE public.pantry_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Pantry',
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'g',
  low_threshold numeric NOT NULL DEFAULT 0,
  staple boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pantry_items TO authenticated;
GRANT ALL ON public.pantry_items TO service_role;

ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY pantry_all ON public.pantry_items FOR ALL TO authenticated
  USING (household_id = current_household())
  WITH CHECK (household_id = current_household());

CREATE TRIGGER pantry_touch BEFORE UPDATE ON public.pantry_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE UNIQUE INDEX pantry_items_household_name_idx
  ON public.pantry_items (household_id, lower(name));

ALTER TABLE public.households ADD COLUMN monthly_budget numeric;