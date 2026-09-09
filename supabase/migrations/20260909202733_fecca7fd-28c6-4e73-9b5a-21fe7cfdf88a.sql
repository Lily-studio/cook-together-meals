-- 1. Stop small plates and thin soups being served as main meals
update public.recipes
set meal_types = array_remove(array_remove(meal_types, 'lunch'), 'dinner')
where title in (
  'Carrot & Orange Salad',
  'Zaalouk Aubergine Salad',
  'Herby Lentil Salad',
  'Bessara Fava Soup',
  'Harira Lentil Soup',
  'Spiced Tomato Omelette'
);

update public.recipes
set meal_types = array_remove(meal_types, 'lunch')
where title in ('Shakshuka with Khobz');

update public.recipes
set meal_types = array_append(meal_types, 'side')
where title in ('Carrot & Orange Salad','Zaalouk Aubergine Salad','Herby Lentil Salad','Harira Lentil Soup','Bessara Fava Soup')
  and not ('side' = any(meal_types));

update public.recipes
set meal_types = array_append(meal_types, 'snack')
where title = 'Spiced Tomato Omelette' and not ('snack' = any(meal_types));

-- 2. Twelve complete main meals, all lunch-legal (chicken, turkey or minced meat)
insert into public.recipes (slug, title, tagline, cuisine, meal_types, emoji, base_servings, prep_minutes, cook_minutes, difficulty, ingredients, steps, calories, protein, carbs, fat, fiber, tags, prep_friendly, lily_note)
values
('chicken-shawarma-wrap','Chicken Shawarma Wrap','Spiced chicken, crunchy salad and garlic yoghurt rolled up','Moroccan',array['lunch','dinner'],'🌯',2,15,15,'easy',
 '[{"name":"Chicken breast","amount":"400 g","category":"Meat"},{"name":"Ras el hanout","amount":"2 tsp","category":"Spices"},{"name":"Olive oil","amount":"1 tbsp","category":"Pantry"},{"name":"Large wraps","amount":"2 pc","category":"Bakery"},{"name":"Tomato","amount":"2 pc","category":"Produce"},{"name":"Cucumber","amount":"1 pc","category":"Produce"},{"name":"Lettuce","amount":"150 g","category":"Produce"},{"name":"Greek yoghurt","amount":"150 g","category":"Dairy"},{"name":"Garlic","amount":"1 clove","category":"Produce"}]'::jsonb,
 '["Slice the chicken thin, toss with ras el hanout, oil and a little salt.","Fry hard in a hot pan for 8-10 minutes until the edges catch.","Grate the garlic into the yoghurt; chop the tomato, cucumber and lettuce.","Warm the wraps, fill with chicken, salad and yoghurt — or pile everything over the lettuce for a bowl instead."]'::jsonb,
 610,49,52,20,6,array['main','high protein','quick','format-flex'],true,'Same chicken, same salad, same sauce — bread for one, big salad bowl for the other.'),

('chicken-fajita-bowl','Chicken Fajita Bowl','Charred peppers, smoky chicken, rice and lime','Mexican',array['lunch','dinner'],'🌶️',2,15,20,'easy',
 '[{"name":"Chicken breast","amount":"400 g","category":"Meat"},{"name":"Bell pepper","amount":"2 pc","category":"Produce"},{"name":"Onion","amount":"1 pc","category":"Produce"},{"name":"Paprika","amount":"2 tsp","category":"Spices"},{"name":"Cumin","amount":"1 tsp","category":"Spices"},{"name":"Rice","amount":"180 g","category":"Pantry"},{"name":"Lemon","amount":"1 pc","category":"Produce"},{"name":"Olive oil","amount":"1 tbsp","category":"Pantry"},{"name":"Greek yoghurt","amount":"100 g","category":"Dairy"}]'::jsonb,
 '["Cook the rice.","Slice chicken, peppers and onion; toss with paprika, cumin, oil and salt.","Sear everything in a very hot pan until smoky, 10-12 minutes.","Build bowls over rice with a spoon of yoghurt and a squeeze of lemon."]'::jsonb,
 620,48,64,17,7,array['main','high protein','family'],true,'Cook one pan, share it out — rice for one, extra peppers for the other.'),

