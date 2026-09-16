ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cooking_method text NOT NULL DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS cooking_method_note text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS prefer_more text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS lily_notes text[] NOT NULL DEFAULT '{}'::text[];

UPDATE public.profiles SET cooking_method = 'monsieur_cuisine' WHERE cooking_method = 'regular';