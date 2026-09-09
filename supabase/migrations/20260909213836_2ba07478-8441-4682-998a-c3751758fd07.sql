ALTER TABLE public.pantry_items
  ADD COLUMN IF NOT EXISTS opened_on date,
  ADD COLUMN IF NOT EXISTS expires_on date;

CREATE TABLE public.ingredient_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'g',
  pack_size numeric NOT NULL DEFAULT 100,
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'MAD',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (household_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingredient_prices TO authenticated;
GRANT ALL ON public.ingredient_prices TO service_role;

ALTER TABLE public.ingredient_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY prices_all ON public.ingredient_prices
  FOR ALL TO authenticated
  USING (household_id = current_household())
  WITH CHECK (household_id = current_household());

CREATE TRIGGER touch_ingredient_prices
  BEFORE UPDATE ON public.ingredient_prices
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();