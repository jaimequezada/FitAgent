// api/chat.js
// Vercel serverless function. Handles all Claude API calls server-side
// so ANTHROPIC_API_KEY is never exposed to the browser.
// POST /api/chat — { messages, system, model, maxTokens } → SSE stream of deltas
//
// Security + cost control (all enforced HERE, not in the browser):
//   1. Requires a valid Supabase access token (Authorization: Bearer <jwt>).
//      Without it the endpoint is an open relay to our Anthropic key.
//   2. Enforces per-user daily caps server-side, scoped to the authenticated
//      user via RLS. Fails CLOSED on infra errors (never silently unlimited).
//   3. Logs the interaction server-side after the stream completes, so the
//      count the next request reads is authoritative (client can't skip it).

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

// ─── Daily usage limits (per user, per model family) ─────────────────────────
const DAILY_LIMIT_HAIKU  = 20
const DAILY_LIMIT_SONNET = 5

// Hard ceiling on output tokens we'll ever allow a caller to request.
const MAX_OUTPUT_TOKENS = 8192

function jsonError(res, status, message) {
  res.status(status).json({ error: message })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return jsonError(res, 405, 'Method not allowed')
  }

  const { messages, system, model = 'claude-sonnet-4-6', maxTokens, tzOffsetMinutes } = req.body || {}

  if (!messages || !Array.isArray(messages)) {
    return jsonError(res, 400, 'messages array required')
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[api/chat] Supabase env vars missing on the server')
    return jsonError(res, 500, 'Server misconfiguration')
  }

  // ── 1. Authenticate the caller ─────────────────────────────────────────────
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return jsonError(res, 401, 'Authentication required')
  }

  // Per-request client carrying the user's token, so every query runs under
  // that user's RLS context (auth.uid() = user_id).
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  const user = userData?.user
  if (userErr || !user) {
    return jsonError(res, 401, 'Invalid or expired session')
  }

  // ── 2. Enforce the daily cap (fails closed) ────────────────────────────────
  const isHaiku = model.includes('haiku')
  const limit   = isHaiku ? DAILY_LIMIT_HAIKU : DAILY_LIMIT_SONNET
  const family  = isHaiku ? 'haiku' : 'sonnet'

  // Window resets at the user's LOCAL midnight (the rest of the app keys dates to
  // local time — see src/lib/dates.js). The browser sends its UTC offset in
  // minutes (Date.getTimezoneOffset(): UTC = local + offset). We clamp it to the
  // real-world range [-840, 840] so a crafted offset can't widen the window far
  // beyond a day. Missing/invalid offset falls back to UTC midnight.
  const rawOffset = Number(tzOffsetMinutes)
  const offsetMin = Number.isFinite(rawOffset) ? Math.max(-840, Math.min(840, rawOffset)) : 0
  const windowStart = new Date()
  windowStart.setTime(windowStart.getTime() - offsetMin * 60000) // shift into the user's local frame
  windowStart.setUTCHours(0, 0, 0, 0)                            // zero to local midnight
  windowStart.setTime(windowStart.getTime() + offsetMin * 60000) // shift back to the real UTC instant

  const { count, error: countErr } = await supabase
    .from('interactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .ilike('model_used', `%${family}%`)
    .gte('created_at', windowStart.toISOString())

  if (countErr) {
    // Fail closed — we'd rather reject than become an unmetered relay.
    console.error('[api/chat] usage count failed:', countErr.message)
    return jsonError(res, 503, 'Usage check unavailable, try again shortly')
  }

  if ((count ?? 0) >= limit) {
    return jsonError(
      res,
      429,
      isHaiku
        ? `You've reached your daily limit of ${DAILY_LIMIT_HAIKU} requests. Resets at midnight.`
        : `You've reached your daily limit of ${DAILY_LIMIT_SONNET} complex requests (program updates, analysis). Resets at midnight.`
    )
  }

  // ── 3. Stream the completion ───────────────────────────────────────────────
  const max_tokens = Math.min(
    Math.max(Number(maxTokens) || 4096, 1),
    MAX_OUTPUT_TOKENS
  )

  // Cache the system prompt prefix. The persona + context brief is the large,
  // stable portion of every request; caching it bills it at ~0.1x on repeat
  // calls within the 5-minute TTL instead of full input price every time.
  const systemBlocks = system
    ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
    : undefined

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    const stream = client.messages.stream({
      model,
      max_tokens,
      system: systemBlocks,
      messages,
    })

    stream.on('text', (text) => {
      res.write(`data: ${JSON.stringify({ delta: text })}\n\n`)
    })

    stream.on('finalMessage', async (msg) => {
      const tokens = (msg.usage?.input_tokens ?? 0) + (msg.usage?.output_tokens ?? 0)
      res.write(`data: ${JSON.stringify({ done: true, tokens, model })}\n\n`)

      // Log server-side so the next request's cap check sees an authoritative
      // count (the client can no longer skip this).
      try {
        await supabase.from('interactions').insert({
          user_id:     user.id,
          model_used:  model,
          tokens_used: tokens,
        })
      } catch (e) {
        console.error('[api/chat] interaction log failed:', e?.message)
      }

      res.end()
    })

    stream.on('error', (err) => {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
      res.end()
    })
  } catch (err) {
    console.error('[api/chat]', err.message)
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
    res.end()
  }
}
