-- =============================================================
-- FitAgent — Missed Session Tracking + Additional Activities
-- Run in Supabase SQL editor after 002_daily_threads.sql
-- =============================================================

-- sessions: add missed/flagged tracking + additional activities + workout name
alter table public.sessions
  add column if not exists missed              boolean default false,
  add column if not exists flagged             boolean default false,
  add column if not exists additional_activities jsonb default '[]'::jsonb,
  add column if not exists workout_name        text;

-- Existing rows remain unaffected: all new columns default to false/empty.
