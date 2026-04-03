-- =============================================================
-- FitAgent — Daily Thread Lifecycle
-- Run in Supabase SQL Editor after 001_initial_schema.sql
-- =============================================================


-- =============================================================
-- PROFILES: add last_chat_date
-- Tracks the last date a chat thread was started.
-- Used to detect day rollover and trigger fresh greeting.
-- =============================================================

alter table public.profiles
  add column if not exists last_chat_date date;


-- =============================================================
-- daily_threads
-- One record per user per day. Upserted after every exchange.
-- Cleared and regenerated on day rollover or post-gym return.
-- =============================================================

create table if not exists public.daily_threads (
  user_id    uuid    not null references auth.users(id) on delete cascade,
  date       date    not null default current_date,
  thread     jsonb   not null default '[]'::jsonb,
  updated_at timestamptz default now(),

  primary key (user_id, date)
);

alter table public.daily_threads enable row level security;

create policy "daily_threads: own rows" on public.daily_threads
  for all using (auth.uid() = user_id);

create index if not exists daily_threads_user_date_idx
  on public.daily_threads (user_id, date desc);


-- =============================================================
-- NIGHTLY CLEANUP: delete threads older than 7 days
-- Threads are already summarised into memory.history_summary
-- before deletion so no intelligence is lost.
--
-- Requires pg_cron extension (enabled in Supabase dashboard:
-- Database > Extensions > pg_cron).
-- =============================================================

select cron.schedule(
  'delete-old-daily-threads',           -- job name (idempotent)
  '0 3 * * *',                          -- 3 AM UTC every day
  $$
    delete from public.daily_threads
    where date < current_date - interval '7 days';
  $$
);
