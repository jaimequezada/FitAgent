// useAgent.js
// React hook for all Home-mode agent interactions.
// Maintains the conversation thread and streams tokens into the last message.
//
// Thread persistence is handled externally by useDailyThread — this hook
// is stateless with respect to storage. It initialises from initialMessages
// and calls onExchangeComplete(messages) after each user+agent exchange.

import { useState, useCallback } from 'react'
import { callClaude } from '../lib/claude'

// Strip <program_json> blocks from displayed content.
// While streaming, hide everything from the opening tag onward (closing tag not yet arrived).
// Once complete, the full tag is already stripped by extractAndSaveProgram.
function stripProgramJson(content) {
  if (content.includes('<program_json>') && content.includes('</program_json>')) {
    return content.replace(/<program_json>[\s\S]*?<\/program_json>/, '').trim()
  }
  if (content.includes('<program_json>')) {
    return content.slice(0, content.indexOf('<program_json>')).trim()
  }
  return content
}

// useAgent(userId, type, options)
//   userId            — passed through to callClaude for context + logging
//   type              — 'chat' | 'program' | 'checkin' | 'analysis' | 'feedback'
//   initialMessages   — Message[] to seed the thread (from useDailyThread)
//   onExchangeComplete — (messages: Message[]) => void, called after each settled exchange
// Returns:
//   messages  — { role, content, streaming? }[]
//   send      — async (message: string) => void
//   isLoading — bool
//   error     — string | null
//   reset     — clears the conversation thread
export function useAgent(userId, type = 'chat', { initialMessages = [], onExchangeComplete, onProgramSaved } = {}) {
  const [messages,  setMessages]  = useState(initialMessages)
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState(null)

  const send = useCallback(async (message) => {
    if (!message.trim() || isLoading) return

    const history  = messages
    const withUser = [...messages, { role: 'user', content: message.trim() }]

    // Optimistically add user message + empty streaming assistant placeholder
    setMessages([...withUser, { role: 'assistant', content: '', streaming: true }])
    setIsLoading(true)
    setError(null)

    try {
      let accumulated = ''

      const finalContent = await callClaude(message.trim(), userId, type, history, (chunk) => {
        accumulated += chunk
        setMessages(prev => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: stripProgramJson(accumulated), streaming: true },
        ])
      }, onProgramSaved)

      const settled = [
        ...withUser,
        { role: 'assistant', content: finalContent, streaming: false },
      ]
      setMessages(settled)
      onExchangeComplete?.(settled)
    } catch (err) {
      console.error('[useAgent]', err)
      setError(err.message || 'Something went wrong.')
      setMessages(withUser) // drop the empty assistant placeholder on error
    } finally {
      setIsLoading(false)
    }
  }, [messages, isLoading, userId, type, onExchangeComplete])

  const reset = useCallback((initialMessages = []) => {
    setMessages(initialMessages)
    setError(null)
  }, [])

  return { messages, send, isLoading, error, reset }
}
