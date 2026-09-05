-- HOUSEHOLDS
CREATE TABLE public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Our Kitchen',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.households TO authenticated;
GRANT ALL ON public.households TO service_role;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  accent text NOT NULL DEFAULT 'caramel',
  is_owner boolean NOT NULL DEFAULT true,
  goal text NOT NULL DEFAULT 'maintain',
  activity_level text NOT NULL DEFAULT 'moderate',
  sex text,
  age integer,
  height_cm numeric,
  weight_kg numeric,
  calorie_target integer NOT NULL DEFAULT 2000,
  protein_target integer NOT NULL DEFAULT 120,
  carb_target integer NOT NULL DEFAULT 220,
  fat_target integer NOT NULL DEFAULT 65,
  diet_prefs text[] NOT NULL DEFAULT '{}',
  allergies text[] NOT NULL DEFAULT '{}',
  disliked text[] NOT NULL DEFAULT '{}',
  onboarding_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_household()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT household_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE POLICY "households_select" ON public.households FOR SELECT TO authenticated
  USING (id = public.current_household());
CREATE POLICY "households_insert" ON public.households FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "households_update" ON public.households FOR UPDATE TO authenticated
  USING (id = public.current_household());

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR household_id = public.current_household());
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR household_id = public.current_household());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR household_id = public.current_household());
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE TO authenticated
  USING (household_id = public.current_household() AND id <> auth.uid());

-- RECIPES
CREATE TABLE public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  tagline text NOT NULL DEFAULT '',
  cuisine text NOT NULL DEFAULT 'Moroccan',
  meal_types text[] NOT NULL DEFAULT '{dinner}',
  emoji text NOT NULL DEFAULT '🍲',
  base_servings integer NOT NULL DEFAULT 2,
  prep_minutes integer NOT NULL DEFAULT 10,
  cook_minutes integer NOT NULL DEFAULT 20,
  difficulty text NOT NULL DEFAULT 'easy',
  ingredients jsonb NOT NULL DEFAULT '[]',
  steps jsonb NOT NULL DEFAULT '[]',
  calories integer NOT NULL DEFAULT 0,
  protein integer NOT NULL DEFAULT 0,
  carbs integer NOT NULL DEFAULT 0,
  fat integer NOT NULL DEFAULT 0,
  fiber integer NOT NULL DEFAULT 0,
  tags text[] NOT NULL DEFAULT '{}',
  prep_friendly boolean NOT NULL DEFAULT false,
  lily_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.recipes TO anon;
GRANT SELECT ON public.recipes TO authenticated;
GRANT ALL ON public.recipes TO service_role;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipes_public_read" ON public.recipes FOR SELECT TO anon, authenticated USING (true);

-- MEAL PLAN
CREATE TABLE public.meal_plan_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  plan_date date NOT NULL,
  slot text NOT NULL,
  recipe_id uuid REFERENCES public.recipes(id) ON DELETE SET NULL,
  custom_title text,
  portions jsonb NOT NULL DEFAULT '{}',
  cooked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, plan_date, slot)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_plan_entries TO authenticated;
GRANT ALL ON public.meal_plan_entries TO service_role;
ALTER TABLE public.meal_plan_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_all" ON public.meal_plan_entries FOR ALL TO authenticated
  USING (household_id = public.current_household())
  WITH CHECK (household_id = public.current_household());

-- FOOD LOGS
CREATE TABLE public.food_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  slot text NOT NULL DEFAULT 'snack',
  description text NOT NULL,
  calories integer NOT NULL DEFAULT 0,
  protein integer NOT NULL DEFAULT 0,
  carbs integer NOT NULL DEFAULT 0,
  fat integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'tell_lily',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_logs TO authenticated;
GRANT ALL ON public.food_logs TO service_role;
ALTER TABLE public.food_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs_select" ON public.food_logs FOR SELECT TO authenticated
  USING (household_id = public.current_household());
CREATE POLICY "logs_write" ON public.food_logs FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid() AND household_id = public.current_household());
CREATE POLICY "logs_update" ON public.food_logs FOR UPDATE TO authenticated
  USING (profile_id = auth.uid());
CREATE POLICY "logs_delete" ON public.food_logs FOR DELETE TO authenticated
  USING (profile_id = auth.uid());

-- FAVORITES
CREATE TABLE public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, recipe_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fav_select" ON public.favorites FOR SELECT TO authenticated
  USING (household_id = public.current_household());
CREATE POLICY "fav_insert" ON public.favorites FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid() AND household_id = public.current_household());
CREATE POLICY "fav_delete" ON public.favorites FOR DELETE TO authenticated
  USING (profile_id = auth.uid());

