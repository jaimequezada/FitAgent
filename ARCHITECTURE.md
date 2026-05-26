# FitAgent — Technical Architecture

---

## Tech Stack
- **Frontend:** React 19 + Vite 7
- **Styling:** TailwindCSS 4 (`@tailwindcss/vite`)
- **Routing:** React Router 7
- **Animation:** Framer Motion
- **Charts:** Recharts
- **Markdown:** react-markdown + remark-gfm
- **Database + Auth:** Supabase (`@supabase/supabase-js`)
- **AI:** Anthropic Claude API (`@anthropic-ai/sdk`) — Haiku 4.5 + Sonnet 4.6
- **Deployment:** Vercel (with one serverless function for the Claude proxy)
- **PWA:** `public/manifest.json` + `public/service-worker.js`

---

## Folder Structure

```
api/
  chat.js                       # Vercel serverless Claude proxy (SSE stream)

src/
  App.jsx                       # Router + auth/onboarding/trial guards
  main.jsx
  index.css
  components/
    landing/
      LandingPage.jsx
    auth/
      AuthScreen.jsx            # Sign in / sign up
    onboarding/
      OnboardingChat.jsx        # 5-question conversational intake
    home/
      HomeScreen.jsx            # Home mode container
      TodayWorkoutCard.jsx
      LastSession.jsx
      PRCard.jsx
      ProgressChart.jsx
      TrainingBalanceSection.jsx
      WeeklyInsightRow.jsx
      AdditionalActivityModal.jsx
    agent/
      AgentPage.jsx
      AgentChat.jsx
      AgentMessage.jsx
      AgentGreeting.jsx
    gym/
      GymMode.jsx               # State-machine container
      ExerciseCard.jsx
      RestTimer.jsx
      SetLogger.jsx
    trial/
      TrialExpired.jsx
    ui/
      AgentBubble.jsx
      UserBubble.jsx
      TypingIndicator.jsx
      PulsingOrb.jsx
      NavSidebar.jsx
  hooks/
    useAuth.js                  # Supabase auth state
    useAgent.js                 # Home-mode agent call state
    useDailyThread.js           # One chat thread per user per day
    useSession.js               # Gym session state machine
    useMemory.js
  lib/
    supabase.js                 # Supabase client
    claude.js                   # All Claude API call entry points
    memory.js                   # Build context brief from DB
    prompts.js                  # All system prompts (single source of truth)
    dailyThread.js              # Load/save/clear today's daily thread
    missedSessions.js           # Detect and log missed sessions
  types/
    user.js
    session.js
    memory.js

public/
  manifest.json                 # PWA manifest
  service-worker.js             # Cache strategy
  favicon.svg
  icons/

supabase/
  migrations/                   # 001 → 005, run manually in Supabase SQL editor
```

---

## Routes (`src/App.jsx`)

| Path             | Guard                                      | Component         |
|------------------|--------------------------------------------|-------------------|
| `/`              | public                                     | `LandingPage`     |
| `/signin`        | public-only (signed-in users → `/home`)    | `AuthScreen`      |
| `/signup`        | public-only                                | `AuthScreen`      |
| `/onboarding`    | authed + not onboarded                     | `OnboardingChat`  |
| `/home`          | authed + onboarded + trial active          | `HomeScreen`      |
| `/workout`       | authed + onboarded + trial active          | `GymMode`         |
| `/agent`         | authed + onboarded + trial active          | `AgentPage`       |
| `/trial-expired` | public                                     | `TrialExpired`    |
| `*`              | —                                          | redirect to `/`   |

The trial check (`profiles.trial_started_at` > 15 days ago) routes any expired user to `/trial-expired`.

---

## Database Schema (Supabase)

Migrations live in `supabase/migrations/` and are applied manually via the Supabase SQL editor.

### `profiles` (001 + 002 + 004 + 005)
| field                | type        | notes                                         |
|----------------------|-------------|-----------------------------------------------|
| user_id              | uuid (pk)   | FK to `auth.users`                            |
| name                 | text        | added 004                                     |
| age                  | int         |                                               |
| sex                  | text        |                                               |
| weight               | float       | kg                                            |
| height               | float       | cm                                            |
| experience_months    | int         |                                               |
| goal                 | text        | `'hypertrophy' \| 'strength' \| 'athletic'`   |
| equipment            | text        |                                               |
| days_per_week        | int         |                                               |
| session_length       | int         | minutes                                       |
| injuries             | text        |                                               |
| working_weights      | jsonb       | `{ bench_lbs, squat_lbs, deadlift_lbs, ohp_lbs }` |
| physique_priorities  | text        |                                               |
| preferences          | jsonb       |                                               |
| onboarding_complete  | boolean     |                                               |
| last_chat_date       | date        | added 002 — drives daily thread rollover      |
| trial_started_at     | timestamptz | added 005 — 15-day trial window               |
| created_at           | timestamptz |                                               |