('turkey-burger-slaw','Turkey Burgers with Crunchy Slaw','Juicy turkey patties, soft bun, sharp cabbage slaw','International',array['lunch','dinner'],'🍔',2,15,15,'easy',
 '[{"name":"Minced turkey","amount":"400 g","category":"Meat"},{"name":"Onion","amount":"1 pc","category":"Produce"},{"name":"Parsley","amount":"20 g","category":"Produce"},{"name":"Burger buns","amount":"2 pc","category":"Bakery"},{"name":"White cabbage","amount":"200 g","category":"Produce"},{"name":"Carrot","amount":"1 pc","category":"Produce"},{"name":"Greek yoghurt","amount":"100 g","category":"Dairy"},{"name":"Cumin","amount":"1 tsp","category":"Spices"},{"name":"Olive oil","amount":"1 tbsp","category":"Pantry"}]'::jsonb,
 '["Grate the onion, mix into the turkey with chopped parsley, cumin and salt; shape 2-4 patties.","Fry in oil 5-6 minutes a side until cooked through.","Shred the cabbage and carrot, dress with yoghurt and a pinch of salt.","Serve in buns with slaw — or on a plate with a double helping of slaw instead of the bun."]'::jsonb,
 590,46,44,22,6,array['main','high protein','format-flex'],true,'One mix, two servings: bun for him, patties over slaw for you.'),

('turkey-meatballs-rice','Turkey Meatballs in Tomato Sauce','Soft meatballs, garlicky tomato sauce, fluffy rice','Mediterranean',array['lunch','dinner'],'🍅',2,15,25,'easy',
 '[{"name":"Minced turkey","amount":"400 g","category":"Meat"},{"name":"Garlic","amount":"2 cloves","category":"Produce"},{"name":"Chopped tomatoes","amount":"400 g","category":"Pantry"},{"name":"Onion","amount":"1 pc","category":"Produce"},{"name":"Rice","amount":"180 g","category":"Pantry"},{"name":"Paprika","amount":"1 tsp","category":"Spices"},{"name":"Parsley","amount":"20 g","category":"Produce"},{"name":"Olive oil","amount":"1 tbsp","category":"Pantry"}]'::jsonb,
 '["Roll the turkey with half the garlic, parsley and salt into small meatballs.","Brown them in oil, lift out; soften the onion and remaining garlic.","Add tomatoes and paprika, return the meatballs and simmer 15 minutes.","Cook the rice and serve the meatballs and sauce over it."]'::jsonb,
 570,45,58,17,7,array['main','high protein','budget'],true,'Doubles beautifully — tomorrow''s lunch is already in the pan.'),

('minced-chicken-tacos','Minced Chicken Tacos','Spiced chicken mince, lime, tomato salsa','Mexican',array['lunch','dinner'],'🌮',2,15,15,'easy',
 '[{"name":"Minced chicken","amount":"400 g","category":"Meat"},{"name":"Cumin","amount":"1 tsp","category":"Spices"},{"name":"Paprika","amount":"1 tsp","category":"Spices"},{"name":"Tortillas","amount":"4 pc","category":"Bakery"},{"name":"Tomato","amount":"2 pc","category":"Produce"},{"name":"Onion","amount":"1 pc","category":"Produce"},{"name":"Lettuce","amount":"150 g","category":"Produce"},{"name":"Lemon","amount":"1 pc","category":"Produce"},{"name":"Greek yoghurt","amount":"100 g","category":"Dairy"}]'::jsonb,
 '["Fry the onion, add the chicken mince with cumin, paprika and salt; cook 10 minutes.","Chop tomato and lettuce, squeeze over lemon for a quick salsa.","Warm the tortillas.","Fill the tacos — or serve the same mince over the lettuce as a taco bowl."]'::jsonb,
 560,45,48,18,6,array['main','high protein','quick','format-flex'],true,'Tacos for one, taco bowl for the other — same pan either way.'),