-- GROCERY
CREATE TABLE public.grocery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  name text NOT NULL,
  amount text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Other',
  checked boolean NOT NULL DEFAULT false,
  manual boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grocery_items TO authenticated;
GRANT ALL ON public.grocery_items TO service_role;
ALTER TABLE public.grocery_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grocery_all" ON public.grocery_items FOR ALL TO authenticated
  USING (household_id = public.current_household())
  WITH CHECK (household_id = public.current_household());

-- SIGNUP TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_household uuid;
BEGIN
  INSERT INTO public.households (name) VALUES ('Our Kitchen') RETURNING id INTO new_household;
  INSERT INTO public.profiles (id, household_id, display_name)
  VALUES (NEW.id, new_household, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- SEED RECIPES
INSERT INTO public.recipes (slug, title, tagline, cuisine, meal_types, emoji, base_servings, prep_minutes, cook_minutes, difficulty, ingredients, steps, calories, protein, carbs, fat, fiber, tags, prep_friendly, lily_note) VALUES
('chicken-olive-tagine','Chicken & Olive Tagine','Lemony, slow-simmered, deeply comforting.','Moroccan','{dinner}','🍗',2,15,45,'medium',
 '[{"name":"Chicken thighs","amount":"400 g","category":"Meat"},{"name":"Green olives","amount":"80 g","category":"Pantry"},{"name":"Preserved lemon","amount":"1/2","category":"Pantry"},{"name":"Onion","amount":"1 large","category":"Produce"},{"name":"Garlic","amount":"3 cloves","category":"Produce"},{"name":"Ginger, ground","amount":"1 tsp","category":"Spices"},{"name":"Turmeric","amount":"1 tsp","category":"Spices"},{"name":"Coriander, fresh","amount":"1 handful","category":"Produce"},{"name":"Olive oil","amount":"1 tbsp","category":"Pantry"}]',
 '["Grate the onion and garlic, then rub the chicken with ginger, turmeric, salt and olive oil.","Sear the chicken in a tagine or heavy pot for 4 minutes per side.","Add onion, garlic and a cup of water. Cover and simmer 30 minutes.","Stir in olives and preserved lemon, simmer 10 more minutes uncovered to thicken.","Finish with fresh coriander and serve with bread."]',
 520,42,18,30,4,'{"high-protein","gluten-free","one-pot"}',true,'This one reheats beautifully — cook once, eat twice.'),
('harira-lentil-soup','Harira Lentil Soup','The soup that warms every Ramadan table.','Moroccan','{lunch,dinner}','🥣',4,10,35,'easy',
 '[{"name":"Brown lentils","amount":"200 g","category":"Pantry"},{"name":"Chopped tomatoes","amount":"400 g tin","category":"Pantry"},{"name":"Chickpeas","amount":"240 g tin","category":"Pantry"},{"name":"Celery","amount":"2 sticks","category":"Produce"},{"name":"Onion","amount":"1","category":"Produce"},{"name":"Ras el hanout","amount":"2 tsp","category":"Spices"},{"name":"Vermicelli","amount":"50 g","category":"Pantry"},{"name":"Parsley & coriander","amount":"1 bunch","category":"Produce"}]',
 '["Soften onion and celery in a little olive oil for 5 minutes.","Add ras el hanout, tomatoes, lentils, chickpeas and 1.2 L water.","Simmer 25 minutes until lentils are tender.","Add vermicelli and cook 5 minutes more.","Stir through a big handful of chopped herbs and a squeeze of lemon."]',
 310,17,48,6,12,'{"vegetarian","high-fiber","budget"}',true,'Freezes in portions — your future self says thank you.'),
('kefta-mkaouara','Kefta Mkaouara','Meatballs poached in spiced tomato with an egg on top.','Moroccan','{dinner}','🍅',2,15,25,'medium',
 '[{"name":"Beef mince","amount":"300 g","category":"Meat"},{"name":"Chopped tomatoes","amount":"400 g tin","category":"Pantry"},{"name":"Eggs","amount":"2","category":"Dairy"},{"name":"Cumin","amount":"1 tsp","category":"Spices"},{"name":"Paprika","amount":"1 tsp","category":"Spices"},{"name":"Garlic","amount":"2 cloves","category":"Produce"},{"name":"Parsley","amount":"1 handful","category":"Produce"}]',
 '["Mix mince with cumin, half the paprika, garlic, parsley and salt. Roll small meatballs.","Simmer tomatoes with the rest of the spices for 8 minutes.","Nestle meatballs into the sauce, cover and cook 12 minutes.","Crack the eggs on top, cover and cook until just set.","Serve straight from the pan with bread."]',
 480,38,16,29,3,'{"high-protein","one-pot"}',false,'Make the sauce ahead and dinner is 12 minutes away.'),
('zaalouk','Zaalouk Aubergine Salad','Smoky aubergine and tomato, cooked down to silk.','Moroccan','{lunch,side}','🍆',4,10,25,'easy',
 '[{"name":"Aubergine","amount":"2 medium","category":"Produce"},{"name":"Tomatoes","amount":"4","category":"Produce"},{"name":"Garlic","amount":"3 cloves","category":"Produce"},{"name":"Cumin","amount":"1 tsp","category":"Spices"},{"name":"Paprika","amount":"1 tsp","category":"Spices"},{"name":"Olive oil","amount":"2 tbsp","category":"Pantry"},{"name":"Coriander","amount":"1 handful","category":"Produce"}]',
 '["Peel and cube the aubergine, grate the tomatoes.","Cook everything together with garlic, spices and oil over low heat, covered, 20 minutes.","Mash with a fork and cook uncovered until thick and glossy.","Cool slightly, finish with coriander and lemon."]',
 160,3,14,11,6,'{"vegan","low-calorie","make-ahead"}',true,'Keeps 4 days in the fridge and tastes better on day two.'),
('msemen-eggs','Msemen with Soft Eggs','Flaky layers, honey on the side, weekend energy.','Moroccan','{breakfast}','🥞',2,15,15,'medium',
 '[{"name":"Flour","amount":"250 g","category":"Pantry"},{"name":"Fine semolina","amount":"50 g","category":"Pantry"},{"name":"Eggs","amount":"4","category":"Dairy"},{"name":"Butter","amount":"30 g","category":"Dairy"},{"name":"Honey","amount":"2 tbsp","category":"Pantry"}]',
 '["Knead flour, semolina, salt and warm water into a soft dough. Rest 20 minutes.","Flatten oiled balls, fold into squares and pan-fry until golden and layered.","Soft-scramble the eggs in butter.","Serve msemen warm with eggs and a drizzle of honey."]',
 540,20,62,22,3,'{"weekend","comfort"}',false,'Fold the dough the night before and fry fresh in the morning.'),
('avocado-date-smoothie','Avocado & Date Smoothie','Creamy, naturally sweet, ready in three minutes.','Moroccan','{breakfast,snack}','🥑',2,5,0,'easy',
 '[{"name":"Avocado","amount":"1","category":"Produce"},{"name":"Medjool dates","amount":"4","category":"Produce"},{"name":"Milk","amount":"400 ml","category":"Dairy"},{"name":"Orange blossom water","amount":"1/2 tsp","category":"Pantry"},{"name":"Almonds","amount":"20 g","category":"Pantry"}]',
 '["Pit the dates and soak in warm milk for 2 minutes.","Blend everything until completely smooth.","Pour over ice and top with chopped almonds."]',
 330,10,38,17,7,'{"quick","no-cook","vegetarian"}',false,'Use frozen avocado chunks for an instant thick shake.'),
('grilled-sardines','Charmoula Grilled Sardines','Bright herb marinade, five minutes on the heat.','Moroccan','{lunch,dinner}','🐟',2,15,10,'easy',
 '[{"name":"Sardines","amount":"6 whole","category":"Fish"},{"name":"Coriander & parsley","amount":"1 bunch","category":"Produce"},{"name":"Garlic","amount":"3 cloves","category":"Produce"},{"name":"Cumin","amount":"1 tsp","category":"Spices"},{"name":"Paprika","amount":"1 tsp","category":"Spices"},{"name":"Lemon","amount":"1","category":"Produce"},{"name":"Olive oil","amount":"2 tbsp","category":"Pantry"}]',
 '["Blitz herbs, garlic, spices, lemon juice and oil into charmoula.","Coat the cleaned sardines and marinate 20 minutes.","Grill 4-5 minutes per side until the skin blisters.","Serve with extra charmoula and a tomato salad."]',
 380,34,4,25,1,'{"high-protein","omega-3","low-carb"}',false,'Charmoula keeps a week — make a jar and use it on everything.'),
('chicken-couscous','Friday Chicken Couscous','Seven vegetables, one steaming platter.','Moroccan','{lunch,dinner}','🍛',4,20,60,'medium',
 '[{"name":"Chicken legs","amount":"4","category":"Meat"},{"name":"Couscous","amount":"400 g","category":"Pantry"},{"name":"Carrots","amount":"3","category":"Produce"},{"name":"Courgette","amount":"2","category":"Produce"},{"name":"Turnip","amount":"1","category":"Produce"},{"name":"Pumpkin","amount":"300 g","category":"Produce"},{"name":"Chickpeas","amount":"240 g tin","category":"Pantry"},{"name":"Ras el hanout","amount":"2 tsp","category":"Spices"}]',
 '["Brown chicken with onion and spices in the base of a couscoussier.","Add water and hard vegetables, simmer 30 minutes.","Steam the couscous in the top, fluffing with water and oil twice.","Add soft vegetables and chickpeas for the last 15 minutes.","Mound the couscous, top with vegetables and broth."]',
 620,40,72,18,9,'{"family","batch-cook"}',true,'Leftover couscous makes a brilliant next-day salad.'),
('lily-oat-bowl','Lily''s Cinnamon Oat Bowl','Warm oats, dates, and a spoon of almond butter.','Moroccan','{breakfast}','🥣',2,5,8,'easy',
 '[{"name":"Rolled oats","amount":"100 g","category":"Pantry"},{"name":"Milk","amount":"400 ml","category":"Dairy"},{"name":"Dates","amount":"4","category":"Produce"},{"name":"Cinnamon","amount":"1 tsp","category":"Spices"},{"name":"Almond butter","amount":"2 tbsp","category":"Pantry"},{"name":"Banana","amount":"1","category":"Produce"}]',
 '["Simmer oats with milk and cinnamon for 6 minutes, stirring.","Chop the dates and banana and stir half through.","Top with the rest plus a swirl of almond butter."]',
 420,14,58,15,8,'{"quick","vegetarian","high-fiber"}',true,'Make overnight oats with the same amounts — no cooking at all.'),
('rfissa-lite','Lighter Rfissa Bowl','Lentils, fenugreek and shredded chicken over msemen.','Moroccan','{dinner}','🌿',4,20,45,'medium',
 '[{"name":"Chicken breast","amount":"500 g","category":"Meat"},{"name":"Green lentils","amount":"150 g","category":"Pantry"},{"name":"Fenugreek seeds","amount":"1 tbsp","category":"Spices"},{"name":"Onions","amount":"3","category":"Produce"},{"name":"Ras el hanout","amount":"2 tsp","category":"Spices"},{"name":"Msemen or bread","amount":"4 pieces","category":"Bakery"}]',
 '["Soak the fenugreek in warm water for 20 minutes.","Simmer chicken with sliced onions, lentils, fenugreek and spices for 40 minutes.","Shred the chicken and reduce the broth until saucy.","Tear the bread into a bowl and ladle everything over."]',
 560,46,55,15,10,'{"high-protein","comfort"}',true,'Halve the bread and double the lentils for a lighter bowl.'),
('carrot-orange-salad','Carrot & Orange Salad','Cold, sweet, orange-blossom bright.','Moroccan','{lunch,side,snack}','🥕',4,10,0,'easy',
 '[{"name":"Carrots","amount":"4","category":"Produce"},{"name":"Oranges","amount":"2","category":"Produce"},{"name":"Orange blossom water","amount":"1 tsp","category":"Pantry"},{"name":"Cinnamon","amount":"1/2 tsp","category":"Spices"},{"name":"Raisins","amount":"30 g","category":"Pantry"}]',
 '["Grate the carrots and segment the oranges.","Toss with orange juice, blossom water, cinnamon and raisins.","Chill 20 minutes before serving."]',
 120,2,27,1,5,'{"vegan","no-cook","low-calorie"}',true,'A brilliant side when the main dish is rich.'),
('tuna-batbout','Tuna & Egg Batbout','Pocket bread, tuna, olives, quick lunch.','Moroccan','{lunch,snack}','🥙',2,10,5,'easy',
 '[{"name":"Batbout or pitta","amount":"2","category":"Bakery"},{"name":"Tuna in water","amount":"1 tin","category":"Pantry"},{"name":"Eggs","amount":"2","category":"Dairy"},{"name":"Black olives","amount":"40 g","category":"Pantry"},{"name":"Tomato","amount":"1","category":"Produce"},{"name":"Harissa","amount":"1 tsp","category":"Pantry"}]',
 '["Boil the eggs 8 minutes, then slice.","Mix tuna with harissa, chopped tomato and olives.","Warm the bread, split it and fill generously."]',
 400,32,34,14,4,'{"quick","high-protein","budget"}',false,'Pack the filling separately so the bread stays soft.');