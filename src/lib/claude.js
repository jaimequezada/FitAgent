// claude.js
// All Claude API calls go through this module.
// Browser → /api/chat (SSE stream) → Anthropic API.
// ANTHROPIC_API_KEY is never exposed to the browser.

import { supabase } from './supabase'
import { buildContextBrief } from './memory'
import {
  buildSystemPrompt,
  ONBOARDING_PROMPT,
  GREETING_PROMPT,
  SESSION_FEEDBACK_PROMPT,
  NEW_USER_WELCOME_PROMPT,
  PROGRAM_GENERATION_PROMPT,
  INSIGHT_PROMPT,
  buildTrainingBalancePrompt,
  REST_DAY_PROMPT,
  COMPLETED_FEEDBACK_PROMPT,
  ACTIVITY_ACK_PROMPT,
} from './prompts'

// Returns true if the error was thrown by checkUsageLimit.
export function isRateLimitError(err) {
  return Boolean(err?.message?.includes('daily limit'))
}

// ─── Daily usage limits ───────────────────────────────────────────────────────
const DAILY_LIMIT_HAIKU  = 30
const DAILY_LIMIT_SONNET = 5

// Throws if the user has exceeded their daily limit for the given model family.
// Fails open (no-op) if the Supabase query errors — never block on infra failure.
async function checkUsageLimit(userId, model) {
  if (!userId) return
  const isHaiku = model.includes('haiku')
  const limit   = isHaiku ? DAILY_LIMIT_HAIKU : DAILY_LIMIT_SONNET
  const family  = isHaiku ? 'haiku' : 'sonnet'

  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)

  const { count, error } = await supabase
    .from('interactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .ilike('model_used', `%${family}%`)
    .gte('created_at', midnight.toISOString())

  if (error) return // fail open

  if (count >= limit) {
    throw new Error(
      isHaiku
        ? `You've reached your daily limit of ${DAILY_LIMIT_HAIKU} requests. Resets at midnight.`
        : `You've reached your daily limit of ${DAILY_LIMIT_SONNET} complex requests (program updates, analysis). Resets at midnight.`
    )
  }
}

// callClaude(message, userId, type, history, onChunk, onProgramSaved)
// The main entry point for all Home-mode agent interactions.
//   message        — the user's latest message string
//   userId         — for fetching context and logging tokens
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
    ...history.map(({ role, content }) => ({ role, content })),
    { role: 'user', content: message },
  ]

  await checkUsageLimit(userId, model)
  const { content, tokens } = await callApi({ messages, system, model, onChunk })

  logInteraction(userId, model, tokens)

  return extractAndSaveProgram(content, userId, onProgramSaved)
}

// callGreeting(userId, missedContext)
// Generates a short context-aware greeting for the Home screen.
// missedContext: { missed: bool, workoutName: string|null, todayWorkoutLabel: string|null }
export async function callGreeting(userId, { missed = false, workoutName = null, todayWorkoutLabel = null } = {}) {
  const brief  = await buildContextBrief(userId)
  const model  = routeModel('chat')

  const greetingContext = [
    'GREETING CONTEXT:',
    `missed_yesterday: ${missed}`,
    missed && workoutName ? `missed_workout: ${workoutName}` : null,
    `today_workout: ${todayWorkoutLabel ?? 'today\'s scheduled workout'}`,
  ].filter(Boolean).join('\n')

  const system = buildSystemPrompt(brief, GREETING_PROMPT + '\n\n' + greetingContext)

  await checkUsageLimit(userId, model)
  const { content, tokens } = await callApi({
    messages: [{ role: 'user', content: 'Generate my greeting.' }],
    system,
    model,
  })

  logInteraction(userId, model, tokens)

  return content
}

// callWelcome(userId)
// Generates a personal first-open welcome message for new users (after onboarding).
export async function callWelcome(userId) {
  const brief  = await buildContextBrief(userId)
  const system = buildSystemPrompt(brief, NEW_USER_WELCOME_PROMPT)
  const model  = routeModel('chat')

  await checkUsageLimit(userId, model)
  const { content, tokens } = await callApi({
    messages: [{ role: 'user', content: 'Generate my welcome message.' }],
    system,
    model,
  })

  logInteraction(userId, model, tokens)
  return content
}

// callInsight(userId)
// Generates a single sharp observation for the returning-user dashboard.
export async function callInsight(userId) {
  const brief  = await buildContextBrief(userId)
  const system = buildSystemPrompt(brief, INSIGHT_PROMPT)
  const model  = routeModel('insight')

  await checkUsageLimit(userId, model)
  const { content, tokens } = await callApi({
    messages: [{ role: 'user', content: 'Generate my training insight.' }],
    system,
    model,
  })

  logInteraction(userId, model, tokens)
  return content
}