### `sessions` (001 + 003)
| field                  | type        | notes                                        |
|------------------------|-------------|----------------------------------------------|
| id                     | uuid (pk)   |                                              |
| user_id                | uuid        | FK to `auth.users`                           |
| date                   | date        |                                              |
| exercises              | jsonb       | `ExerciseLog[]` — `{ name, sets: [{ reps, weight_lbs }] }` |
| completed              | boolean     |                                              |
| notes                  | text        |                                              |
| missed                 | boolean     | added 003                                    |
| flagged                | boolean     | added 003                                    |
| additional_activities  | jsonb       | added 003                                    |
| workout_name           | text        | added 003 — label like "Push" or "Day 2"     |
| created_at             | timestamptz |                                              |

### `memory` (001)
| field            | type     | notes                                       |
|------------------|----------|---------------------------------------------|
| user_id          | uuid (pk)|                                             |
| program_changes  | jsonb    | `[{ date, change, reason, affected_day }]`  |
| decisions        | jsonb    | `[{ date, topic, decision, user_agreed }]`  |
| signals          | jsonb    | `[{ date, type, note, flagged, resolved }]` |
| history_summary  | text     | compressed older history                    |
| current_program  | jsonb    | structured weekly program                   |
| updated_at       | timestamptz |                                          |

### `daily_threads` (002)
| field      | type        | notes                              |
|------------|-------------|------------------------------------|
| user_id    | uuid        | composite pk with `date`           |
| date       | date        | composite pk                       |
| thread     | jsonb       | `Message[]` for that calendar day  |
| updated_at | timestamptz |                                    |

A `pg_cron` job (`'0 3 * * *'`) deletes threads older than 7 days. Older context is preserved in `memory.history_summary`.

### `interactions` (001)
| field        | type        | notes                                |
|--------------|-------------|--------------------------------------|
| id           | uuid (pk)   |                                      |
| user_id      | uuid        |                                      |
| created_at   | timestamptz | used by daily rate-limit query       |
| model_used   | text        | full model ID                        |
| tokens_used  | int         | input + output                       |

### Row-level security
RLS is enabled on every table. Policy on each: `auth.uid() = user_id`.

### Auto-provisioning trigger
`handle_new_user()` fires after insert on `auth.users` and creates the matching `profiles` and `memory` rows.

---

## Claude API Layer

### Browser → server flow

The Anthropic API key is **never** sent to the browser. Every call:

```
src/lib/claude.js  →  POST /api/chat (SSE)  →  Anthropic Messages API
```

### `api/chat.js`
- Vercel serverless function.
- Accepts `{ messages, system, model }` and streams Anthropic deltas back as SSE events:
  - `data: { "delta": "<text>" }` for each text chunk
  - `data: { "done": true, "tokens": N, "model": "..." }` on completion
  - `data: { "error": "..." }` on failure
- Default model: `claude-sonnet-4-6`; caller overrides via the `model` field.

### `src/lib/claude.js` — entry points

| Function                  | Used for                                       | Model    |
|---------------------------|------------------------------------------------|----------|
| `callClaude`              | Home-mode chat with full history               | Haiku    |
| `callGreeting`            | Home greeting (with missed/today context)      | Haiku    |
| `callWelcome`             | First-open welcome after onboarding            | Haiku    |
| `callInsight`             | Single sharp dashboard observation             | Sonnet   |
| `callTrainingBalance`     | Categorical balance assessment (JSON output)   | Haiku    |
| `callFeedback`            | 1–2 sentence reaction after a completed session| Sonnet   |
| `callRestDaySuggestion`   | One-sentence rest-day Today card               | Haiku    |
| `callCompletedFeedback`   | One-sentence completed Today card              | Haiku    |
| `callActivityAck`         | Ack after logging an additional activity       | Haiku    |
| `callGenerateProgram`     | Build and save first program after onboarding  | Sonnet   |
| `callOnboarding`          | Onboarding intake conversation                 | Sonnet   |

### `routeModel(type)`
- `'program' | 'checkin' | 'analysis' | 'onboarding' | 'insight' | 'feedback'` → `claude-sonnet-4-6`
- everything else → `claude-haiku-4-5-20251001`

### `callClaude` flow (Home-mode chat)
1. `buildContextBrief(userId)` — pull profile, memory, last 12 completed sessions.
2. `buildSystemPrompt(brief)` — persona + brief.
3. `routeModel(type)` — pick model.
4. `checkUsageLimit(userId, model)` — throws if today's count is over the daily cap (fails open on infra errors).
5. `callApi` — POST `/api/chat`, stream deltas through `onChunk`.
6. `logInteraction(userId, model, tokens)` — fire-and-forget insert into `interactions`.
7. `extractAndSaveProgram` — if the response contains `<program_json>...</program_json>`, parse it, upsert into `memory.current_program`, and strip the tag from the displayed text.

### Daily rate limits (`claude.js`)
- Haiku family: **30** requests / user / day
- Sonnet family: **5** requests / user / day
- Counted from `interactions.created_at >= local midnight`, filtered by model family.
- On exceed: throws an error with a user-facing message; UI surfaces it via `isRateLimitError`.

