DROP POLICY "logs_write" ON public.food_logs;
DROP POLICY "logs_update" ON public.food_logs;
DROP POLICY "logs_delete" ON public.food_logs;
CREATE POLICY "logs_write" ON public.food_logs FOR INSERT TO authenticated
  WITH CHECK (household_id = public.current_household());
CREATE POLICY "logs_update" ON public.food_logs FOR UPDATE TO authenticated
  USING (household_id = public.current_household());
CREATE POLICY "logs_delete" ON public.food_logs FOR DELETE TO authenticated
  USING (household_id = public.current_household());

DROP POLICY "fav_insert" ON public.favorites;
DROP POLICY "fav_delete" ON public.favorites;
CREATE POLICY "fav_insert" ON public.favorites FOR INSERT TO authenticated
  WITH CHECK (household_id = public.current_household());
CREATE POLICY "fav_delete" ON public.favorites FOR DELETE TO authenticated
  USING (household_id = public.current_household());