// callTrainingBalance(userId, categories)
// Generates training balance assessment for the dashboard.
// categories: string[] of fixed labels derived from the user's program (e.g. ['Push', 'Pull', 'Legs']).
// Returns parsed categories array or null on failure.
export async function callTrainingBalance(userId, categories) {
  const brief  = await buildContextBrief(userId)
  const system = buildSystemPrompt(brief, buildTrainingBalancePrompt(categories))
  const model  = routeModel('chat')

  await checkUsageLimit(userId, model)
  const { content, tokens } = await callApi({
    messages: [{ role: 'user', content: 'Generate my training balance assessment.' }],
    system,
    model,
  })

  logInteraction(userId, model, tokens)

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
  const system = buildSystemPrompt(brief, SESSION_FEEDBACK_PROMPT)
  const model  = routeModel('feedback')

  await checkUsageLimit(userId, model)
  const { content, tokens } = await callApi({
    messages: [{ role: 'user', content: summary }],
    system,
    model,
  })

  logInteraction(userId, model, tokens)

  return content
}

// callRestDaySuggestion(userId)
// Generates a one-sentence rest day suggestion for the Today card.
export async function callRestDaySuggestion(userId) {
  const brief  = await buildContextBrief(userId)
  const system = buildSystemPrompt(brief, REST_DAY_PROMPT)
  const model  = routeModel('chat')

  await checkUsageLimit(userId, model)
  const { content, tokens } = await callApi({
    messages: [{ role: 'user', content: 'Generate my rest day suggestion.' }],
    system,
    model,
  })

  logInteraction(userId, model, tokens)
  return content
}

// callCompletedFeedback(userId, exercises)
// Generates a one-sentence feedback line for the completed Today card.
// exercises: ExerciseLog[] from the completed session
export async function callCompletedFeedback(userId, exercises = []) {
  const brief  = await buildContextBrief(userId)
  const system = buildSystemPrompt(brief, COMPLETED_FEEDBACK_PROMPT)
  const model  = routeModel('chat')

  const sessionSummary = exercises.length > 0
    ? exercises.map(ex => {
        const sets = (ex.sets ?? []).map(s => `${s.reps}×${s.weight_lbs}lbs`).join(', ')
        return `${ex.name}: ${sets}`
      }).join('; ')
    : 'Session completed (no exercise details available)'

  await checkUsageLimit(userId, model)
  const { content, tokens } = await callApi({
    messages: [{ role: 'user', content: `Today's session: ${sessionSummary}` }],
    system,
    model,
  })

  logInteraction(userId, model, tokens)
  return content
}

// callActivityAck(userId, activityType, durationMinutes, notes)
// Generates a one-sentence acknowledgment after logging an additional activity.
export async function callActivityAck(userId, activityType, durationMinutes = null, notes = '') {
  const brief  = await buildContextBrief(userId)
  const system = buildSystemPrompt(brief, ACTIVITY_ACK_PROMPT)
  const model  = routeModel('chat')

  const parts = [`Activity logged: type=${activityType}`]
  if (durationMinutes) parts.push(`duration=${durationMinutes}min`)
  if (notes) parts.push(`notes="${notes}"`)

  await checkUsageLimit(userId, model)
  const { content, tokens } = await callApi({
    messages: [{ role: 'user', content: parts.join(', ') }],
    system,
    model,
  })

  logInteraction(userId, model, tokens)
  return content
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

  await checkUsageLimit(userId, model)
  const { content, tokens } = await callApi({
    messages: [{ role: 'user', content: 'Generate my complete training program based on my profile. Output the full program in <program_json> tags.' }],
    system,
    model,
  })

  logInteraction(userId, model, tokens)

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
    model: 'claude-sonnet-4-6',
    onChunk,
  })
  return content
}

// routeModel — Haiku for quick chat, Sonnet for reasoning-heavy tasks
export function routeModel(type) {
  const sonnetTypes = ['program', 'checkin', 'analysis', 'onboarding', 'insight', 'feedback']
  return sonnetTypes.includes(type) ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001'
}

// callApi({ messages, system, model, onChunk })
// Reads SSE stream from /api/chat. Calls onChunk with each text delta.
// Returns { content, tokens } when the stream ends.
async function callApi({ messages, system, model, onChunk }) {
  const payload = messages.length === 0
    ? [{ role: 'user', content: 'Begin.' }]
    : messages

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: payload, system, model }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
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

// logInteraction — writes token usage to the interactions table (fire-and-forget)
function logInteraction(userId, model, tokens) {
  if (!userId) return
  supabase.from('interactions').insert({
    user_id: userId,
    model_used: model,
    tokens_used: tokens ?? 0,
  }).then(() => {})
}
