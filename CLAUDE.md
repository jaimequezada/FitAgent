# FitAgent — Claude Code Instructions

## What We Are Building
A PWA fitness coaching agent powered by Claude AI. 
Not a traditional fitness app — an intelligent coach 
that remembers users, adapts their program over time, 
and feels like a conversation not a form.

## Core Philosophy
- The agent is the product. The UI is the shell.
- Claude does all fitness reasoning. The app manages 
  data and presentation only.
- Minimal UI. No generic fitness app aesthetics.
- Two distinct modes: Home (conversational) and 
  Gym (focused, minimal, tap-to-log)

## Tech Stack
- React (Vite)
- TailwindCSS
- Claude API (Haiku for simple, Sonnet for complex)
- Supabase (auth + database)
- Vercel (deployment)
- PWA manifest for mobile install

## Key Architecture Decisions
- User memory stored in 3 JSON documents:
  program_changes, decisions, signals
- Fresh API call each interaction with full context
- System prompt + memory brief constructed per call
- Model routing: Haiku for chat, Sonnet for 
  program generation and weekly check-ins
- No hardcoded fitness logic — Claude reasons 
  everything from user context

## Current State

### Completed Migrations
- `001` — baseline schema (users, sessions, etc.)
- `002` — daily_threads table + profiles.last_chat_date
- `003` — sessions: added `missed`, `flagged`,
  `additional_activities` (jsonb), `workout_name`
- `004` — profiles: added `name` column (text)
- `005` — profiles: added `trial_started_at` (timestamptz)
  for the 7-day free trial gate

## What To Never Do
- Never hardcode fitness logic or rules
- Never use generic form-heavy UI patterns
- Never store full conversation history —
  store summaries and structured data only
- Never use localStorage for persistent data
- Never add features outside current sprint scope