('chicken-caesar-wrap','Chicken Caesar-Style Wrap','Warm chicken, crisp lettuce, creamy yoghurt dressing','International',array['lunch','dinner'],'🥬',2,15,15,'easy',
 '[{"name":"Chicken breast","amount":"400 g","category":"Meat"},{"name":"Romaine lettuce","amount":"200 g","category":"Produce"},{"name":"Greek yoghurt","amount":"120 g","category":"Dairy"},{"name":"Parmesan","amount":"30 g","category":"Dairy"},{"name":"Garlic","amount":"1 clove","category":"Produce"},{"name":"Lemon","amount":"1 pc","category":"Produce"},{"name":"Large wraps","amount":"2 pc","category":"Bakery"},{"name":"Olive oil","amount":"1 tbsp","category":"Pantry"}]'::jsonb,
 '["Season and pan-fry the chicken 6 minutes a side, then slice.","Whisk yoghurt, grated parmesan, garlic, lemon juice and a little oil into a dressing.","Toss the shredded lettuce through the dressing.","Roll into wraps, or serve as a plated Caesar salad with the same chicken."]'::jsonb,
 560,50,38,20,4,array['main','high protein','quick','format-flex'],false,'The classic that works as a wrap or a salad without changing a thing.'),

('chicken-noodle-stirfry','Chicken Noodle Stir-Fry','Sticky garlic chicken, noodles, snappy vegetables','Asian',array['lunch','dinner'],'🍜',2,15,15,'easy',
 '[{"name":"Chicken breast","amount":"400 g","category":"Meat"},{"name":"Noodles","amount":"180 g","category":"Pantry"},{"name":"Carrot","amount":"1 pc","category":"Produce"},{"name":"Bell pepper","amount":"1 pc","category":"Produce"},{"name":"Garlic","amount":"2 cloves","category":"Produce"},{"name":"Soy sauce","amount":"3 tbsp","category":"Pantry"},{"name":"Honey","amount":"1 tbsp","category":"Pantry"},{"name":"Olive oil","amount":"1 tbsp","category":"Pantry"}]'::jsonb,
 '["Boil the noodles and drain.","Sear sliced chicken in oil until golden.","Add garlic, carrot and pepper strips, fry 4 minutes, then soy and honey.","Toss the noodles through the pan and serve straight away."]'::jsonb,
 620,47,66,16,6,array['main','high protein','quick'],false,'On the table in 20 minutes when nobody wants to think.'),

('kefta-rice-bowl','Kefta Bowl with Herby Rice','Cumin minced beef, herby rice, tomato and mint','Moroccan',array['lunch','dinner'],'🍚',2,15,20,'easy',
 '[{"name":"Minced beef","amount":"400 g","category":"Meat"},{"name":"Cumin","amount":"2 tsp","category":"Spices"},{"name":"Onion","amount":"1 pc","category":"Produce"},{"name":"Rice","amount":"180 g","category":"Pantry"},{"name":"Parsley","amount":"20 g","category":"Produce"},{"name":"Mint","amount":"10 g","category":"Produce"},{"name":"Tomato","amount":"2 pc","category":"Produce"},{"name":"Greek yoghurt","amount":"100 g","category":"Dairy"},{"name":"Olive oil","amount":"1 tbsp","category":"Pantry"}]'::jsonb,
 '["Cook the rice and stir the chopped herbs through it.","Fry the onion, add the mince with cumin and salt, cook until browned.","Dice the tomato and stir in for the last 2 minutes.","Serve the kefta over the herby rice with a spoon of yoghurt."]'::jsonb,
 630,44,60,23,5,array['main','high protein','budget'],true,'Cook the whole pan — the leftovers make a brilliant batbout filling.'),

('honey-mustard-chicken-traybake','Honey Mustard Chicken Traybake','One tray, crisp potatoes, sticky chicken','International',array['lunch','dinner'],'🍯',2,10,40,'easy',
 '[{"name":"Chicken thighs","amount":"500 g","category":"Meat"},{"name":"Potato","amount":"500 g","category":"Produce"},{"name":"Carrot","amount":"2 pc","category":"Produce"},{"name":"Honey","amount":"1 tbsp","category":"Pantry"},{"name":"Mustard","amount":"1 tbsp","category":"Pantry"},{"name":"Garlic","amount":"2 cloves","category":"Produce"},{"name":"Olive oil","amount":"1 tbsp","category":"Pantry"}]'::jsonb,
 '["Heat the oven to 200C.","Chop the potatoes and carrots, toss with oil, garlic and salt on a tray.","Mix honey and mustard, coat the chicken and lay it on top.","Roast 35-40 minutes until the chicken is sticky and the potatoes crisp."]'::jsonb,
 640,45,55,25,7,array['main','high protein','one-pot'],true,'Nothing to watch — the oven does the work while you get on with your evening.'),

