-- Personal Meal Book recipes
ALTER TABLE public.recipes
  ADD COLUMN household_id uuid REFERENCES public.households(id) ON DELETE CASCADE,
  ADD COLUMN image_url text,
  ADD COLUMN equipment text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN created_by uuid,
  ADD COLUMN source text NOT NULL DEFAULT 'lily';

-- Security: keep the definer helper out of the exposed schema
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;
CREATE OR REPLACE FUNCTION private.current_household()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT household_id FROM public.profiles WHERE id = auth.uid()
$$;
REVOKE ALL ON FUNCTION private.current_household() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_household() TO authenticated;

CREATE OR REPLACE FUNCTION public.current_household()
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT private.current_household()
$$;
REVOKE ALL ON FUNCTION public.current_household() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_household() TO authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS recipes_public_read ON public.recipes;
CREATE POLICY recipes_catalog_read ON public.recipes FOR SELECT TO anon, authenticated USING (household_id IS NULL);
CREATE POLICY recipes_household_read ON public.recipes FOR SELECT TO authenticated USING (household_id = public.current_household());
CREATE POLICY recipes_household_insert ON public.recipes FOR INSERT TO authenticated WITH CHECK (household_id = public.current_household() AND created_by = auth.uid());
CREATE POLICY recipes_household_update ON public.recipes FOR UPDATE TO authenticated USING (household_id = public.current_household()) WITH CHECK (household_id = public.current_household());
CREATE POLICY recipes_household_delete ON public.recipes FOR DELETE TO authenticated USING (household_id = public.current_household());
GRANT SELECT ON public.recipes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipes TO authenticated;
GRANT ALL ON public.recipes TO service_role;

-- Lily conversations (kept until closed)
CREATE TABLE public.lily_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  turns jsonb NOT NULL DEFAULT '[]'::jsonb,
  closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.lily_conversations TO authenticated;
GRANT ALL ON public.lily_conversations TO service_role;
ALTER TABLE public.lily_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY convo_select ON public.lily_conversations FOR SELECT TO authenticated USING (profile_id = auth.uid());
CREATE POLICY convo_insert ON public.lily_conversations FOR INSERT TO authenticated WITH CHECK (profile_id = auth.uid() AND household_id = public.current_household());
CREATE POLICY convo_update ON public.lily_conversations FOR UPDATE TO authenticated USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
CREATE TRIGGER convo_touch BEFORE UPDATE ON public.lily_conversations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Image storage policies (bucket created separately)
CREATE POLICY lily_images_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lily-images' AND (storage.foldername(name))[1] = public.current_household()::text);
CREATE POLICY lily_images_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lily-images' AND (storage.foldername(name))[1] = public.current_household()::text);