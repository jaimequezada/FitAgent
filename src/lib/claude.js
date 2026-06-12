// claude.js
// All Claude API calls go through this module.
// Browser → /api/chat (SSE stream) → Anthropic API.
// ANTHROPIC_API_KEY is never exposed to the browser.

import { supabase } from './supabase'
import { buildContextBrief, resolveSignals } from './memory'
import {
  buildSystemPrompt,
  buildCardSystemPrompt,
  buildWeeklyCheckinPrompt,
  ONBOARDING_PROMPT,
  SESSION_FEEDBACK_PROMPT,
  NEW_USER_WELCOME_PROMPT,
  PROGRAM_GENERATION_PROMPT,
  INSIGHT_PROMPT,
  buildTrainingBalancePrompt,
  REST_DAY_PROMPT,
  COMPLETED_FEEDBACK_PROMPT,
  ACTIVITY_ACK_PROMPT,
} from './prompts'

// Returns true if the request was rejected by the server's daily cap (HTTP 429).
// The server's error message contains "daily limit"; surfaced via callApi.
export function isRateLimitError(err) {
  return Boolean(err?.message?.includes('daily limit'))
}

// Daily usage limits, authentication, and interaction logging are all enforced
// server-side in api/chat.js — the browser cannot be trusted to gate cost.

// Sliding window: only the most recent chat turns are sent to the model. Older
// turns drop out of the transcript — durable facts live in the structured
// memory brief (buildContextBrief), which is rebuilt and re-sent on every call,
// so nothing important is lost. This bounds per-call input cost on long
// single-day conversations.
const MAX_HISTORY_MESSAGES = 20

// Keep the last `max` messages, then drop any leading assistant turns so the
// window opens on a user message — the Messages API requires messages[0] to be
// role 'user' (the daily thread's first message is the assistant greeting).
function windowHistory(history, max = MAX_HISTORY_MESSAGES) {
  let win = history.slice(-max)
  while (win.length && win[0].role !== 'user') win = win.slice(1)
  return win
}

// callClaude(message, userId, type, history, onChunk, onProgramSaved)
// The main entry point for all Home-mode agent interactions.
//   message        — the user's latest message string
//   userId         — for fetching context (auth + logging happen server-side)
//   type           — 'chat' | 'program' | 'checkin' | 'analysis' | 'feedback'
//   history        — prior { role, content }[] pairs for this conversation
//   onChunk        — optional (chunk: string) => void called as tokens stream in
//   onProgramSaved — optional () => void called after a program is extracted and saved
// Returns the full response text when complete.
export async function callClaude(message, userId, type = 'chat', history = [], onChunk = null, onProgramSaved = null) {
  const brief    = await buildContextBrief(userId)
  const system   = buildSystemPrompt(brief)
  const model    = routeModel(type)
  const messages = [
    ...windowHistory(history).map(({ role, content }) => ({ role, content })),
    { role: 'user', content: message },
  ]

  const { content } = await callApi({ messages, system, model, onChunk })


  return extractAndSaveProgram(content, userId, onProgramSaved)
}

// callWelcome(userId)
// Generates a personal first-open welcome message for new users (after onboarding).
export async function callWelcome(userId) {
  const brief  = await buildContextBrief(userId)
  const system = buildCardSystemPrompt(brief, NEW_USER_WELCOME_PROMPT)
  const model  = routeModel('chat')

  const { content } = await callApi({
    messages: [{ role: 'user', content: 'Generate my welcome message.' }],
    system,
    model,
  })

  return content
}

// callInsight(userId)
// Generates a single sharp observation for the returning-user dashboard.
export async function callInsight(userId) {
  const brief  = await buildContextBrief(userId)
  const system = buildCardSystemPrompt(brief, INSIGHT_PROMPT)
  const model  = routeModel('insight')

  const { content } = await callApi({
    messages: [{ role: 'user', content: 'Generate my training insight.' }],
    system,
    model,
  })

  return content
}

// callTrainingBalance(userId, categories)
// Generates training balance assessment for the dashboard.
// categories: string[] of fixed labels derived from the user's program (e.g. ['Push', 'Pull', 'Legs']).
// Returns parsed categories array or null on failure.
export async function callTrainingBalance(userId, categories) {
  const brief  = await buildContextBrief(userId)
  const system = buildCardSystemPrompt(brief, buildTrainingBalancePrompt(categories))
  const model  = routeModel('chat')

  const { content } = await callApi({
    messages: [{ role: 'user', content: 'Generate my training balance assessment.' }],
    system,
    model,
  })


  const match = content.match(/<balance_json>([\s\S]*?)<\/balance_json>/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[1].trim())
    return Array.isArray(parsed.categories) ? parsed.categories : null
  } catch {
    return null
  }
}

// callFeedback(userId, summary)
// Generates a brief 1-2 sentence reaction after a completed gym session.
export async function callFeedback(userId, summary) {
  const brief  = await buildContextBrief(userId)
  const system = buildCardSystemPrompt(brief, SESSION_FEEDBACK_PROMPT)
  const model  = routeModel('feedback')

  const { content } = await callApi({
    messages: [{ role: 'user', content: summary }],
    system,
    model,
  })


  return content
}