### Token usage
Every successful stream completes with a `done` event carrying `tokens` (input + output). Persisted to `interactions.tokens_used`.

---

## System Prompt Structure

`buildSystemPrompt(brief, extra?)` composes the prompt in this order:

```
[COACHING_PERSONA — honest, warm, specific, no hype]
[Intelligence brief — formatted by memory.js]
[Optional task-specific prompt — onboarding, greeting, feedback, etc.]
```

All prompts live in `src/lib/prompts.js`. **Never inline prompts in components or hooks.** Notable prompts:
- `COACHING_PERSONA` — base persona injected everywhere
- `ONBOARDING_PROMPT` — natural intake, emits `<profile_json>`
- `PROGRAM_GENERATION_PROMPT` — emits `<program_json>`
- `GREETING_PROMPT`, `NEW_USER_WELCOME_PROMPT`
- `SESSION_FEEDBACK_PROMPT`, `COMPLETED_FEEDBACK_PROMPT`, `ACTIVITY_ACK_PROMPT`
- `REST_DAY_PROMPT`, `INSIGHT_PROMPT`, `buildTrainingBalancePrompt(categories)`

---

## Intelligence Brief (`src/lib/memory.js`)

`buildContextBrief(userId)` fetches in parallel and formats into prompt-ready sections:

```
=== USER PROFILE ===
Name, goal, experience, days/week, session length, equipment, injuries,
working weights (bench/squat/deadlift/OHP), physique priorities.

=== CURRENT PROGRAM ===
The structured program JSON from memory.current_program.

=== RECENT SESSIONS ===
Last 12 completed sessions, most recent first, each as a date + exercises with sets.

=== MEMORY ===
Program changes, standing decisions, active (non-resolved) signals.

=== HISTORY SUMMARY ===
The compressed older history (memory.history_summary).
```

Resolved signals are kept in the DB for audit but filtered out of the brief.

`resolveSignals(userId, [{ date, type, resolution }])` marks signals as resolved after weekly check-ins.

---

## Gym Mode State Machine (`src/hooks/useSession.js`)

```
IDLE
  → start() — fetch program + today's completion
PRE_SESSION
  → workout preview (or rest-day suggestion, or already-done state)
  → beginSession()
CONFIRM_WEIGHT
  → user adjusts weights; confirmWeights()
SET_ACTIVE
  → user taps reps
  → logSet(reps)
REST
  → timer counts down → advanceAfterRest()
  → loops back to SET_ACTIVE until last set of last exercise
SESSION_COMPLETE
  → insert session row (workout_name, exercises, completed=true)
  → callFeedback(userId, summary) → display reaction
```

`endEarly()` fills remaining sets with 0 reps and jumps to `SESSION_COMPLETE`.
If today is already complete, `start()` skips ahead to `SESSION_COMPLETE` without re-inserting.
If today is a rest day per the program schedule, `start()` stays in `PRE_SESSION` with `isRestDay=true`.

Day selection: `program.schedule?.[dayOfWeek]?.day_index` if present, otherwise round-robin by completed session count.

---

## Daily Thread (`src/hooks/useDailyThread.js`)

Home mode keeps **one thread per user per day**. On mount:
- If `postGymFeedback` is provided → clear today's thread and start fresh with the feedback line.
- Else if `profiles.last_chat_date < today` →
  1. `detectAndLogMissedSession` (writes DB first so context is correct)
  2. `callGreeting` with `{ missed, workoutName, todayWorkoutLabel }`
  3. Save the thread + bump `last_chat_date`
- Else → restore today's thread from `daily_threads`.

Threads older than 7 days are deleted nightly by `pg_cron` (their substance lives on in `memory.history_summary`).

---

## PWA Configuration

### `public/manifest.json`
- `name`: "FitAgent"
- `short_name`: "FitAgent"
- `display`: "standalone"
- dark background + theme color
- icons: 192×192, 512×512

### `public/service-worker.js`
- Cache shell assets on install
- Network-first for API calls
- Cache-first for static assets

---

## Context Window Management

### Short term (months 1–3)
Send up to 12 recent completed sessions in full detail.

### Medium term (months 3+)
- Last ~4 weeks: full session detail (the recent 12)
- Older history: compressed `memory.history_summary`

### Summary generation prompt
"Summarize this user's training history older than 4 weeks into 2–3 sentences capturing PRs, patterns, recurring issues, and notable progress."

---

## Cost Control

- **Model routing** — Haiku for casual interactions saves ~70% on the most frequent calls.
- **Prompt caching** — system prompt + profile are the cache-friendly portion.
- **Daily caps** — 30 Haiku / 5 Sonnet per user per day, enforced in `claude.js`.
- **Trial gate** — 15 days from first signup; expired users get routed to `/trial-expired`.
- **Per-call logging** — every interaction writes `model_used` + `tokens_used` to `interactions`.
