-- Sik Fan schema. Run in the Supabase SQL editor or via the Supabase CLI.
-- Assumes the Supabase auth schema is present (auth.users, auth.uid()).

create extension if not exists "pgcrypto";

-- Enums -----------------------------------------------------------------
create type meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type log_source as enum ('photo', 'voice', 'barcode', 'label', 'manual');
create type recipe_source_type as enum ('url', 'ocr', 'manual');
create type canonical_unit as enum ('g', 'ml', 'piece');

-- profiles --------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale text not null default 'en' check (locale in ('en', 'zh-Hant')),
  daily_calorie_target integer not null default 2000,
  onboarding_skipped boolean not null default false,
  created_at timestamptz not null default now()
);

-- daily_logs: one row per user per day, with cached totals ---------------
create table daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  log_date date not null,
  total_calories numeric not null default 0,
  total_protein numeric not null default 0,
  total_carbs numeric not null default 0,
  total_fat numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, log_date)
);

-- food_entries: each logged item, belongs to a daily_log ----------------
create table food_entries (
  id uuid primary key default gen_random_uuid(),
  daily_log_id uuid not null references daily_logs (id) on delete cascade,
  name text not null,
  name_zh text not null default '',
  meal_type meal_type not null default 'snack',
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  quantity numeric not null default 1,
  unit text not null default 'serving',
  source log_source not null default 'manual',
  image_url text,
  barcode text,
  logged_at timestamptz not null default now()
);
create index food_entries_daily_log_idx on food_entries (daily_log_id);

-- saved_meals: quick-repeat templates -----------------------------------
create table saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  name_zh text not null default '',
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  default_meal_type meal_type not null default 'snack',
  use_count integer not null default 0,
  last_used_at timestamptz
);
create index saved_meals_user_idx on saved_meals (user_id);

-- recipes ---------------------------------------------------------------
create table recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  title_zh text not null default '',
  servings integer not null default 2,
  source_type recipe_source_type not null default 'manual',
  source_url text,
  image_url text,
  total_minutes integer not null default 0,
  created_at timestamptz not null default now()
);
create index recipes_user_idx on recipes (user_id);

create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes (id) on delete cascade,
  name text not null,
  name_zh text not null default '',
  quantity numeric not null default 0,        -- stored in the canonical unit
  unit canonical_unit not null default 'g',
  display_unit text not null default 'g',     -- catty / tael / bowl / piece ...
  raw_text text not null default '',
  substituted_from text
);
create index recipe_ingredients_recipe_idx on recipe_ingredients (recipe_id);

create table recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes (id) on delete cascade,
  step_number integer not null,
  instruction text not null,
  instruction_zh text not null default '',
  image_url text,
  duration_seconds integer,                   -- powers in-step timers
  unique (recipe_id, step_number)
);
create index recipe_steps_recipe_idx on recipe_steps (recipe_id);

-- pantry_items ----------------------------------------------------------
create table pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  name_zh text not null default '',
  quantity numeric not null default 0,
  unit canonical_unit not null default 'piece',
  in_stock boolean not null default true,
  updated_at timestamptz not null default now()
);
create index pantry_items_user_idx on pantry_items (user_id);

-- meal_plans: a recipe assigned to a date + meal slot -------------------
create table meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  plan_date date not null,
  meal_type meal_type not null default 'dinner',
  recipe_id uuid not null references recipes (id) on delete cascade,
  unique (user_id, plan_date, meal_type, recipe_id)
);
create index meal_plans_user_date_idx on meal_plans (user_id, plan_date);

-- grocery_lists ---------------------------------------------------------
create table grocery_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  name text not null default 'Grocery list',
  created_at timestamptz not null default now()
);
create index grocery_lists_user_idx on grocery_lists (user_id);

create table grocery_list_recipes (
  grocery_list_id uuid not null references grocery_lists (id) on delete cascade,
  recipe_id uuid not null references recipes (id) on delete cascade,
  primary key (grocery_list_id, recipe_id)
);

create table grocery_list_items (
  id uuid primary key default gen_random_uuid(),
  grocery_list_id uuid not null references grocery_lists (id) on delete cascade,
  name text not null,
  name_zh text not null default '',
  quantity numeric not null default 0,
  unit canonical_unit not null default 'g',
  display_unit text not null default 'g',
  checked boolean not null default false,
  source_recipe_id uuid references recipes (id) on delete set null,
  merged_from jsonb not null default '[]'::jsonb,   -- audit of folded raw labels
  in_pantry boolean not null default false
);
create index grocery_list_items_list_idx on grocery_list_items (grocery_list_id);

-- Auto-create a profile when a new auth user signs up -------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Keep pantry_items.updated_at fresh ------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger pantry_items_set_updated_at
  before update on pantry_items
  for each row execute function set_updated_at();

-- Row level security: every row is scoped to its owner ------------------
alter table profiles enable row level security;
alter table daily_logs enable row level security;
alter table food_entries enable row level security;
alter table saved_meals enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table recipe_steps enable row level security;
alter table pantry_items enable row level security;
alter table meal_plans enable row level security;
alter table grocery_lists enable row level security;
alter table grocery_list_recipes enable row level security;
alter table grocery_list_items enable row level security;

create policy own_profiles on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy own_daily_logs on daily_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy own_saved_meals on saved_meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy own_recipes on recipes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy own_pantry_items on pantry_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy own_meal_plans on meal_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy own_grocery_lists on grocery_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Child tables inherit ownership through their parent.
create policy own_food_entries on food_entries
  for all using (
    exists (select 1 from daily_logs d where d.id = food_entries.daily_log_id and d.user_id = auth.uid())
  ) with check (
    exists (select 1 from daily_logs d where d.id = food_entries.daily_log_id and d.user_id = auth.uid())
  );

create policy own_recipe_ingredients on recipe_ingredients
  for all using (
    exists (select 1 from recipes r where r.id = recipe_ingredients.recipe_id and r.user_id = auth.uid())
  ) with check (
    exists (select 1 from recipes r where r.id = recipe_ingredients.recipe_id and r.user_id = auth.uid())
  );

create policy own_recipe_steps on recipe_steps
  for all using (
    exists (select 1 from recipes r where r.id = recipe_steps.recipe_id and r.user_id = auth.uid())
  ) with check (
    exists (select 1 from recipes r where r.id = recipe_steps.recipe_id and r.user_id = auth.uid())
  );

create policy own_grocery_list_recipes on grocery_list_recipes
  for all using (
    exists (select 1 from grocery_lists g where g.id = grocery_list_recipes.grocery_list_id and g.user_id = auth.uid())
  ) with check (
    exists (select 1 from grocery_lists g where g.id = grocery_list_recipes.grocery_list_id and g.user_id = auth.uid())
  );

create policy own_grocery_list_items on grocery_list_items
  for all using (
    exists (select 1 from grocery_lists g where g.id = grocery_list_items.grocery_list_id and g.user_id = auth.uid())
  ) with check (
    exists (select 1 from grocery_lists g where g.id = grocery_list_items.grocery_list_id and g.user_id = auth.uid())
  );

-- Storage buckets for uploaded images (meals, recipe cards, step photos).
insert into storage.buckets (id, name, public)
values ('meal-images', 'meal-images', false), ('recipe-images', 'recipe-images', false)
on conflict (id) do nothing;
