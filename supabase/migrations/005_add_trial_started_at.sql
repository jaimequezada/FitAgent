-- =============================================================
-- FitAgent — Add trial_started_at column to profiles
-- Run in Supabase SQL editor after 004_add_name_to_profiles.sql
-- =============================================================

alter table public.profiles
  add column if not exists trial_started_at timestamptz;
