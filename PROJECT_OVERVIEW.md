# FitAgent — Project Overview

> Self-contained reference for the FitAgent project. Upload this to the
> claude.ai project folder so Claude has a complete picture of what the
> product is, how it's architected, and how to reason about changes.

---

## What FitAgent Is

A PWA fitness coaching agent powered by Claude. **The agent is the product.
The UI is a thin shell.** There is no hardcoded fitness logic anywhere in the
codebase — every coaching decision is reasoned by Claude from injected user
context.

Live demo: https://fitagent.jaimequezada.com

### Target user
Intermediate gym-goer (6–18 months experience), training 3–5×/week, hitting
plateaus, wants smarter programming without paying for a real coach.

### The core insight
Most fitness apps log. FitAgent reasons. It knows working weights, injury
history, goals, and the last several weeks of training — and uses that context
to coach in ways that actually apply to the user.

---

## Two Modes

### Home — conversational coaching
- Context-aware greeting on every day-rollover
- Chat with the coach (full memory brief on every call)
- PR cards for top lifts, last-session summary, today's workout card
- Weekly training-balance assessment and a single sharp insight
- One chat thread per user per calendar day (auto-cleared after 7 days)

### Gym — focused session logging
- Triggered by "I'm at the gym"
- Shows today's planned workout only
- Weight confirmed once at the start
- One exercise at a time, tap-to-log reps
- Rest timer between sets
- AI feedback (1–2 sentences) on session complete

### Onboarding — conversational intake
A 5-question natural conversation (not a form). Claude emits `<profile_json>`
when complete, then immediately generates the user's first training program
(`<program_json>` → `memory.current_program`).

---

## Tech Stack

| Layer            | Technology                                              |
|------------------|---------------------------------------------------------|
| Frontend         | React 19, Vite 7, React Router 7                        |
| Styling          | TailwindCSS 4                                           |
| Animation/charts | Framer Motion, Recharts                                 |
| Markdown         | react-markdown + remark-gfm                             |
| Database + Auth  | Supabase                                                |
| AI               | Anthropic Claude API (Haiku 4.5 + Sonnet 4.6)           |
| Deployment       | Vercel (one serverless function for the Claude proxy)   |
| PWA              | manifest.json + service worker                          |

---

## Core Philosophy

- The agent is the product. The UI is the shell.
- Claude does all fitness reasoning. The app manages data and presentation only.
- Minimal UI. No generic fitness-app aesthetics (no motivational banners,
  no stock fitness photography, no progress-ring shrines).
- Two distinct modes: Home (conversational) and Gym (focused, minimal,
  tap-to-log).
- Dark, minimal — not aggressive gym aesthetic.
- Conversational UI is the dominant element.
- Data appears inline as subtle cards in chat.
- Large tap targets for gym mode. Forward only — no navigation mid-session.

## Things to never do
- Never hardcode fitness logic or rules.
- Never use generic form-heavy UI patterns.
- Never store full conversation history — store summaries + structured data.
- Never use localStorage for persistent data.
- Never inline system prompts in components or hooks — they live in
  `src/lib/prompts.js`.
- Never expose `ANTHROPIC_API_KEY` to the browser — all Claude calls go
  through the Vercel function at `api/chat.js`.

---

## Repository Layout

```
api/chat.js                  # Vercel serverless Claude proxy (SSE)

src/
  App.jsx                    # Router + auth/onboarding/trial guards
  components/
    landing/   auth/         # Marketing + sign-in/up
    onboarding/              # Conversational intake
    home/                    # Home dashboard + chat
    agent/                   # Dedicated agent chat page
    gym/                     # Gym-mode state machine + UI
    trial/                   # Trial-expired screen
    ui/                      # Shared bubbles, sidebar, indicators
  hooks/
    useAuth.js               # Supabase auth state
    useAgent.js              # Home-mode agent call state
    useDailyThread.js        # One thread per user per day
    useSession.js            # Gym session state machine
    useMemory.js
  lib/
    supabase.js              # Supabase client
    claude.js                # All Claude API call entry points
    memory.js                # Build context brief from DB
    prompts.js               # All system prompts (single source of truth)
    dailyThread.js           # Daily thread persistence helpers
    missedSessions.js        # Missed-session detection + logging
  types/                     # JSDoc shapes for user/session/memory

public/
  manifest.json   service-worker.js   icons/   favicon.svg

supabase/migrations/         # 001 → 005, applied manually in Supabase
```

---

## Routes

| Path             | Guard                                       | Component         |
|------------------|---------------------------------------------|-------------------|
| `/`              | public                                      | LandingPage       |
| `/signin`        | public-only (signed-in users → `/home`)     | AuthScreen        |
| `/signup`        | public-only                                 | AuthScreen        |
| `/onboarding`    | authed + not onboarded                      | OnboardingChat    |
| `/home`          | authed + onboarded + trial active           | HomeScreen        |
| `/workout`       | authed + onboarded + trial active           | GymMode           |
| `/agent`         | authed + onboarded + trial active           | AgentPage         |
| `/trial-expired` | public                                      | TrialExpired      |

