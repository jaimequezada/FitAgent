-- =============================================================
-- FitAgent — Add name column to profiles
-- Run in Supabase SQL editor after 003_missed_sessions.sql
-- =============================================================

alter table public.profiles
  add column if not exists name text;
