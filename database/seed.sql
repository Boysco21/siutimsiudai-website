-- Optional seed: adds two sample HK recipes to the FIRST existing profile.
-- Run after at least one user has signed up (so a profile row exists).
-- The local app already seeds these same recipes from constants/sampleRecipes.ts,
-- so this file is only needed once you wire Supabase live.

do $$
declare
  uid uuid;
  r1 uuid;
  r2 uuid;
begin
  select id into uid from public.profiles order by created_at limit 1;
  if uid is null then
    raise notice 'No profile found. Sign up a user first, then re-run seed.sql.';
    return;
  end if;

  insert into public.recipes (user_id, title, title_zh, servings, source_type, total_minutes)
  values (uid, 'Steamed Egg with Minced Pork', '肉碎蒸水蛋', 2, 'manual', 20)
  returning id into r1;

  insert into public.recipe_ingredients (recipe_id, name, name_zh, quantity, unit, display_unit, raw_text) values
    (r1, 'Egg', '雞蛋', 3, 'piece', 'piece', '3 eggs / 雞蛋三隻'),
    (r1, 'Pork', '豬肉', 151.2, 'g', 'tael', 'minced pork / 免治豬肉 4 兩'),
    (r1, 'Soy sauce', '豉油', 15, 'ml', 'tbsp', 'soy sauce / 豉油 1 湯匙');

  insert into public.recipe_steps (recipe_id, step_number, instruction, instruction_zh, duration_seconds) values
    (r1, 1, 'Beat eggs with 1.5x water and a pinch of salt.', '雞蛋加 1.5 倍水同少許鹽拂勻。', null),
    (r1, 2, 'Add minced pork, steam on medium for 10 minutes.', '加免治豬肉，中火蒸 10 分鐘。', 600),
    (r1, 3, 'Drizzle soy sauce and sesame oil, then serve.', '灒豉油同麻油，完成。', null);

  insert into public.recipes (user_id, title, title_zh, servings, source_type, total_minutes)
  values (uid, 'Tomato and Egg Stir-fry', '番茄炒蛋', 2, 'manual', 15)
  returning id into r2;

  insert into public.recipe_ingredients (recipe_id, name, name_zh, quantity, unit, display_unit, raw_text) values
    (r2, 'Tomato', '番茄', 3, 'piece', 'piece', 'tomatoes / 番茄三個'),
    (r2, 'Egg', '雞蛋', 4, 'piece', 'piece', 'eggs / 雞蛋四隻'),
    (r2, 'Sugar', '糖', 10, 'g', 'tsp', 'sugar / 糖 2 茶匙'),
    (r2, 'Spring onion', '葱', 1, 'piece', 'piece', 'spring onion / 葱一條');

  insert into public.recipe_steps (recipe_id, step_number, instruction, instruction_zh, duration_seconds) values
    (r2, 1, 'Beat eggs, scramble until just set, then set aside.', '雞蛋拂勻，炒至剛熟盛起。', null),
    (r2, 2, 'Stir-fry tomato wedges with a little sugar until soft.', '番茄切角，加少許糖炒軟。', null),
    (r2, 3, 'Return eggs, toss together, finish with spring onion.', '回鑊兜勻，灑葱花完成。', null);
end $$;
