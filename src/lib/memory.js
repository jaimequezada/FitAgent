// memory.js
// Fetches user context from Supabase and formats it into a prompt-ready string.
// buildContextBrief(userId) is the only export called by claude.js.

import { supabase } from './supabase'

// Fetch all three data sources in parallel, then format.
export async function buildContextBrief(userId) {
  const [profileRes, memoryRes, sessionsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', userId).single(),
    supabase.from('memory').select('*').eq('user_id', userId).single(),
    supabase
      .from('sessions')
      .select('date, exercises, notes, completed')
      .eq('user_id', userId)
      .eq('completed', true)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(12),
  ])

  const profile  = profileRes.data  ?? {}
  const memory   = memoryRes.data   ?? {}
  const sessions = sessionsRes.data ?? []

  return buildBrief(profile, memory, sessions)
}

// Format raw data into a structured string for prompt injection.
export function buildBrief(profile, memory, sessions) {
  const sections = []

  // --- User profile ---
  const ww = profile.working_weights ?? {}
  const lifts = [
    ww.bench_lbs    && `Bench ${ww.bench_lbs}lbs`,
    ww.squat_lbs    && `Squat ${ww.squat_lbs}lbs`,
    ww.deadlift_lbs && `Deadlift ${ww.deadlift_lbs}lbs`,
    ww.ohp_lbs      && `OHP ${ww.ohp_lbs}lbs`,
  ].filter(Boolean)

  sections.push([
    '=== USER PROFILE ===',
    [
      profile.name          && `Name: ${profile.name}`,
      profile.goal          && `Goal: ${profile.goal}`,
      profile.experience_months != null && `Experience: ${profile.experience_months} months`,
      profile.days_per_week  && `Days/week: ${profile.days_per_week}`,
      profile.session_length && `Session: ${profile.session_length}min`,
    ].filter(Boolean).join(' | '),
    profile.equipment && `Equipment: ${profile.equipment}`,
    profile.injuries  && `Injuries: ${profile.injuries}`,
    lifts.length      && `Working weights: ${lifts.join(' | ')}`,
    profile.physique_priorities && `Priorities: ${profile.physique_priorities}`,
  ].filter(Boolean).join('\n'))

  // --- Current program ---
  const program = memory.current_program ?? {}
  if (Object.keys(program).length > 0) {
    sections.push([
      '=== CURRENT PROGRAM ===',
      typeof program === 'string' ? program : JSON.stringify(program, null, 2),
    ].join('\n'))
  }

  // --- Recent sessions (last 4 weeks = ~12 sessions max) ---
  if (sessions.length > 0) {
    const sessionLines = sessions.map(s => {
      const exercises = (s.exercises ?? []).map(ex => {
        const sets = (ex.sets ?? []).map(set => `${set.reps}×${set.weight_lbs}lbs`).join(', ')
        return `  ${ex.name}: ${sets}`
      }).join('\n')
      const note = s.notes ? ` — "${s.notes}"` : ''
      return `${s.date}${note}\n${exercises}`
    })
    sections.push(['=== RECENT SESSIONS ===', ...sessionLines].join('\n'))
  }

  // --- Memory documents ---
  const changes   = memory.program_changes ?? []
  const decisions = memory.decisions       ?? []
  // Filter out resolved signals — they are kept in DB for history but excluded from Claude context
  const signals   = (memory.signals ?? []).filter(s => s.resolved !== true)

  if (changes.length || decisions.length || signals.length) {
    const memLines = ['=== MEMORY ===']
    if (changes.length)   memLines.push('Program changes:\n' + changes.map(c => `  - ${JSON.stringify(c)}`).join('\n'))
    if (decisions.length) memLines.push('Standing decisions:\n' + decisions.map(d => `  - ${JSON.stringify(d)}`).join('\n'))
    if (signals.length)   memLines.push('Active signals:\n' + signals.map(s => `  - ${JSON.stringify(s)}`).join('\n'))
    sections.push(memLines.join('\n'))
  }

  // --- History summary (older compressed sessions) ---
  if (memory.history_summary) {
    sections.push(['=== HISTORY SUMMARY ===', memory.history_summary].join('\n'))
  }

  return sections.join('\n\n')
}

// resolveSignals(userId, resolvedSignals)
// Called after a weekly check-in to mark addressed signals as resolved.
// resolvedSignals: Array<{ date: string, type: string, resolution: string }>
export async function resolveSignals(userId, resolvedSignals) {
  if (!resolvedSignals?.length) return

  const { data: memoryData } = await supabase
    .from('memory')
    .select('signals')
    .eq('user_id', userId)
    .single()

  const signals = memoryData?.signals ?? []
  let changed = false

  const updated = signals.map(signal => {
    const match = resolvedSignals.find(
      r => r.date === signal.date && r.type === signal.type
    )
    if (match && !signal.resolved) {
      changed = true
      return { ...signal, resolved: true }
    }
    return signal
  })

  if (changed) {
    await supabase
      .from('memory')
      .update({ signals: updated })
      .eq('user_id', userId)
  }
}