// callRestDaySuggestion(userId)
// Generates a one-sentence rest day suggestion for the Today card.
export async function callRestDaySuggestion(userId) {
  const brief  = await buildContextBrief(userId)
  const system = buildCardSystemPrompt(brief, REST_DAY_PROMPT)
  const model  = routeModel('chat')

  const { content } = await callApi({
    messages: [{ role: 'user', content: 'Generate my rest day suggestion.' }],
    system,
    model,
  })

  return content
}

// callCompletedFeedback(userId, exercises)
// Generates a one-sentence feedback line for the completed Today card.
// exercises: ExerciseLog[] from the completed session
export async function callCompletedFeedback(userId, exercises = []) {
  const brief  = await buildContextBrief(userId)
  const system = buildCardSystemPrompt(brief, COMPLETED_FEEDBACK_PROMPT)
  const model  = routeModel('chat')

  const sessionSummary = exercises.length > 0
    ? exercises.map(ex => {
        const sets = (ex.sets ?? []).map(s => `${s.reps}×${s.weight_lbs}lbs`).join(', ')
        return `${ex.name}: ${sets}`
      }).join('; ')
    : 'Session completed (no exercise details available)'

  const { content } = await callApi({
    messages: [{ role: 'user', content: `Today's session: ${sessionSummary}` }],
    system,
    model,
  })

  return content
}

// callActivityAck(userId, activityType, durationMinutes, notes)
// Generates a one-sentence acknowledgment after logging an additional activity.
export async function callActivityAck(userId, activityType, durationMinutes = null, notes = '') {
  const brief  = await buildContextBrief(userId)
  const system = buildCardSystemPrompt(brief, ACTIVITY_ACK_PROMPT)
  const model  = routeModel('chat')

  const parts = [`Activity logged: type=${activityType}`]
  if (durationMinutes) parts.push(`duration=${durationMinutes}min`)
  if (notes) parts.push(`notes="${notes}"`)

  const { content } = await callApi({
    messages: [{ role: 'user', content: parts.join(', ') }],
    system,
    model,
  })

  return content
}

// callWeeklyCheckin(userId, { trialFinal })
// Generates the weekly (or end-of-trial) coach check-in shown as a chat message.
// Sonnet — it reviews a week of data and may propose a program change.
// Returns { message, proposedProgram | null, resolvedSignals }.
// Signals are resolved immediately; the program is NOT saved here — it's returned
// as a proposal for the user to approve in the Agent (see saveProgram).
export async function callWeeklyCheckin(userId, { trialFinal = false } = {}) {
  const brief  = await buildContextBrief(userId)
  const system = buildSystemPrompt(brief, buildWeeklyCheckinPrompt({ trialFinal }))
  const model  = routeModel('checkin')

  const { content } = await callApi({
    messages: [{ role: 'user', content: 'Generate my check-in.' }],
    system,
    model,
    maxTokens: 8192, // a proposed full program can exceed the 4096 default
  })

  // Optional proposed program — parsed but NOT saved (suggest-then-approve).
  let proposedProgram = null
  const programMatch = content.match(/<program_json>([\s\S]*?)<\/program_json>/)
  if (programMatch) {
    try { proposedProgram = JSON.parse(programMatch[1].trim()) }
    catch (e) { console.warn('[callWeeklyCheckin] program proposal parse failed:', e.message) }
  }

  // Resolved signals — applied immediately.
  let resolvedSignals = []
  const checkinMatch = content.match(/<checkin_json>([\s\S]*?)<\/checkin_json>/)
  if (checkinMatch) {
    try {
      const parsed = JSON.parse(checkinMatch[1].trim())
      if (Array.isArray(parsed.resolved_signals)) resolvedSignals = parsed.resolved_signals
    } catch (e) { console.warn('[callWeeklyCheckin] checkin_json parse failed:', e.message) }
  }
  if (resolvedSignals.length) {
    try { await resolveSignals(userId, resolvedSignals) }
    catch (e) { console.error('[callWeeklyCheckin] resolveSignals failed:', e) }
  }

  const message = content
    .replace(/<program_json>[\s\S]*?<\/program_json>/, '')
    .replace(/<checkin_json>[\s\S]*?<\/checkin_json>/, '')
    .trim()

  return { message, proposedProgram, resolvedSignals }
}

// saveProgram(userId, program) — persist an approved program to memory.current_program.
// Used when the user accepts a check-in's proposed program change. Returns bool.
export async function saveProgram(userId, program) {
  const { error } = await supabase
    .from('memory')
    .upsert({ user_id: userId, current_program: program }, { onConflict: 'user_id' })
  if (error) { console.error('[saveProgram] upsert failed:', error); return false }
  return true
}

