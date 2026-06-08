import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { callOnboarding, callGenerateProgram, isRateLimitError } from '../../lib/claude'
import { useAuth } from '../../hooks/useAuth'
import PulsingOrb from '../ui/PulsingOrb'
import TypingIndicator from '../ui/TypingIndicator'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function stripFields(text) {
  return text.replace(/<fields>.*?<\/fields>/g, '').trim()
}

function extractFields(text) {
  const match = text.match(/<fields>(.*?)<\/fields>/)
  if (!match) return null
  const raw = match[1].trim()
  return raw ? raw.split(',').map(f => f.trim()) : []
}

function stripProfileJson(text) {
  // Remove complete blocks first
  let result = text.replace(/<profile_json>[\s\S]*?<\/profile_json>/g, '')
  // Remove any partial block still streaming (opening tag present but no closing tag yet)
  result = result.replace(/<profile_json>[\s\S]*$/, '')
  return result.trim()
}

function extractProfile(text) {
  const match = text.match(/<profile_json>([\s\S]*?)<\/profile_json>/)
  if (!match) return null
  try { return JSON.parse(match[1].trim()) } catch { return null }
}

async function saveProfile(userId, data) {
  const { error } = await supabase
    .from('profiles')
    .update({
      name: data.name,
      experience_months: data.experience_months,
      goal: data.goal,
      days_per_week: data.days_per_week,
      equipment: data.equipment,
      injuries: data.injuries,
      onboarding_complete: true,
      trial_started_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
  if (error) throw error
}

// Sidebar steps — one per data topic the agent needs to collect
const SIDEBAR_STEPS = [
  'About you',
  'Your goal',
  'Schedule',
  'Equipment',
  'Injuries & limits',
]

// Processing steps shown in overlay
const PROCESSING_STEPS = [
  'Analyzing your training history',
  'Mapping your goals and schedule',
  'Structuring your weekly split',
  'Setting progressive overload targets',
  'Your dashboard is ready',
]

export default function OnboardingChat({ onComplete }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])       // { role, content }[]
  const [streamingText, setStreamingText] = useState('') // current agent reply being streamed
  const [isStreaming, setIsStreaming] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [showProcessing, setShowProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState(-1)
  const [animationDone, setAnimationDone] = useState(false)
  const [programReady, setProgramReady] = useState(false)
  const [genFailed, setGenFailed] = useState(false)
  const [genErrorMsg, setGenErrorMsg] = useState('')
  const [retryToken, setRetryToken] = useState(0)
  const [collectedFields, setCollectedFields] = useState([])
  const [input, setInput] = useState('')
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const textareaRef = useRef(null)

  // Sidebar step driven by which fields Claude has confirmed, not message count
  const STEP_FIELDS = ['name', 'goal', 'schedule', 'equipment', 'injuries']
  const activeSideStep = (() => {
    const first = STEP_FIELDS.findIndex(f => !collectedFields.includes(f))
    return first === -1 ? SIDEBAR_STEPS.length - 1 : first
  })()

  // Scroll to bottom when messages change
  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [messages, streamingText, isStreaming])

  // Focus input when streaming ends
  useEffect(() => {
    if (!isStreaming && !isDone) inputRef.current?.focus()
  }, [isStreaming, isDone])

  // Open with agent's first message
  useEffect(() => {
    sendAgentTurn([])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Run processing animation + program generation in parallel after isDone.
  // Re-runs on retry (retryToken bump).
  useEffect(() => {
    if (!showProcessing) return

    setGenFailed(false)
    setGenErrorMsg('')
    setProgramReady(false)
    setAnimationDone(false)
    setProcessingStep(-1)

    // Animation: step through processing steps
    let i = 0
    const run = () => {
      if (i >= PROCESSING_STEPS.length) {
        setAnimationDone(true)
        return
      }
      setProcessingStep(i)
      i++
      setTimeout(run, 900)
    }
    setTimeout(run, 400)

    // Program generation: Sonnet builds the program from the saved profile.
    // Hard timeout so a hanging request never blocks navigation.
    const fallback = setTimeout(() => setProgramReady(true), 25000)
    callGenerateProgram(user.id)
      .then(program => {
        // callGenerateProgram returns null on parse/extract/save failure.
        if (!program) {
          setGenFailed(true)
          setGenErrorMsg("We couldn't build your program. Let's try that again.")
        }
      })
      .catch(err => {
        console.error('[OnboardingChat] program generation failed:', err)
        setGenFailed(true)
        setGenErrorMsg(isRateLimitError(err)
          ? "You've hit today's request limit before your program finished. Try again in a bit."
          : "We couldn't build your program. Let's try that again.")
      })
      .finally(() => { clearTimeout(fallback); setProgramReady(true) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showProcessing, retryToken])

  // Transition to dashboard once both animation and program generation are done —
  // but NOT if generation failed. A failed program would land the user on an empty
  // dashboard (no workout, no plan); show a retry instead.
  useEffect(() => {
    if (animationDone && programReady && !genFailed) {
      setTimeout(onComplete, 300)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationDone, programReady, genFailed])

  function retryGeneration() {
    setRetryToken(t => t + 1)
  }

  async function sendAgentTurn(currentMessages) {
    setIsStreaming(true)
    setStreamingText('')
    setError(null)

    try {
      let accumulated = ''

      const fullText = await callOnboarding(currentMessages, (chunk) => {
        accumulated += chunk
        const display = stripFields(stripProfileJson(accumulated))
        setStreamingText(display)
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      })

      const fields = extractFields(fullText)
      if (fields) setCollectedFields(fields)

      const displayText = stripFields(stripProfileJson(fullText))
      const updated = [...currentMessages, { role: 'assistant', content: displayText }]
      setMessages(updated)
      setStreamingText('')

      const profile = extractProfile(fullText)
      if (profile) {
        await saveProfile(user.id, profile)
        setIsDone(true)
        setTimeout(() => setShowProcessing(true), 800)
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
      console.error('[OnboardingChat]', err)
    } finally {
      setIsStreaming(false)
    }
  }

  async function handleSubmit() {
    const text = input.trim()
    if (!text || isStreaming || isDone) return

    const userMsg = { role: 'user', content: text }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    await sendAgentTurn(updated)
  }

  const canType = !isStreaming && !isDone

  return (
    <>
      {/* ── PROCESSING OVERLAY ── */}
      <AnimatePresence>
        {showProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{
              position: 'fixed', inset: 0, background: 'var(--bg)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 28, zIndex: 200,
            }}
          >
            <PulsingOrb size={72} borderRadius={22} />
            {genFailed ? (
              <>
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320 }}>
                  <p style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Something went wrong</p>
                  <p style={{ fontSize: 14, fontWeight: 300, color: 'var(--text-muted)', lineHeight: 1.6 }}>{genErrorMsg}</p>
                </div>
                <button
                  onClick={retryGeneration}
                  style={{
                    fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500,
                    background: 'var(--green)', color: '#000', border: 'none', borderRadius: 100,
                    padding: '12px 32px', cursor: 'pointer', transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >Try again</button>
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Building your program</p>
                  <p style={{ fontSize: 14, fontWeight: 300, color: 'var(--text-muted)' }}>This will just take a moment</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
                  {PROCESSING_STEPS.map((step, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={processingStep >= i ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                      style={{
                        fontSize: 13, fontWeight: 300,
                        color: processingStep > i ? 'var(--text-secondary)' : 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}
                    >
                      <div style={{
                        width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                        background: processingStep > i ? 'var(--green)' : 'var(--text-muted)',
                        transition: 'background 0.4s ease',
                      }} />
                      {step}
                    </motion.div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAIN LAYOUT ── */}
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif" }}>

        {/* NAV */}
        <nav style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: 60,
          display: 'flex', alignItems: 'center', padding: '0 24px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg)', zIndex: 100,
        }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 500, letterSpacing: '0.1em', color: 'var(--text-primary)', textDecoration: 'none' }}>
            <PulsingOrb size={24} />
            FITAGENT
          </a>
        </nav>

        {/* BODY: sidebar + chat */}
        <div style={{ display: 'flex', height: '100vh', paddingTop: 60 }}>

          {/* SIDEBAR */}
          <div style={{
            width: 280, flexShrink: 0,
            borderRight: '1px solid var(--border)',
            padding: '32px 24px',
            display: 'flex', flexDirection: 'column', gap: 32,
          }} className="onboarding-sidebar">
            <div>
              <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 16 }}>GETTING STARTED</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {SIDEBAR_STEPS.map((label, i) => {
                  const isActive = i === activeSideStep
                  const isDoneStep = i < activeSideStep
                  return (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, fontWeight: 300, color: isActive ? 'var(--text-secondary)' : 'var(--text-muted)', transition: 'color 0.3s' }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                        background: isActive ? 'var(--green)' : isDoneStep ? '#2a4020' : 'var(--border2)',
                        transition: 'background 0.3s',
                      }} />
                      {label}
                    </div>
                  )
                })}
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 300, lineHeight: 1.65, padding: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
              Your answers are used only to build your program. FitAgent learns more every session.
            </div>
          </div>

          {/* CHAT COLUMN */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 720, margin: '0 auto', width: '100%' }}>

            {/* Chat area */}
            <div
              ref={inputRef}
              style={{ flex: 1, overflowY: 'auto', padding: '32px 24px 16px', display: 'flex', flexDirection: 'column', gap: 12, scrollbarWidth: 'none' }}
              className="scrollbar-none onboarding-chat-area"
            >
              <AnimatePresence>
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    style={{
                      maxWidth: '72%',
                      padding: '12px 16px',
                      borderRadius: 18,
                      borderBottomLeftRadius: msg.role === 'assistant' ? 4 : 18,
                      borderBottomRightRadius: msg.role === 'user' ? 4 : 18,
                      fontSize: 14,
                      lineHeight: 1.6,
                      fontWeight: 300,
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      background: msg.role === 'assistant' ? '#0c1a08' : 'var(--surface2)',
                      border: msg.role === 'assistant' ? '1px solid #1e3015' : '1px solid var(--border2)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {msg.content}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Streaming bubble */}
              {isStreaming && streamingText && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    maxWidth: '72%', padding: '12px 16px', borderRadius: 18, borderBottomLeftRadius: 4,
                    fontSize: 14, lineHeight: 1.6, fontWeight: 300, alignSelf: 'flex-start',
                    background: '#0c1a08', border: '1px solid #1e3015', color: 'var(--text-secondary)',
                  }}
                >
                  {streamingText}
                </motion.div>
              )}

              {/* Typing indicator (before first chunk arrives) */}
              {isStreaming && !streamingText && <TypingIndicator />}

              {error && (
                <p style={{ fontSize: 12, color: '#cc4444', textAlign: 'center', padding: '8px 0' }}>{error}</p>
              )}

              <div ref={bottomRef} />
            </div>

            {/* INPUT AREA */}
            <div className="onboarding-input-bar" style={{ padding: '16px 24px 24px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 24, padding: '12px 18px', display: 'flex', alignItems: 'center', transition: 'border-color 0.2s' }}
                onFocus={e => e.currentTarget.style.borderColor = '#333'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border2)'}
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => {
                    setInput(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = e.target.scrollHeight + 'px'
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
                  }}
                  placeholder="Message FitAgent..."
                  disabled={!canType}
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
                onClick={handleSubmit}
                disabled={!canType || !input.trim()}
                style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'var(--green)', border: 'none', cursor: input.trim() && canType ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  opacity: input.trim() && canType ? 1 : 0.3,
                  transition: 'opacity 0.2s, transform 0.15s',
                }}
                onMouseEnter={e => { if (input.trim() && canType) e.currentTarget.style.opacity = '0.85' }}
                onMouseLeave={e => { if (input.trim() && canType) e.currentTarget.style.opacity = '1' }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 12V2M2 7l5-5 5 5" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Responsive: hide sidebar on mobile */}
      <style>{`
        @media (max-width: 768px) {
          .onboarding-sidebar { display: none !important; }
          .onboarding-chat-area { padding: 20px 16px 16px !important; }
          .onboarding-input-bar { padding: 12px 16px 20px !important; }
        }
      `}</style>
    </>
  )
}
