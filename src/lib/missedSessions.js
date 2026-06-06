// missedSessions.js
// Detects scheduled workouts the user missed since they were last active and
// persists a session record + memory signal for each.
//
// Call detectAndLogMissedSession(userId, { since }) on every new-day dashboard
// mount, BEFORE buildContextBrief so the signals are included in the greeting.
//
// `since` is the user's last_chat_date (YYYY-MM-DD). When provided, every
// scheduled day strictly after it and before today is checked — so a multi-day
// gap is fully captured, not just yesterday. Without it (first run), only
// yesterday is checked to avoid back-filling the user's entire history.

import { supabase } from './supabase'
import { localDateStr } from './dates'

const DEFAULT_LOOKBACK_DAYS = 7

// detectAndLogMissedSession(userId, { since, lookbackDays })
// Returns:
//   { missed: false, count: 0 }
//   { missed: true, count, workoutName, mostRecentDate }  — workoutName is the
//      most recently missed workout (used by the greeting).
export async function detectAndLogMissedSession(
  userId,
  { since = null, lookbackDays = DEFAULT_LOOKBACK_DAYS } = {}
) {
  // STEP 1 — Build candidate days (most recent first), local time throughout.
  const candidates = []
  for (let n = 1; n <= lookbackDays; n++) {
    const d = new Date()
    d.setDate(d.getDate() - n)
    const dateStr = localDateStr(d)
    if (since) {
      if (dateStr <= since) break // older than last activity → already handled
    } else if (n > 1) {
      break                       // no anchor → only check yesterday
    }
    candidates.push({ date: dateStr, dow: d.getDay() })
  }
  if (candidates.length === 0) return { missed: false, count: 0 }

  // STEP 2 — Fetch program + signals once.
  const { data: memoryData } = await supabase
    .from('memory')
    .select('current_program, signals')
    .eq('user_id', userId)
    .single()

  const schedule = memoryData?.current_program?.schedule
  if (!schedule) return { missed: false, count: 0 } // no schedule → can't tell

  // STEP 3 — Never flag users with no completed sessions yet.
  const { count: completedCount } = await supabase
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('completed', true)
  if ((completedCount ?? 0) === 0) return { missed: false, count: 0 }

  // STEP 4 — Keep only scheduled (non-rest) candidate days.
  const scheduled = candidates
    .map(c => ({ ...c, entry: schedule[c.dow] }))
    .filter(c => c.entry)
  if (scheduled.length === 0) return { missed: false, count: 0 }

  // STEP 5 — Fetch every session in the window in one query.
  const windowStart = scheduled[scheduled.length - 1].date // oldest
  const windowEnd   = scheduled[0].date                    // newest
  const { data: windowSessions } = await supabase
    .from('sessions')
    .select('id, date, completed, missed')
    .eq('user_id', userId)
    .gte('date', windowStart)
    .lte('date', windowEnd)

  const byDate = {}
  for (const s of windowSessions ?? []) byDate[s.date] = s

  // STEP 6 — Classify each scheduled day.
  const signals      = memoryData?.signals ?? []
  const toInsert     = []
  const toMarkMissed = []
  const newSignals   = []
  const missedDays   = [] // most recent first

  for (const c of scheduled) {
    const existing = byDate[c.date]
    if (existing?.completed) continue // completed → not missed

    const name = c.entry.name ?? 'Workout'
    missedDays.push({ date: c.date, name })

    if (!existing) {
      toInsert.push({
        user_id:      userId,
        date:         c.date,
        workout_name: name,
        completed:    false,
        missed:       true,
        exercises:    [],
        notes:        'Auto-logged: session not completed',
      })
    } else if (existing.missed !== true) {
      toMarkMissed.push(existing.id)
    }

    const hasSignal = signals.some(
      s => s.date === c.date && s.type === 'missed_session'
    )
    if (!hasSignal) {
      newSignals.push({
        date:     c.date,
        type:     'missed_session',
        note:     `${name} missed — no session logged`,
        flagged:  false,
        resolved: false,
      })
    }
  }

  if (missedDays.length === 0) return { missed: false, count: 0 }

  // STEP 7 — Persist (batched).
  if (toInsert.length) {
    await supabase.from('sessions').insert(toInsert)
  }
  if (toMarkMissed.length) {
    await supabase.from('sessions').update({ missed: true }).in('id', toMarkMissed)
  }
  if (newSignals.length) {
    await supabase
      .from('memory')
      .update({ signals: [...signals, ...newSignals] })
      .eq('user_id', userId)
  }

  // STEP 8 — Result (missedDays[0] is the most recent).
  return {
    missed:         true,
    count:          missedDays.length,
    workoutName:    missedDays[0].name,
    mostRecentDate: missedDays[0].date,
  }
}
