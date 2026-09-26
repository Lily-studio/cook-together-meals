CREATE TABLE public.lily_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  kind text NOT NULL,
  summary text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  undo jsonb NOT NULL DEFAULT '[]'::jsonb,
  undone boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.lily_action_log TO authenticated;
GRANT ALL ON public.lily_action_log TO service_role;
ALTER TABLE public.lily_action_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY lily_log_select ON public.lily_action_log FOR SELECT TO authenticated USING (household_id = public.current_household());
CREATE POLICY lily_log_insert ON public.lily_action_log FOR INSERT TO authenticated WITH CHECK (household_id = public.current_household() AND profile_id = auth.uid());
CREATE POLICY lily_log_update ON public.lily_action_log FOR UPDATE TO authenticated USING (household_id = public.current_household());
CREATE INDEX lily_action_log_household_idx ON public.lily_action_log (household_id, created_at DESC);