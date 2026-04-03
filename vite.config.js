import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev-only middleware that handles /api/chat in the Vite dev server.
// In production, Vercel routes /api/chat to api/chat.js instead.
// Streams SSE deltas so the UI can render tokens as they arrive.
function chatApiPlugin(apiKey) {
  return {
    name: 'chat-api',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }

        let body = ''
        for await (const chunk of req) body += chunk

        try {
          const { messages, system, model } = JSON.parse(body)
          const { default: Anthropic } = await import('@anthropic-ai/sdk')
          const client = new Anthropic({ apiKey })

          res.setHeader('Content-Type', 'text/event-stream')
          res.setHeader('Cache-Control', 'no-cache')
          res.setHeader('Connection', 'keep-alive')

          const stream = client.messages.stream({
            model: model || 'claude-sonnet-4-6',
            max_tokens: 4096,
            system,
            messages,
          })

          stream.on('text', (text) => {
            res.write(`data: ${JSON.stringify({ delta: text })}\n\n`)
          })

          stream.on('finalMessage', (msg) => {
            const tokens = (msg.usage?.input_tokens ?? 0) + (msg.usage?.output_tokens ?? 0)
            res.write(`data: ${JSON.stringify({ done: true, tokens, model: model || 'claude-sonnet-4-6' })}\n\n`)
            res.end()
          })

          stream.on('error', (err) => {
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
            res.end()
          })
        } catch (err) {
          console.error('[chat-api]', err.message)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // loadEnv with '' prefix loads ALL vars from .env, including ANTHROPIC_API_KEY
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      chatApiPlugin(env.ANTHROPIC_API_KEY),
    ],
  }
})