('chicken-pesto-pasta','Chicken Pesto Pasta','Green pesto, golden chicken, cherry tomatoes','Mediterranean',array['lunch','dinner'],'🌿',2,10,20,'easy',
 '[{"name":"Chicken breast","amount":"400 g","category":"Meat"},{"name":"Pasta","amount":"180 g","category":"Pantry"},{"name":"Pesto","amount":"60 g","category":"Pantry"},{"name":"Cherry tomatoes","amount":"200 g","category":"Produce"},{"name":"Courgette","amount":"1 pc","category":"Produce"},{"name":"Parmesan","amount":"25 g","category":"Dairy"},{"name":"Olive oil","amount":"1 tbsp","category":"Pantry"}]'::jsonb,
 '["Boil the pasta, keeping a cup of the water.","Fry the sliced chicken and courgette in oil until golden.","Halve the tomatoes and add for 2 minutes.","Stir in the pasta, pesto and a splash of the water; finish with parmesan."]'::jsonb,
 650,48,62,24,6,array['main','high protein','quick'],false,'Pasta for one, the same chicken and courgette over a big salad for the other.'),

('turkey-chilli-rice','Turkey Chilli with Rice','Warm, mild chilli with beans and sweet peppers','International',array['lunch','dinner'],'🫘',2,15,30,'easy',
 '[{"name":"Minced turkey","amount":"400 g","category":"Meat"},{"name":"Red kidney beans","amount":"240 g","category":"Pantry"},{"name":"Chopped tomatoes","amount":"400 g","category":"Pantry"},{"name":"Bell pepper","amount":"1 pc","category":"Produce"},{"name":"Onion","amount":"1 pc","category":"Produce"},{"name":"Cumin","amount":"1 tsp","category":"Spices"},{"name":"Paprika","amount":"2 tsp","category":"Spices"},{"name":"Rice","amount":"180 g","category":"Pantry"},{"name":"Olive oil","amount":"1 tbsp","category":"Pantry"}]'::jsonb,
 '["Soften the onion and pepper in oil.","Add the turkey with cumin and paprika and brown well.","Tip in the tomatoes and drained beans, simmer 20 minutes.","Serve over rice — it is even better the next day."]'::jsonb,
 610,47,70,14,12,array['main','high protein','budget','batch-cook'],true,'Make the full pot: half now, half in the fridge for a no-cook lunch.'),

('chicken-gyros-plate','Chicken Gyros Plate','Oregano chicken, pita, tomato and red onion','Mediterranean',array['lunch','dinner'],'🥙',2,15,15,'easy',
 '[{"name":"Chicken breast","amount":"400 g","category":"Meat"},{"name":"Oregano","amount":"2 tsp","category":"Spices"},{"name":"Pitta","amount":"2 pc","category":"Bakery"},{"name":"Tomato","amount":"2 pc","category":"Produce"},{"name":"Red onion","amount":"1 pc","category":"Produce"},{"name":"Cucumber","amount":"1 pc","category":"Produce"},{"name":"Greek yoghurt","amount":"150 g","category":"Dairy"},{"name":"Lemon","amount":"1 pc","category":"Produce"},{"name":"Olive oil","amount":"1 tbsp","category":"Pantry"}]'::jsonb,
 '["Toss sliced chicken with oregano, lemon, oil and salt; fry hard until charred at the edges.","Grate the cucumber into the yoghurt for a quick tzatziki.","Slice the tomato and red onion.","Serve in warm pitta, or plated over the salad with the tzatziki on the side."]'::jsonb,
 580,49,44,20,5,array['main','high protein','format-flex'],false,'Pitta for one, the same chicken over salad for the other — one pan, two plates.');