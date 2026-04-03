// missedSessions.js
// Detects whether the user missed a scheduled workout yesterday and persists
// a session record + memory signal if so.
//
// Call detectAndLogMissedSession(userId) on every new-day dashboard mount,
// BEFORE buildContextBrief so the signal is included in the greeting context.

import { supabase } from './supabase'

// detectAndLogMissedSession(userId)
// Returns:
//   { missed: false }                                  — yesterday was rest or session was completed
//   { missed: true, alreadyLogged: true,  workoutName } — already written on a prior mount today
//   { missed: true, alreadyLogged: false, workoutName } — freshly written this mount
export async function detectAndLogMissedSession(userId) {
  // STEP 1 — Determine yesterday
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayDate     = yesterday.toISOString().split('T')[0]
  const yesterdayDayOfWeek = yesterday.getDay()

  // STEP 2 — Fetch current program + signals from memory
  const { data: memoryData } = await supabase
    .from('memory')
    .select('current_program, signals')
    .eq('user_id', userId)
    .single()

  const program  = memoryData?.current_program ?? {}
  const schedule = program.schedule

  // STEP 3 — If no schedule exists we cannot determine missed sessions
  if (!schedule) return { missed: false }

  // STEP 3b — Never flag missed sessions for users with no completed sessions yet
  const { count } = await supabase
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('completed', true)
  if ((count ?? 0) === 0) return { missed: false }

  const schedEntry = schedule[yesterdayDayOfWeek]

  // No workout scheduled yesterday → not a missed session
  if (!schedEntry) return { missed: false }

  const yesterdayWorkout = {
    name:      schedEntry.name ?? 'Workout',
    day_index: schedEntry.day_index,
  }

  // STEP 4 — Check for an existing session record for yesterday
  const { data: existingSession } = await supabase
    .from('sessions')
    .select('id, completed, missed')
    .eq('user_id', userId)
    .eq('date', yesterdayDate)
    .maybeSingle()

  // STEP 5 — Determine if missed
  // Missed = had a scheduled workout AND (no session OR session not completed)
  const wasMissed = !existingSession || !existingSession.completed

  if (!wasMissed) return { missed: false }

  // STEP 6 — Check if already logged (idempotency guard)
  if (existingSession?.missed === true) {
    return {
      missed:       true,
      alreadyLogged: true,
      workoutName:  yesterdayWorkout.name,
    }
  }

  // STEP 7 — Write / update session record
  if (!existingSession) {
    await supabase.from('sessions').insert({
      user_id:      userId,
      date:         yesterdayDate,
      workout_name: yesterdayWorkout.name,
      completed:    false,
      missed:       true,
      exercises:    [],
      notes:        'Auto-logged: session not completed',
    })
  } else {
    // Session exists but not completed — mark as missed
    await supabase
      .from('sessions')
      .update({ missed: true })
      .eq('id', existingSession.id)
  }

  // STEP 8 — Append signal to memory (idempotency guard on date+type)
  const signals       = memoryData?.signals ?? []
  const alreadySignal = signals.some(
    s => s.date === yesterdayDate && s.type === 'missed_session'
  )

  if (!alreadySignal) {
    const newSignal = {
      date:     yesterdayDate,
      type:     'missed_session',
      note:     `${yesterdayWorkout.name} missed — no session logged`,
      flagged:  false,
      resolved: false,
    }
    await supabase
      .from('memory')
      .update({ signals: [...signals, newSignal] })
      .eq('user_id', userId)
  }

  // STEP 9 — Return result
  return {
    missed:        true,
    alreadyLogged: false,
    workoutName:   yesterdayWorkout.name,
  }
}
