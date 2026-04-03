// AgentChat.jsx
// Chat thread + input for Home mode.
// Receives the initial thread from useDailyThread (via HomeScreen).
// Calls onThreadUpdate after every completed exchange so the thread
// is persisted to Supabase by the caller.

import { useEffect, useRef, useState } from 'react'
import { useAgent } from '../../hooks/useAgent'
import AgentMessage from './AgentMessage'

export default function AgentChat({ userId, initialThread = [], onThreadUpdate, onProgramSaved, suggestions = [] }) {
  const { messages, send, isLoading, error, reset } = useAgent(userId, 'chat', {
    initialMessages: initialThread,
    onExchangeComplete: onThreadUpdate,
    onProgramSaved,
  })
  const [input, setInput]     = useState('')
  const bottomRef             = useRef(null)
  const textareaRef           = useRef(null)

  const showSuggestions = suggestions.length > 0 && messages.length === initialThread.length

  // Auto-scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [input])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    const msg = input.trim()
    setInput('')
    if (msg === '/clear') {
      const cleared = [{ role: 'assistant', content: 'Chat cleared. Let me know if you want to discuss your workout plan, log something, or anything else.', streaming: false }]
      reset(cleared)
      onThreadUpdate?.(cleared)
      return
    }
    await send(msg)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
    <style>{`
      @media (max-width: 768px) {
        .agent-thread { padding: 20px 16px 16px !important; }
        .agent-input-bar { padding: 12px 16px 20px !important; }
      }
    `}</style>

      {/* Message thread */}
      <div className="agent-thread" style={{ flex: 1, overflowY: 'auto', padding: '32px 32px 16px', display: 'flex', flexDirection: 'column', gap: 20, scrollbarWidth: 'none' }}>
        {messages.map((msg, i) => (
          <AgentMessage
            key={i}
            role={msg.role}
            content={msg.content}
            streaming={msg.streaming}
          />
        ))}

        {error && (
          <p className="text-xs text-red-400 text-center">{error}</p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggestion chips */}
      {showSuggestions && (
        <div style={{ padding: '0 32px 16px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={isLoading}
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12, fontWeight: 400,
                background: 'var(--surface)',
                border: '1px solid var(--border2)',
                borderRadius: 100,
                padding: '8px 14px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'border-color 0.2s, color 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="agent-input-bar" style={{ padding: '16px 24px 24px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div
            style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 24, padding: '12px 18px', display: 'flex', alignItems: 'center', transition: 'border-color 0.2s' }}
            onFocus={e => e.currentTarget.style.borderColor = '#333'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--border2)'}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              placeholder="Ask your coach…"
              disabled={isLoading}
              rows={1}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 300,
                color: 'var(--text-primary)', resize: 'none', lineHeight: 1.5, maxHeight: 120,
                overflowY: 'auto',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'var(--green)', border: 'none', cursor: input.trim() && !isLoading ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              opacity: input.trim() && !isLoading ? 1 : 0.3,
              transition: 'opacity 0.2s, transform 0.15s',
            }}
            aria-label="Send"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 12V2M2 7l5-5 5 5" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}