15-day trial is computed from `profiles.trial_started_at`. Expired users are
redirected to `/trial-expired`.

---

## Database Schema (Supabase, RLS on every table)

All policies are `auth.uid() = user_id`. A `handle_new_user()` trigger on
`auth.users` auto-creates the matching `profiles` and `memory` rows on signup.

### `profiles`
`user_id` (pk, FK `auth.users`), `name`, `age`, `sex`, `weight` (kg),
`height` (cm), `experience_months`, `goal` (`'hypertrophy'|'strength'|'athletic'`),
`equipment`, `days_per_week`, `session_length` (min), `injuries`,
`working_weights` (jsonb: `{ bench_lbs, squat_lbs, deadlift_lbs, ohp_lbs }`),
`physique_priorities`, `preferences` (jsonb), `onboarding_complete` (bool),
`last_chat_date` (date — drives daily-thread rollover),
`trial_started_at` (timestamptz — 15-day trial), `created_at`.

### `sessions`
`id`, `user_id`, `date`, `exercises` (jsonb `ExerciseLog[]`:
`{ name, sets: [{ reps, weight_lbs }] }`), `completed` (bool), `notes`,
`missed` (bool), `flagged` (bool), `additional_activities` (jsonb),
`workout_name` (text), `created_at`.

### `memory` (one row per user — the three living documents)
`user_id` (pk),
- `program_changes` jsonb — `[{ date, change, reason, affected_day }]`
- `decisions` jsonb — `[{ date, topic, decision, user_agreed }]`
- `signals` jsonb — `[{ date, type, note, flagged, resolved }]`
- `history_summary` text — compressed older history
- `current_program` jsonb — structured weekly program
- `updated_at`

### `daily_threads`
Composite pk `(user_id, date)`, `thread` jsonb (`Message[]` for that day),
`updated_at`. A `pg_cron` job at `0 3 * * *` deletes threads older than
7 days — substance is preserved in `memory.history_summary`.

### `interactions` (audit log for cost control)
`id`, `user_id`, `created_at`, `model_used` (full model ID),
`tokens_used` (input + output).

### Migrations
- `001` — baseline schema
- `002` — `daily_threads` table + `profiles.last_chat_date`
- `003` — `sessions.missed`, `.flagged`, `.additional_activities`, `.workout_name`
- `004` — `profiles.name`
- `005` — `profiles.trial_started_at`

---

## Claude API Layer

### Request path
```
src/lib/claude.js  →  POST /api/chat (SSE)  →  Anthropic Messages API
```
The Anthropic API key is set as an env var on Vercel and is never sent to the
browser. `api/chat.js` streams the response back as SSE events:

- `data: { "delta": "<text>" }` per text chunk
- `data: { "done": true, "tokens": N, "model": "..." }` on completion
- `data: { "error": "..." }` on failure

### Entry points (`src/lib/claude.js`)

| Function                | Purpose                                          | Model  |
|-------------------------|--------------------------------------------------|--------|
| `callClaude`            | Home-mode chat with full history                 | Haiku  |
| `callGreeting`          | Home greeting (with missed/today context)        | Haiku  |
| `callWelcome`           | First-open welcome after onboarding              | Haiku  |
| `callInsight`           | Single sharp dashboard observation               | Sonnet |
| `callTrainingBalance`   | Categorical balance assessment (JSON output)     | Haiku  |
| `callFeedback`          | 1–2 sentence reaction after a completed session  | Sonnet |
| `callRestDaySuggestion` | One-sentence rest-day Today card                 | Haiku  |
| `callCompletedFeedback` | One-sentence completed Today card                | Haiku  |
| `callActivityAck`       | Ack after logging an additional activity         | Haiku  |
| `callGenerateProgram`   | Build + save first program after onboarding      | Sonnet |
| `callOnboarding`        | Onboarding intake conversation                   | Sonnet |

### Model routing (`routeModel`)
- `'program' | 'checkin' | 'analysis' | 'onboarding' | 'insight' | 'feedback'`
  → `claude-sonnet-4-6`
- everything else → `claude-haiku-4-5-20251001`

### Daily rate limits (`checkUsageLimit`)
- Haiku family: 30 / user / day
- Sonnet family: 5 / user / day
- Counted from `interactions.created_at >= local midnight`, filtered by family.
- Fails open if the Supabase query errors — never block on infra failure.
- Throws on exceed; UI surfaces via `isRateLimitError(err)`.

### `callClaude` flow
1. `buildContextBrief(userId)` — profile, memory, last 12 completed sessions.
2. `buildSystemPrompt(brief)` — persona + brief.
3. `routeModel(type)` — pick model.
4. `checkUsageLimit(userId, model)`.
5. POST to `/api/chat`, stream deltas through `onChunk`.
6. `logInteraction(userId, model, tokens)` — fire-and-forget.
7. `extractAndSaveProgram` — if the response contains
   `<program_json>...</program_json>`, parse, upsert into
   `memory.current_program`, strip the tag from displayed text.

