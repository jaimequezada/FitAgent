-- =============================================================
-- FitAgent — Initial Schema
-- Run this in your Supabase SQL editor (Dashboard > SQL Editor)
-- auth.users is managed automatically by Supabase Auth
-- =============================================================


-- =============================================================
-- TABLES
-- =============================================================

-- profiles
-- One row per user. Created automatically on signup via trigger.
-- Populated during onboarding flow.
create table public.profiles (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  age               int,
  sex               text,
  weight            float,          -- kg
  height            float,          -- cm
  experience_months int,
  goal              text,           -- 'hypertrophy' | 'strength' | 'athletic'
  equipment         text,
  days_per_week     int,
  session_length    int,            -- minutes
  injuries          text,
  working_weights   jsonb default '{}'::jsonb,
  physique_priorities text,
  preferences       jsonb default '{}'::jsonb,
  onboarding_complete boolean default false,
  created_at        timestamptz default now()
);

-- sessions
-- One row per gym session. exercises is an array of ExerciseLog objects.
create table public.sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null default current_date,
  exercises  jsonb default '[]'::jsonb,
  completed  boolean default false,
  notes      text,
  created_at timestamptz default now()
);

-- memory
-- One row per user. The three living documents updated after each interaction.
create table public.memory (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  program_changes jsonb default '[]'::jsonb,
  decisions       jsonb default '[]'::jsonb,
  signals         jsonb default '[]'::jsonb,
  history_summary text default '',
  current_program jsonb default '{}'::jsonb,
  updated_at      timestamptz default now()
);

-- interactions
-- Audit log for cost control. One row per Claude API call.
create table public.interactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  model_used text,
  tokens_used int default 0
);


-- =============================================================
-- ROW LEVEL SECURITY
-- Users can only read and write their own rows.
-- =============================================================

alter table public.profiles     enable row level security;
alter table public.sessions     enable row level security;
alter table public.memory       enable row level security;
alter table public.interactions enable row level security;

-- profiles
create policy "profiles: own row" on public.profiles
  for all using (auth.uid() = user_id);

-- sessions
create policy "sessions: own rows" on public.sessions
  for all using (auth.uid() = user_id);

-- memory
create policy "memory: own row" on public.memory
  for all using (auth.uid() = user_id);

-- interactions
create policy "interactions: own rows" on public.interactions
  for all using (auth.uid() = user_id);


-- =============================================================
-- TRIGGER: auto-create profile + memory rows on signup
-- =============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id) values (new.id);
  insert into public.memory   (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- =============================================================
-- INDEXES
-- =============================================================

create index sessions_user_id_date_idx on public.sessions (user_id, date desc);
create index interactions_user_id_idx  on public.interactions (user_id, created_at desc);
