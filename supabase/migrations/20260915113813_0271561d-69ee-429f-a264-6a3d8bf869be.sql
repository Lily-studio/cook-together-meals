DELETE FROM public.pantry_items p
USING public.pantry_items q
WHERE p.household_id = q.household_id
  AND lower(p.name) = lower(q.name)
  AND p.ctid > q.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS pantry_items_household_name_key
  ON public.pantry_items (household_id, name);