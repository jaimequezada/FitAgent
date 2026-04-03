// GymMode.jsx — Workout Screen
// States mirror useSession: IDLE | PRE_SESSION | CONFIRM_WEIGHT | SET_ACTIVE | REST | SESSION_COMPLETE

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from '../../hooks/useSession'
import PulsingOrb from '../ui/PulsingOrb'
import NavSidebar from '../ui/NavSidebar'

function getWorkoutDisplayName(label = '') {
  const dashMatch = label.match(/—\s*(.+)$/)
  if (dashMatch) {
    const name = dashMatch[1].trim()
    return name.toLowerCase().includes('day') ? name : `${name} Day`
  }
  return label
}

function getDayString() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
}

export default function GymMode({ userId }) {
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [reps, setReps] = useState(8)

  const {
    state,
    exercises,
    exerciseIndex,
    setIndex,
    dayLabel,
    feedback,
    feedbackLoading,
    isLoading,
    alreadyDoneToday,
    isRestDay,
    start,
    beginSession,
    updateWeight,
    confirmWeights,
    logSet,
    advanceAfterRest,
    endEarly,
  } = useSession(userId)

  // Load session data on mount
  useEffect(() => { start() }, [start])

  // Auto-advance after set logged (REST state = brief delay then next set)
  useEffect(() => {
    if (state !== 'REST') return
    const t = setTimeout(() => advanceAfterRest(), 600)
    return () => clearTimeout(t)
  }, [state, advanceAfterRest])

  // Sync rep counter when exercise changes
  useEffect(() => {
    if (exercises[exerciseIndex]) {
      setReps(exercises[exerciseIndex].reps ?? 8)
    }
  }, [exerciseIndex, exercises])

  const currentExercise = exercises[exerciseIndex]
  const progressPct = exercises.length > 0 ? (exerciseIndex / exercises.length * 100) : 0
  const completedSets = setIndex

  const goHome = () => navigate('/home')

  // End workout during active session: save partial data then show completion screen
  const handleEndEarly = () => {
    endEarly()
  }

  // ── LOADING ──
  if (isLoading || state === 'IDLE') {
    return (
      <WorkoutShell dayLabel="" mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} onEnd={goHome}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 1.2s ease-in-out infinite' }} />
        </div>
      </WorkoutShell>
    )
  }

  // ── REST DAY ──
  if (isRestDay) {
    return (
      <WorkoutShell dayLabel="Rest Day" mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} onEnd={goHome}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, textAlign: 'center', padding: '0 32px' }}>
          <p style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>No workout today</p>
          <p style={{ fontSize: 14, fontWeight: 300, color: 'var(--text-muted)', lineHeight: 1.6 }}>Today is a scheduled rest day. Recovery is part of the program.</p>
          <button
            onClick={goHome}
            style={{ marginTop: 16, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 400, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border2)', borderRadius: 100, padding: '10px 24px', cursor: 'pointer' }}
          >
            Back to Home
          </button>
        </div>
      </WorkoutShell>
    )
  }

  // ── PRE_SESSION — workout preview + start button ──
  if (state === 'PRE_SESSION') {
    const displayName = getWorkoutDisplayName(dayLabel)
    const hasProgram  = exercises.length > 0

    return (
      <WorkoutShell dayLabel={dayLabel} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} onEnd={goHome}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', padding: '32px 0' }}>
          <div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>
                {getDayString()} · TODAY'S WORKOUT
              </p>
              <p style={{ fontSize: 26, fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                {hasProgram ? displayName : 'No program yet'}
              </p>
            </motion.div>

            {hasProgram ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {exercises.map((ex, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', borderRadius: 12,
                    border: '1px solid var(--border)', background: 'var(--surface2)',
                  }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{ex.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 300, marginTop: 2 }}>
                        {ex.sets} sets × {ex.reps} reps
                      </p>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--green)' }}>
                      {ex.weight_lbs} <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 300 }}>lbs</span>
                    </span>
                  </div>
                ))}
              </motion.div>
            ) : (
              <p style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 300 }}>
                Ask your coach to build a program first.
              </p>
            )}
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <button
              onClick={beginSession}
              disabled={!hasProgram}
              style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500,
                background: 'var(--green)', color: '#000', border: 'none',
                borderRadius: 100, padding: 14, cursor: hasProgram ? 'pointer' : 'default',
                width: '100%', transition: 'opacity 0.2s',
                opacity: hasProgram ? 1 : 0.3,
              }}
              onMouseEnter={e => { if (hasProgram) e.currentTarget.style.opacity = '0.88' }}
              onMouseLeave={e => { if (hasProgram) e.currentTarget.style.opacity = '1' }}
            >
              Start workout
            </button>
          </motion.div>
        </div>
      </WorkoutShell>
    )
  }

  // ── CONFIRM_WEIGHT ──
  if (state === 'CONFIRM_WEIGHT') {
    return (
      <WorkoutShell dayLabel={dayLabel} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} onEnd={goHome}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 0 16px', scrollbarWidth: 'none' }} className="scrollbar-none">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>
              {getDayString()} · {getWorkoutDisplayName(dayLabel)}
            </p>
            <p style={{ fontSize: 24, fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              Confirm weights
            </p>
          </motion.div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {exercises.map((ex, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface2)' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{ex.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 300, marginTop: 2 }}>{ex.sets} sets × {ex.reps} reps</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number"
                    value={ex.weight_lbs ?? ''}
                    onChange={e => updateWeight(i, parseFloat(e.target.value) || 0)}
                    style={{ width: 56, background: 'transparent', border: 'none', outline: 'none', textAlign: 'right', fontSize: 18, fontWeight: 500, color: 'var(--green)', fontFamily: "'DM Sans', sans-serif" }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>lbs</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={confirmWeights}
          style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, background: 'var(--green)', color: '#000', border: 'none', borderRadius: 100, padding: 14, cursor: 'pointer', width: '100%', transition: 'opacity 0.2s' }}
        >
          Start session
        </button>
      </WorkoutShell>
    )
  }

  // ── SESSION_COMPLETE ──
  if (state === 'SESSION_COMPLETE') {
    const message = alreadyDoneToday
      ? `You've already completed today's ${getWorkoutDisplayName(dayLabel)} session. Rest up — your next workout is tomorrow.`
      : (feedbackLoading ? null : (feedback ?? 'Good session. Come back next time.'))

    return (
      <WorkoutShell dayLabel={dayLabel} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} onEnd={goHome}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', padding: '32px 0' }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 24 }}>
              {alreadyDoneToday ? 'ALREADY COMPLETE' : 'SESSION COMPLETE'}
            </p>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: '#0c1a08', border: '1px solid #1e3015', borderRadius: 16, padding: 18 }}>
              <PulsingOrb size={24} />
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 300, lineHeight: 1.65 }}>
                {feedbackLoading ? (
                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Thinking...</span>
                ) : (
                  message
                )}
              </p>
            </div>
          </div>
          <button
            onClick={goHome}
            disabled={feedbackLoading && !alreadyDoneToday}
            style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500,
              background: 'var(--green)', color: '#000', border: 'none',
              borderRadius: 100, padding: 14, cursor: 'pointer', width: '100%',
              opacity: (feedbackLoading && !alreadyDoneToday) ? 0.4 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            Done →
          </button>
        </div>
      </WorkoutShell>
    )
  }

  // ── SET_ACTIVE (and REST which auto-advances) ──
  if ((state === 'SET_ACTIVE' || state === 'REST') && currentExercise) {
    return (
      <WorkoutShell dayLabel={dayLabel} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} onEnd={handleEndEarly}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '32px 0 0' }}>

          {/* Workout header */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>
              {getDayString()} · {getWorkoutDisplayName(dayLabel)}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 24, fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                {currentExercise.name}
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 300 }}>
                <strong style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{exerciseIndex + 1}</strong> of {exercises.length}
              </p>
            </div>
          </motion.div>

          {/* Progress bar */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
            style={{ background: 'var(--surface2)', borderRadius: 100, height: 3, overflow: 'hidden' }}>
            <motion.div
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{ height: '100%', borderRadius: 100, background: 'var(--green)' }}
            />
          </motion.div>

          {/* Exercise card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={exerciseIndex}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 24 }}
            >
              <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>CURRENT EXERCISE</p>
              <p style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: 4 }}>{currentExercise.name}</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 300, marginBottom: 24 }}>
                Target: <span style={{ color: 'var(--text-secondary)' }}>{currentExercise.sets} sets × {currentExercise.reps} reps</span> · <span style={{ color: 'var(--text-secondary)' }}>{currentExercise.weight_lbs} lb</span>
              </p>

              {/* Set rows */}
              <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>SETS</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {Array.from({ length: currentExercise.sets }).map((_, si) => {
                  const isDone   = si < completedSets
                  const isActive = si === completedSets && state === 'SET_ACTIVE'
                  return (
                    <div key={si} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                      borderRadius: 12, transition: 'all 0.25s',
                      border: isActive ? '1px solid rgba(57,255,20,0.4)' : '1px solid var(--border)',
                      background: isActive ? '#0c1a08' : 'var(--surface2)',
                      opacity: isDone ? 0.5 : 1,
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: isActive ? 'var(--green)' : 'var(--text-muted)', width: 18, flexShrink: 0 }}>{si + 1}</span>
                      <span style={{ flex: 1, fontSize: 13, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 300 }}>
                        {currentExercise.reps} reps · {currentExercise.weight_lbs} lb
                      </span>
                      {isDone && (
                        <>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 300 }}>— reps</span>
                          <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#1a2e14', border: '1px solid #2a4020', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#39FF14" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                        </>
                      )}
                      {isActive && <span style={{ fontSize: 11, color: '#3a5c30', fontWeight: 500 }}>Now</span>}
                    </div>
                  )
                })}
              </div>

              {/* Rep counter + Log set */}
              {state === 'SET_ACTIVE' && (
                <div style={{ background: '#0c1a08', border: '1px solid #1e3015', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', color: '#3a5c30' }}>REPS COMPLETED</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button
                        onClick={() => setReps(r => Math.max(0, r - 1))}
                        style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 20, color: 'var(--text-secondary)', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s', flexShrink: 0 }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--border2)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                      >−</button>
                      <span style={{ fontSize: 32, fontWeight: 300, color: 'var(--text-primary)', minWidth: 44, textAlign: 'center', letterSpacing: '-0.02em' }}>{reps}</span>
                      <button
                        onClick={() => setReps(r => r + 1)}
                        style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 20, color: 'var(--text-secondary)', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s', flexShrink: 0 }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--border2)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                      >+</button>
                    </div>
                  </div>
                  <button
                    onClick={() => logSet(reps)}
                    style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, background: 'var(--green)', color: '#000', border: 'none', borderRadius: 100, padding: '12px 24px', cursor: 'pointer', transition: 'opacity 0.2s, transform 0.15s', whiteSpace: 'nowrap', flexShrink: 0 }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'none'}
                  >Log set →</button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Bottom actions */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => logSet(0)}
              style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 400, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border2)', borderRadius: 100, padding: 12, cursor: 'pointer', transition: 'all 0.2s', width: '100%', textAlign: 'center' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = '#333' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border2)' }}
            >Skip set</button>
            <button
              onClick={handleEndEarly}
              style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, background: 'transparent', color: '#cc4444', border: '1px solid #3a1515', borderRadius: 100, padding: 12, cursor: 'pointer', transition: 'all 0.2s', width: '100%', textAlign: 'center' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#1a0a0a'; e.currentTarget.style.borderColor = '#663333' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#3a1515' }}
            >End workout</button>
          </motion.div>

        </div>
      </WorkoutShell>
    )
  }

  return null
}

