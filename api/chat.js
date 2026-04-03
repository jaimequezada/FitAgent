// api/chat.js
// Vercel serverless function. Handles all Claude API calls server-side
// so ANTHROPIC_API_KEY is never exposed to the browser.
// POST /api/chat — { messages, system, model } → SSE stream of deltas

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { messages, system, model = 'claude-sonnet-4-6' } = req.body

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' })
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    const stream = client.messages.stream({
      model,
      max_tokens: 4096,
      system,
      messages,
    })

    stream.on('text', (text) => {
      res.write(`data: ${JSON.stringify({ delta: text })}\n\n`)
    })

    stream.on('finalMessage', (msg) => {
      const tokens = (msg.usage?.input_tokens ?? 0) + (msg.usage?.output_tokens ?? 0)
      res.write(`data: ${JSON.stringify({ done: true, tokens, model })}\n\n`)
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
