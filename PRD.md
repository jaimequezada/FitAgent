# FitAgent — Product Requirements Document

## Target User
Intermediate gym-goer (6-18 months experience).
Trains 3-5x per week, has basic knowledge,
hitting plateaus, wants smarter programming
without paying for a real coach.

## Core Problem
Progressive overload tracking is manual and mindless.
Exercise selection is full of hidden redundancy.
No app reasons about these things — they just log.

---

## The Two Modes

### Home Mode
- Conversational agent interface
- Agent greeting is context-aware on open
- PR cards (top 3 lifts) visible at top
- Last session summary (one line)
- Chat input always prominent
- Agent has access to full memory brief
- Web search enabled for fitness questions

### Gym Mode
- Triggered by "I'm at the gym" button
- Shows today's planned workout only
- One exercise at a time
- Pre-populated target reps as tap buttons
- Weight confirmed once at session start
- Rest timer between sets
- Zero navigation — forward only
- Brief agent feedback on session complete

---

## Onboarding Flow
Conversational — 4 exchanges maximum.

1. Training background and current routine
2. Working weights on big lifts
3. Goals and constraints
4. Agent confirms understanding, generates program

Data extracted to structured JSON profile:
- age, sex, weight, height
- training_experience_months
- current_program
- working_weights (bench, squat, deadlift, ohp)
- goal (hypertrophy / strength / athletic)
- physique_priorities
- available_equipment
- days_per_week
- session_length_minutes
- injuries_limitations

---

## Memory Architecture
Three living JSON documents per user:

### program_changes
```json
[
  {
    "date": "",
    "change": "",
    "reason": "",
    "affected_day": ""
  }
]
```

### decisions
```json
[
  {
    "date": "",
    "topic": "",
    "decision": "",
    "user_agreed": true
  }
]
```

### signals
```json
[
  {
    "date": "",
    "type": "",
    "note": "",
    "flagged": false
  }
]
```

### user_preferences (built passively over time)
```json
{
  "communication_style": "",
  "program_style": "",
  "goals_priority": "",
  "dislikes": [],
  "responds_well_to": ""
}
```

---

## Agent Intelligence Brief
Constructed fresh each API call:
- User profile summary
- Current program
- Last 4 weeks sessions (full detail)
- Older history (compressed summary)
- Recent program changes
- Standing decisions
- Active signals to monitor

---

## Model Routing
- **Haiku:** casual chat, quick questions,
  logging confirmations
- **Sonnet:** program generation, weekly check-ins,
  redundancy analysis, complex reasoning,
  web search queries

---

## Freemium Model
- **Free:** 20 lifetime interactions
- **Paid:** $9.99/month unlimited
- Upgrade prompt: contextual, never a hard wall
- No hard cutoff mid-conversation
- Payment: Stripe

---

## Design Language
- Dark, minimal — not aggressive gym aesthetic
- Conversational UI is the dominant element
- Data appears inline as subtle cards in chat
- Large tap targets for gym mode
- No hamburger menus
- Maximum 2 navigation points
- No stock fitness photography
- No motivational banners or generic progress rings