// ─── Layout shell ─────────────────────────────────────────────────────────────
function WorkoutShell({ children, dayLabel, mobileMenuOpen, setMobileMenuOpen, onEnd }) {
  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 60, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 500, letterSpacing: '0.1em', color: 'var(--text-primary)', textDecoration: 'none' }}>
          <PulsingOrb size={24} />
          FITAGENT
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={onEnd}
            style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, background: 'transparent', color: '#cc4444', border: '1px solid #3a1515', borderRadius: 100, padding: '6px 14px', cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1a0a0a'; e.currentTarget.style.borderColor = '#663333' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#3a1515' }}
          >End</button>
          <button className="workout-hamburger" onClick={() => setMobileMenuOpen(v => !v)}
            style={{ display: 'none', flexDirection: 'column', gap: 5, cursor: 'pointer', padding: 4, background: 'none', border: 'none' }}>
            <span style={{ display: 'block', width: 20, height: 1.5, background: 'var(--text-secondary)', borderRadius: 2 }} />
            <span style={{ display: 'block', width: 20, height: 1.5, background: 'var(--text-secondary)', borderRadius: 2 }} />
            <span style={{ display: 'block', width: 20, height: 1.5, background: 'var(--text-secondary)', borderRadius: 2 }} />
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', top: 60, left: 0, right: 0, zIndex: 99, background: 'rgba(12,12,12,0.97)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)', padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}
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
        <div className="workout-sidebar">
          <NavSidebar />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 32px 48px', maxWidth: 720, scrollbarWidth: 'none', display: 'flex', flexDirection: 'column' }} className="scrollbar-none">
          {children}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .workout-sidebar { display: none !important; }
          .workout-hamburger { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
