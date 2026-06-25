# FitAgent

A PWA fitness coaching agent powered by Claude AI. Not a traditional fitness app — an intelligent coach that remembers your training history, adapts your program over time, and feels like a conversation with a knowledgeable coach, not a form to fill out.

**Live demo:** [fitagent.jaimequezada.com](https://fitagent.jaimequezada.com)

---

## What It Does

Most fitness apps just log. FitAgent reasons. It knows your working weights, your injury history, your goals, and your last four weeks of training — and uses that context to give you coaching that actually applies to you.

Ask it why you're stuck on bench. It knows. Tell it your shoulder is acting up. It adjusts your program. Log a session. It gives you real feedback, not a generic "great job."

---

## Two Modes

### Home — Conversational coaching
- Context-aware greeting on every open
- Chat directly with your AI coach
- PR tracking for your top lifts
- Weekly training insights
- Full access to your training history and memory

### Gym — Focused session logging
- One exercise at a time, no distractions
- Pre-populated target reps as tap buttons
- Rest timer between sets
- Weight confirmed once at session start
- AI feedback on session complete

---

## Features

- **Conversational onboarding** — no forms, Claude extracts your profile through natural conversation
- **Persistent memory** — program changes, coaching decisions, and training signals are stored and referenced on every interaction
- **Smart program generation** — Claude generates a structured weekly program based on your goals, schedule, and equipment
- **Model routing** — Haiku for quick chat interactions, Sonnet for program generation and complex reasoning
- **PWA** — installable on mobile, works like a native app
- **15-day free trial** — full access, no credit card required

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Styling | TailwindCSS |
| Database + Auth | Supabase |
| AI | Anthropic Claude API (Haiku + Sonnet) |
| Deployment | Vercel |
| PWA | manifest.json + service worker |

---

## Architecture

### The Agent Is the Product
Claude does all fitness reasoning. The app manages data and presentation only. There is no hardcoded fitness logic anywhere in the codebase — every coaching decision is reasoned by the model from user context.

### Memory System
Each user has three living JSON documents stored in Supabase:
- **program_changes** — every modification to the training program with rationale
- **decisions** — standing coaching decisions the user has agreed to
- **signals** — patterns and flags being monitored (e.g. stalled lift, recurring fatigue)

These are injected into every API call as an intelligence brief, giving Claude full context without storing raw conversation history.

### Context Construction
Every Claude API call receives:
1. Coaching persona and tone instructions
2. User profile (goals, equipment, experience, injuries)
3. Current training program
4. Last 4 weeks of sessions in full detail
5. Memory brief (changes, decisions, signals)

### Model Routing
- **claude-haiku** — casual chat, quick questions, logging confirmations
- **claude-sonnet** — program generation, weekly check-ins, complex analysis

---

Built with [Claude Code](https://claude.ai/code)
