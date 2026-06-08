-- =============================================================
-- FitAgent — Add last_checkin_at column to profiles
-- Tracks when the weekly / end-of-trial coach check-in last fired,
-- so the daily rollover can decide when the next one is due.
-- Run in Supabase SQL editor after 005_add_trial_started_at.sql
-- =============================================================

alter table public.profiles
  add column if not exists last_checkin_at timestamptz;
