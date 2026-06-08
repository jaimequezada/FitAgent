// AgentPage.jsx
// Dedicated /agent route — full-screen chat with FitAgent.
// Always starts fresh with a "How can I help?" greeting each visit.

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import { loadTodayThread, upsertThread } from '../../lib/dailyThread'
import NavSidebar from '../ui/NavSidebar'
import PulsingOrb from '../ui/PulsingOrb'
import AgentChat from './AgentChat'

const INITIAL_THREAD = [
  { role: 'assistant', content: "What's on your mind? I can help with your training plan, review your progress, analyze trends, or make program adjustments.", streaming: false },
]

const SUGGESTIONS = [
  'Walk me through my workout plan',
  'How is my training progressing?',
  'I want to change something in my program',
  'What trends do you see in my sessions?',
]

export default function AgentPage() {
  const { user } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  // null = loading; Message[] once resolved. Seeded from today's daily thread so a
  // weekly/end-of-trial check-in (written there by the daily rollover) shows up
  // here; falls back to the generic greeting when there's no thread.
  const [thread, setThread] = useState(null)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    loadTodayThread(user.id).then(saved => {
      if (cancelled) return
      if (saved && saved.length) {
        // Mark info-only check-ins as seen so the nav badge clears after viewing.
        // Pending program proposals stay 'pending' until the user acts on them.
        let changed = false
        const adjusted = saved.map(m => {
          if (m.checkin?.status === 'info') { changed = true; return { ...m, checkin: { ...m.checkin, status: 'seen' } } }
          return m
        })
        if (changed) upsertThread(user.id, adjusted)
        setThread(adjusted)
      } else {
        setThread(INITIAL_THREAD)
      }
    })
    return () => { cancelled = true }
  }, [user?.id])

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif" }}>

      {/* NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)', zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <PulsingOrb size={24} />
          <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.1em', color: 'var(--text-primary)' }}>
            FITAGENT
          </span>
        </div>
        <button className="agent-hamburger" onClick={() => setMobileMenuOpen(v => !v)}
          style={{ display: 'none', flexDirection: 'column', gap: 5, cursor: 'pointer', padding: 4, background: 'none', border: 'none' }}>
          <span style={{ display: 'block', width: 20, height: 1.5, background: 'var(--text-secondary)', borderRadius: 2 }} />
          <span style={{ display: 'block', width: 20, height: 1.5, background: 'var(--text-secondary)', borderRadius: 2 }} />
          <span style={{ display: 'block', width: 20, height: 1.5, background: 'var(--text-secondary)', borderRadius: 2 }} />
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 60, left: 0, right: 0, zIndex: 99,
              background: 'rgba(12,12,12,0.97)', backdropFilter: 'blur(16px)',
              borderBottom: '1px solid var(--border)', padding: 12,
              display: 'flex', flexDirection: 'column', gap: 4,
            }}
          >
            {[['/home', 'Home'], ['/workout', 'Workout'], ['/agent', 'Agent']].map(([path, label]) => (
              <a key={path} href={path} onClick={() => setMobileMenuOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, fontSize: 15, color: 'var(--text-secondary)', textDecoration: 'none' }}>
                {label}
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* BODY */}
      <div style={{ display: 'flex', height: '100vh', paddingTop: 60 }}>

        {/* SIDEBAR */}
        <div className="agent-sidebar">
          <NavSidebar />
        </div>

        {/* CHAT COLUMN */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {thread !== null && (
            <AgentChat
              userId={user?.id}
              initialThread={thread}
              suggestions={SUGGESTIONS}
              onThreadUpdate={msgs => upsertThread(user.id, msgs)}
            />
          )}
        </div>

      </div>

      <style>{`
        @media (max-width: 768px) {
          .agent-sidebar { display: none !important; }
          .agent-hamburger { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
