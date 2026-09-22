-- Real life: eating out, away, working late, guests, not home
CREATE TABLE public.household_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  event_date date NOT NULL,
  slot text,
  kind text NOT NULL DEFAULT 'other',
  guests integer NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_events TO authenticated;
GRANT ALL ON public.household_events TO service_role;
ALTER TABLE public.household_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_all" ON public.household_events FOR ALL TO authenticated
  USING (household_id = current_household()) WITH CHECK (household_id = current_household());

CREATE INDEX household_events_date_idx ON public.household_events (household_id, event_date);
CREATE TRIGGER events_touch BEFORE UPDATE ON public.household_events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- What actually worked?
CREATE TABLE public.meal_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  recipe_id uuid REFERENCES public.recipes(id) ON DELETE CASCADE,
  plan_date date,
  slot text,
  rating text NOT NULL DEFAULT 'okay',
  note text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_feedback TO authenticated;
GRANT ALL ON public.meal_feedback TO service_role;
ALTER TABLE public.meal_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feedback_all" ON public.meal_feedback FOR ALL TO authenticated
  USING (household_id = current_household()) WITH CHECK (household_id = current_household());

CREATE UNIQUE INDEX meal_feedback_unique_idx
  ON public.meal_feedback (household_id, profile_id, recipe_id, plan_date, slot);
CREATE TRIGGER feedback_touch BEFORE UPDATE ON public.meal_feedback
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Shared household: messages to Lily from anyone in the house
CREATE TABLE public.household_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  from_name text NOT NULL DEFAULT '',
  about_profile uuid,
  message text NOT NULL,
  handled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_notes TO authenticated;
GRANT ALL ON public.household_notes TO service_role;
ALTER TABLE public.household_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes_all" ON public.household_notes FOR ALL TO authenticated
  USING (household_id = current_household()) WITH CHECK (household_id = current_household());

CREATE TRIGGER household_notes_touch BEFORE UPDATE ON public.household_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();