### System prompt structure
```
[COACHING_PERSONA]   # honest, warm, specific — no hype, no clichés
[Intelligence brief] # formatted by memory.js (sections below)
[Task-specific prompt, optional]
```
All prompts live in `src/lib/prompts.js`. Notable ones: `COACHING_PERSONA`,
`ONBOARDING_PROMPT`, `PROGRAM_GENERATION_PROMPT`, `GREETING_PROMPT`,
`NEW_USER_WELCOME_PROMPT`, `SESSION_FEEDBACK_PROMPT`,
`COMPLETED_FEEDBACK_PROMPT`, `ACTIVITY_ACK_PROMPT`, `REST_DAY_PROMPT`,
`INSIGHT_PROMPT`, `buildTrainingBalancePrompt(categories)`.

---

## Intelligence Brief (`src/lib/memory.js`)

`buildContextBrief(userId)` formats sections in this exact order:

```
=== USER PROFILE ===
Name, goal, experience, days/week, session length, equipment, injuries,
working weights (bench/squat/deadlift/OHP), physique priorities.

=== CURRENT PROGRAM ===
The JSON from memory.current_program.

=== RECENT SESSIONS ===
Last 12 completed sessions (most recent first), each as date + exercises
with all sets.

=== MEMORY ===
Program changes, standing decisions, active (non-resolved) signals.

=== HISTORY SUMMARY ===
The compressed older history (memory.history_summary).
```

Resolved signals are kept in DB for audit but filtered out of the brief.
`resolveSignals(userId, [{ date, type, resolution }])` marks signals as
resolved after weekly check-ins.

---

## Gym Mode State Machine (`src/hooks/useSession.js`)

States: `IDLE → PRE_SESSION → CONFIRM_WEIGHT → SET_ACTIVE → REST → SESSION_COMPLETE`

```
IDLE
  → start() — fetch program + check today's completion
PRE_SESSION
  → workout preview (or rest-day suggestion, or already-done state)
  → beginSession()
CONFIRM_WEIGHT
  → user adjusts weights; confirmWeights()
SET_ACTIVE
  → user taps reps → logSet(reps)
REST
  → timer counts down → advanceAfterRest()
  → loops back to SET_ACTIVE until the last set of the last exercise
SESSION_COMPLETE
  → insert session row (workout_name, exercises, completed=true)
  → callFeedback(userId, summary) → display reaction
```

- `endEarly()` fills remaining sets with 0 reps and jumps to `SESSION_COMPLETE`.
- If today is already complete, `start()` skips ahead without re-inserting.
- If today is a rest day per `program.schedule`, `start()` stays in
  `PRE_SESSION` with `isRestDay=true`.
- Day selection: `program.schedule?.[dayOfWeek]?.day_index` if present,
  otherwise round-robin by completed session count.

---

## Daily Thread (`src/hooks/useDailyThread.js`)

One thread per user per calendar day. On mount:
- If `postGymFeedback` is provided → clear today's thread and start fresh
  with the feedback line.
- Else if `profiles.last_chat_date < today`:
  1. `detectAndLogMissedSession` (writes DB first so context is correct)
  2. `callGreeting` with `{ missed, workoutName, todayWorkoutLabel }`
  3. Save thread + bump `last_chat_date`
- Else → restore today's thread from `daily_threads`.

Threads older than 7 days are deleted nightly by `pg_cron`. Their substance
lives on in `memory.history_summary`.

---

## PWA

### `public/manifest.json`
`name`: "FitAgent", `short_name`: "FitAgent", `display`: "standalone",
dark background + theme color, icons 192×192 and 512×512.

### `public/service-worker.js`
Cache shell assets on install. Network-first for API calls. Cache-first for
static assets.

---

## Cost Control

- **Model routing** — Haiku for casual interactions saves ~70% on the most
  frequent calls.
- **Prompt caching** — the system prompt + profile section is the
  cache-friendly portion (stable across a user's calls within the cache window).
- **Daily caps** — 30 Haiku / 5 Sonnet per user per day, enforced in
  `claude.js`.
- **Trial gate** — 15 days from signup; expired users go to `/trial-expired`.
- **Per-call logging** — every interaction writes `model_used` +
  `tokens_used` to `interactions`.

---

## Conventions for Future Changes

- Prompts → `src/lib/prompts.js`. Never inline in components/hooks.
- Claude API entry points → `src/lib/claude.js`. Components call those, not
  `fetch` directly.
- DB reads/writes for memory/profile → use `src/lib/memory.js` and
  `src/lib/supabase.js` patterns already in place.
- New DB columns → add a numbered migration in `supabase/migrations/`,
  applied manually in the Supabase SQL editor.
- Keep the UI minimal. New features should appear inline in chat or as
  subtle home cards, not as new pages or menu items.
- Two navigation points max. No hamburger menus.
- Stay in-scope of the current sprint. No speculative abstractions.