// callGenerateProgram(userId)
// Generates and saves the user's first training program after onboarding.
// Uses Sonnet, reads the freshly saved profile via buildContextBrief,
// extracts <program_json> and saves to memory.current_program.
// Returns the saved program object, or null on failure.
export async function callGenerateProgram(userId) {
  const brief  = await buildContextBrief(userId)
  const system = buildSystemPrompt(brief, PROGRAM_GENERATION_PROMPT)
  const model  = routeModel('program')

  const { content } = await callApi({
    messages: [{ role: 'user', content: 'Generate my complete training program based on my profile. Output the full program in <program_json> tags.' }],
    system,
    model,
    maxTokens: 8192, // full weekly program JSON can exceed the 4096 default and get truncated
  })

  const match = content.match(/<program_json>([\s\S]*?)<\/program_json>/)
  if (!match) {
    console.error('[callGenerateProgram] no <program_json> in response. Full response:', content.slice(0, 500))
    return null
  }

  let program
  try { program = JSON.parse(match[1].trim()) } catch (e) {
    console.error('[callGenerateProgram] JSON parse failed:', e.message)
    return null
  }

  const { error } = await supabase
    .from('memory')
    .upsert({ user_id: userId, current_program: program }, { onConflict: 'user_id' })

  if (error) {
    console.error('[callGenerateProgram] upsert failed:', error)
    return null
  }

  console.log('[callGenerateProgram] program saved OK for user:', userId)
  return program
}

// callOnboarding(messages, onChunk)
// Used during the 4-exchange onboarding flow.
// onChunk is optional — called with each streamed text delta.
export async function callOnboarding(messages, onChunk = null) {
  const { content } = await callApi({
    messages,
    system: ONBOARDING_PROMPT,
    // Haiku, not Sonnet: onboarding fires one call per turn, and the server caps
    // Sonnet at 5/day. On Sonnet, a normal intake (~5 turns) exhausted the budget
    // before callGenerateProgram could run, so new accounts got no program. Intake
    // is a simple structured conversation Haiku handles well; this keeps the whole
    // Sonnet budget available for program generation.
    model: routeModel('chat'),
    onChunk,
  })
  return content
}

// routeModel — Haiku for quick chat, Sonnet for reasoning-heavy tasks
export function routeModel(type) {
  const sonnetTypes = ['program', 'checkin', 'analysis', 'onboarding', 'insight', 'feedback']
  return sonnetTypes.includes(type) ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001'
}

// callApi({ messages, system, model, maxTokens, onChunk })
// Reads SSE stream from /api/chat. Calls onChunk with each text delta.
// Returns { content, tokens } when the stream ends.
// Sends the user's Supabase access token so the server can authenticate the
// caller and enforce the daily caps (the server is the single source of truth).
async function callApi({ messages, system, model, maxTokens, onChunk }) {
  const payload = messages.length === 0
    ? [{ role: 'user', content: 'Begin.' }]
    : messages

  const { data: { session } } = await supabase.auth.getSession()
  const accessToken = session?.access_token
  if (!accessToken) throw new Error('Not signed in')

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    // Send the browser's UTC offset so the server can reset the daily usage cap at
    // the user's LOCAL midnight, consistent with the rest of the app's local dates.
    body: JSON.stringify({ messages: payload, system, model, maxTokens, tzOffsetMinutes: new Date().getTimezoneOffset() }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    // Server-side trial enforcement (api/chat.js). Send the user to the
    // trial-expired screen instead of surfacing a raw error in the chat UI.
    if (res.status === 403 && err.code === 'trial_expired') {
      window.location.replace('/trial-expired')
    }
    throw new Error(err.error || `API error ${res.status}`)
  }

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer  = ''
  let content = ''
  let tokens  = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const json = line.slice(6).trim()
      if (!json) continue
      try {
        const data = JSON.parse(json)
        if (data.error) throw new Error(data.error)
        if (data.delta) {
          content += data.delta
          onChunk?.(data.delta)
        }
        if (data.done) tokens = data.tokens ?? 0
      } catch (e) {
        if (e.message !== json) throw e
      }
    }
  }

  return { content, tokens }
}

// extractAndSaveProgram — looks for <program_json> in the response.
// If found: saves to memory.current_program and strips the tag from the displayed text.
async function extractAndSaveProgram(content, userId, onProgramSaved = null) {
  const match = content.match(/<program_json>([\s\S]*?)<\/program_json>/)
  if (!match) {
    if (content.includes('<program_json>')) {
      console.warn('[extractAndSaveProgram] opening tag found but no closing tag — program not saved')
    }
    return content
  }

  console.log('[extractAndSaveProgram] found program JSON, saving for userId:', userId)
  try {
    const program = JSON.parse(match[1].trim())
    const { data, error } = await supabase
      .from('memory')
      .upsert({ user_id: userId, current_program: program }, { onConflict: 'user_id' })
    if (error) console.error('[extractAndSaveProgram] upsert failed:', error)
    else {
      console.log('[extractAndSaveProgram] saved OK:', data)
      onProgramSaved?.()
    }
  } catch (e) {
    console.error('[extractAndSaveProgram] exception:', e)
  }

  return content.replace(/<program_json>[\s\S]*?<\/program_json>/, '').trim()
}
