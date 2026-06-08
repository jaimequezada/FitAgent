// HomeScreen.jsx — Dashboard
// Layout: fixed nav (60px) + sidebar (200px) + scrollable main content
// Two data states: Day 1 (no completed sessions) vs Returning user

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { useAuth }            from '../../hooks/useAuth'
import { supabase }           from '../../lib/supabase'
import {
  callInsight,
  callRestDaySuggestion,
  callWelcome,
  isRateLimitError,
} from '../../lib/claude'
import { useDailyThread }     from '../../hooks/useDailyThread'
import { localDateStr }       from '../../lib/dates'
import PulsingOrb             from '../ui/PulsingOrb'
import NavSidebar             from '../ui/NavSidebar'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getFirstName(user, profile) {
  if (profile?.name) return profile.name.split(' ')[0]
  const full = user?.user_metadata?.full_name
  if (full) return full.split(' ')[0]
  const local = (user?.email ?? '').split('@')[0]
  return local.charAt(0).toUpperCase() + local.slice(1)
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function getTodayWorkout(program, completedCount) {
  const days = program?.days ?? []
  if (!days.length) return null
  if (program.schedule) {
    const dow   = new Date().getDay()
    const entry = program.schedule[dow]
    if (!entry) return null
    return days[entry.day_index] ?? null
  }
  return days[completedCount % days.length]
}

function getMuscleGroups(day) {
  if (!day) return null
  if (day.muscle_groups) return day.muscle_groups
  const l = (day.label ?? '').toLowerCase()
  if (l.includes('push'))                        return 'Chest · Shoulders · Triceps'
  if (l.includes('pull'))                        return 'Back · Biceps'
  if (l.includes('leg') || l.includes('lower'))  return 'Quads · Hamstrings · Glutes'
  if (l.includes('upper'))                       return 'Chest · Back · Shoulders'
  if (l.includes('full'))                        return 'Full Body'
  return null
}

function getWorkoutDisplayName(label = '') {
  const dashMatch = label.match(/—\s*(.+)$/)
  if (dashMatch) {
    const name = dashMatch[1].trim()
    return name.toLowerCase().includes('day') ? name : `${name} Day`
  }
  return label
}

// Build week dots array for Mon–Sun from sessions + program schedule
function buildWeekDots(sessions, program) {
  const today  = new Date()
  const todayStr = localDateStr(today)
  const dow    = today.getDay() // 0=Sun
  // Build Mon–Sun dates for current week
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + mondayOffset + i)
    return localDateStr(d)
  })
  // Map day-of-week labels: Mon=1,Tue=2,Wed=3,Thu=4,Fri=5,Sat=6,Sun=0
  const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  const sessionMap = {}
  for (const s of sessions ?? []) {
    sessionMap[s.date] = s
  }

  return days.map((dateStr, i) => {
    const s = sessionMap[dateStr]
    const isToday = dateStr === todayStr

    // Determine if this day is a training day.
    // Schedule-based programs: use the schedule. Schedule-less ("old rotation")
    // programs have no rest days — getTodayWorkout rotates through days by count,
    // so every day is a training day. Mirror that here or the dots disagree with
    // the Today card (which would show a workout while dots show none).
    const dow = new Date(dateStr + 'T12:00:00').getDay()
    const isTrainingDay = program?.schedule ? !!program.schedule[dow] : !!program?.days?.length

    let type
    if (s?.completed)        type = 'done'
    else if (s?.missed)      type = 'missed'
    else if (isToday)        type = isTrainingDay ? 'today' : 'empty'
    else if (dateStr > todayStr) type = isTrainingDay ? 'upcoming' : 'empty'
    else                     type = 'empty'

    return { date: dateStr, label: DOW_LABELS[i], type }
  })
}

const DOT_ICON = {
  done: (
    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
      <path d="M1 4l3 3 5-6" stroke="#39FF14" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  missed: (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
      <path d="M2 2l4 4M6 2L2 6" stroke="#aa3333" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  today: (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
      <circle cx="4" cy="4" r="2" fill="#000"/>
    </svg>
  ),
  empty: (
    <svg width="8" height="2" viewBox="0 0 8 2" fill="none">
      <path d="M1 1h6" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
}

const DOT_STYLES = {
  done:     { background: '#1a2e14', border: '1px solid #2a4020' },
  missed:   { background: '#2a0f0f', border: '1px solid #4a1515' },
  today:    { background: 'var(--green)', border: 'none' },
  rest:     { background: 'var(--surface2)', border: '1px solid var(--border)' },
  upcoming: { background: 'var(--surface)', border: '1px solid var(--border)' },
  empty:    { background: 'transparent', border: '1px dashed var(--border)', opacity: 0.5 },
}

// ─── Collapsible workout plan card ───────────────────────────────────────────
function WorkoutPlanCard({ program, todayDay }) {
  const [open, setOpen] = useState(false)
  if (!program?.days?.length) return null

  const pillName = todayDay ? getWorkoutDisplayName(todayDay.label ?? '') : 'Your Program'

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, overflow: 'hidden', transition: 'border-color 0.2s' }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', cursor: 'pointer', userSelect: 'none', transition: 'background 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#555" strokeWidth="1.4">
            <rect x="1" y="2" width="12" height="10" rx="2"/>
            <path d="M4 2V1m6 1V1M1 6h12"/>
          </svg>
          <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>WORKOUT PLAN</span>
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 100, padding: '2px 10px' }}>{pillName}</span>
        </div>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#555" strokeWidth="1.4" strokeLinecap="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }}>
          <path d="M3 5l4 4 4-4"/>
        </svg>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="dash-plan-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, padding: '0 20px 20px' }}>
              {program.days.map((day, i) => {
                // Find scheduled day label
                const schedEntry = Object.entries(program.schedule ?? {}).find(([, v]) => v?.day_index === i)
                const dayLabel = schedEntry
                  ? ['SUN','MON','TUE','WED','THU','FRI','SAT'][Number(schedEntry[0])]
                  : `DAY ${i + 1}`
                return (
                  <div key={i} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, padding: 14 }}>
                    <p style={{ fontSize: 10, color: 'var(--green)', fontWeight: 500, letterSpacing: '0.08em', marginBottom: 6 }}>{dayLabel}</p>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>{getWorkoutDisplayName(day.label ?? `Day ${i + 1}`)}</p>
                    {(day.exercises ?? []).slice(0, 5).map((ex, j) => (
                      <div key={j} style={{ marginBottom: 5 }}>
                        <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>{ex.name} · {ex.sets}×{ex.reps}</p>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 300 }}>{ex.weight_lbs} lb</p>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// extractCategory — parses category name from a day label (e.g. "Day 1 — Push" → "Push")
function extractCategory(label = '') {
  return label.split('—').pop().trim()
}

// getWeekStart — returns the local date string (YYYY-MM-DD) of the most recent Monday.
// Local, not UTC: session dates are stored in local time (see lib/dates.js), so the
// week boundary must use the same calendar or the Mon cutoff is off by a day in the evening.
function getWeekStart() {
  const now = new Date()
  const day = now.getDay() // 0=Sun, 1=Mon ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return localDateStr(monday)
}

// computeWeeklyBalance — calculates planned vs actual reps per category for the current calendar week.
// Planned reps: sum of (sets × reps) for all exercises on matching program days.
// Actual reps:  sum of logged reps from completed sessions this week matched by workout_name category.
// Returns ordered array of { label, plannedReps, actualReps, pct, color, status }
function computeWeeklyBalance(program, sessions) {
  if (!program?.days?.length) return null

  const weekStart = getWeekStart()

  // Weekly training frequency per day index, from the schedule. Actual reps below
  // are summed across EVERY session in the week, so planned must also be the WEEKLY
  // total — a day trained twice a week needs 2× its per-session volume, or the bar
  // tops out at ~50% even when the user is perfectly on track.
  // Schedule-less ("old rotation") programs: assume each day type once per week.
  const weeklyFreq = idx => program.schedule
    ? Object.values(program.schedule).filter(v => v?.day_index === idx).length
    : 1

  // Build category map preserving first-appearance order, summing planned weekly reps across all matching days
  const order = []
  const map = {}
  program.days.forEach((day, idx) => {
    const category = extractCategory(day.label)
    if (!category) return
    const perSession = (day.exercises ?? []).reduce((sum, ex) => sum + (ex.sets ?? 0) * (ex.reps ?? 0), 0)
    const plannedReps = perSession * weeklyFreq(idx)
    if (!map[category]) {
      order.push(category)
      map[category] = { label: category, plannedReps: 0, actualReps: 0 }
    }
    map[category].plannedReps += plannedReps
  })

  // Sum actual reps from completed sessions in the current calendar week
  const weekSessions = (sessions ?? []).filter(s => s.completed && s.date >= weekStart)
  weekSessions.forEach(session => {
    const category = extractCategory(session.workout_name ?? '')
    if (!map[category]) return
    const reps = (session.exercises ?? []).reduce((exSum, ex) =>
      exSum + (ex.sets ?? []).reduce((sSum, set) => sSum + (set.reps ?? 0), 0), 0)
    map[category].actualReps += reps
  })

  return order.map(category => {
    const { label, plannedReps, actualReps } = map[category]
    const pct = plannedReps > 0 ? Math.min(100, Math.round((actualReps / plannedReps) * 100)) : 0
    const color  = actualReps === 0 ? 'none'   : pct >= 80 ? 'green' : pct >= 50 ? 'yellow' : 'red'
    const status = actualReps === 0 ? '—'      : pct >= 80 ? 'On track' : pct >= 50 ? 'Below target' : 'Low volume'
    return { label, plannedReps, actualReps, pct, color, status }
  })
}

// deriveBalanceCategories — used for skeleton state only (before sessions load)
function deriveBalanceCategories(program) {
  if (!program?.days?.length) return null
  const order = []
  const seen = new Set()
  program.days.forEach(d => {
    const cat = extractCategory(d.label)
    if (cat && !seen.has(cat)) { seen.add(cat); order.push(cat) }
  })
  return order.length > 0 ? order.map(label => ({ label })) : null
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HomeScreen({ onStartGym, postGymFeedback }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  // Raw data
  const [sessions,      setSessions]      = useState(null)
  const [profile,       setProfile]       = useState(null)
  const [program,       setProgram]       = useState(null)

  // Claude content
  const [insight,           setInsight]           = useState(null)
  const [welcome,           setWelcome]           = useState(null)
  const [balance,           setBalance]           = useState(null)
  const [restSuggestion,    setRestSuggestion]    = useState(null)

  // ── Derived ──────────────────────────────────────────────────────────────

  const todayStr = useMemo(() => localDateStr(), [])

  const completedSessions = useMemo(
    () => (sessions ?? []).filter(s => s.completed),
    [sessions]
  )

  const todaySession = useMemo(
    () => (sessions ?? []).find(s => s.date === todayStr) ?? null,
    [sessions, todayStr]
  )

  const todayDay = useMemo(
    () => (program ? getTodayWorkout(program, completedSessions.length) : null),
    [program, completedSessions.length]
  )

  const todayState = useMemo(() => {
    if (sessions === null) return null
    if (todaySession?.completed) return 'completed'
    if (!program?.days?.length) return 'scheduled'
    if (todayDay) return 'scheduled'
    return 'rest'
  }, [sessions, todaySession, program, todayDay])

  const isNewUser    = completedSessions.length === 0 && !profile?.last_chat_date
  const firstName    = getFirstName(user, profile)
  const weekDots     = useMemo(() => buildWeekDots(sessions, program), [sessions, program])
  // ── Daily rollover ─────────────────────────────────────────────────────────
  // Side effects only: missed-session detection + advancing last_chat_date (+
  // persisting post-gym feedback). No greeting is generated or rendered here — the
  // green card shows `insight`/`welcome` instead.
  useDailyThread(user?.id, { sessions, postGymFeedback })

  // ── One-time migration: remove old dateless cache keys ────────────────────
  useEffect(() => {
    if (!user) return
    sessionStorage.removeItem(`fitagent_insight_${user.id}`)
    sessionStorage.removeItem(`fitagent_balance_${user.id}`)
    sessionStorage.removeItem(`fitagent_welcome_${user.id}`)
  }, [user])

  // ── Data fetching ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('sessions')
        .select('id, date, exercises, completed, missed, notes, created_at, workout_name, additional_activities')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(60),
      supabase.from('profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('memory').select('current_program, updated_at').eq('user_id', user.id).single(),
    ]).then(([sessionsRes, profileRes, memoryRes]) => {
      setSessions(sessionsRes.data ?? [])
      setProfile(profileRes.data ?? {})
      const p = memoryRes.data?.current_program
      const loaded = p && Object.keys(p).length > 0 ? p : null
      setProgram(loaded)

      // If program is empty right after onboarding, it may still be generating.
      // Poll once after 5s to pick it up once saved.
      if (!loaded) {
        setTimeout(() => {
          supabase.from('memory').select('current_program, updated_at').eq('user_id', user.id).single()
            .then(({ data }) => {
              const retry = data?.current_program
              if (retry && Object.keys(retry).length > 0) {
                setProgram(retry)
                setMemoryVersion(data?.updated_at ?? null)
              }
            })
        }, 5000)
      }
    })
  }, [user]) // eslint-disable-line

  // ── Insight + balance ─────────────────────────────────────────────────────

  // Welcome message for new users (no completed sessions yet)
  useEffect(() => {
    if (sessions === null || !user || !program || completedSessions.length > 0) return
    const cacheKey = `fitagent_welcome_${user.id}_${todayStr}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) { setWelcome(cached); return }
    callWelcome(user.id)
      .then(t => { setWelcome(t); sessionStorage.setItem(cacheKey, t) })
      .catch(err => setWelcome(isRateLimitError(err) ? 'Daily limit reached — come back tomorrow.' : ''))
  }, [sessions, user, program]) // eslint-disable-line

  useEffect(() => {
    if (sessions === null || !user || !profile || isNewUser) return
    const cacheKey = `fitagent_insight_${user.id}_${todayStr}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) { setInsight(cached); return }
    callInsight(user.id)
      .then(t => { setInsight(t); sessionStorage.setItem(cacheKey, t) })
      .catch(err => setInsight(isRateLimitError(err) ? 'Daily limit reached — come back tomorrow.' : ''))
  }, [sessions, user, profile]) // eslint-disable-line

  useEffect(() => {
    setBalance(computeWeeklyBalance(program, sessions) ?? [])
  }, [program, sessions])

  // ── Rest + completed feedback ─────────────────────────────────────────────

  useEffect(() => {
    if (!user || todayState === null) return
    if (todayState === 'rest') {
      const key = `fitagent_rest_${user.id}_${todayStr}`
      const cached = sessionStorage.getItem(key)
      if (cached) { setRestSuggestion(cached); return }
      callRestDaySuggestion(user.id)
        .then(s => { setRestSuggestion(s); sessionStorage.setItem(key, s) })
        .catch(err => setRestSuggestion(isRateLimitError(err) ? 'Daily limit reached — come back tomorrow.' : ''))
    }
  }, [todayState, user, todayStr]) // eslint-disable-line

  // ── Loading ───────────────────────────────────────────────────────────────

  if (!user || sessions === null) return null

  // ── Workout name for today card ───────────────────────────────────────────
  const workoutName = todayDay ? getWorkoutDisplayName(todayDay.label ?? 'Workout') : 'Workout'
  const muscleGroups = getMuscleGroups(todayDay)
  const exerciseCount = todayDay?.exercises?.length ?? 0

  // AI text: program summary for new users, insight for returning users.
  // Single source per state — no greeting fallback, which caused a flicker/revert.
  const aiText = isNewUser
    ? (welcome ?? '')
    : (insight ?? '')

  // Balance data
  const hasBalance = Array.isArray(balance) && balance.length > 0

  const handleStartWorkout = () => {
    if (onStartGym) onStartGym()
    else navigate('/workout')
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* ── NAV ── */}
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
          <div style={{ position: 'relative' }}>
            <div
              style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setProfileOpen(v => !v)}
            >
              {firstName.charAt(0).toUpperCase()}
            </div>
            <AnimatePresence>
              {profileOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 109 }} onClick={() => setProfileOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: 'absolute', top: 38, right: 0, zIndex: 110,
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 12, overflow: 'hidden', minWidth: 160,
                    }}
                  >
                    <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--border)' }}>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{user?.email}</p>
                    </div>
                    <button
                      onClick={() => { setProfileOpen(false); signOut() }}
                      style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      Sign out
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
          <button className="dash-hamburger" onClick={() => setMobileMenuOpen(v => !v)}
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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

      {/* ── BODY ── */}
      <div style={{ display: 'flex', height: '100vh', paddingTop: 60 }}>

        {/* SIDEBAR */}
        <div className="dash-sidebar">
          <NavSidebar />
        </div>

        {/* MAIN */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px 48px', scrollbarWidth: 'none' }} className="scrollbar-none dash-main">

          {/* HEADER */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="dash-header-row"
            style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 300, marginBottom: 4 }}>{getGreeting()}</p>
              <h1 style={{ fontSize: 26, fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>{firstName}</h1>
            </div>
            {/* WEEK DOTS */}
            <div className="dash-week-dots" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {weekDots.map(({ date, label, type }) => (
                <div key={date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>{label}</span>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.4s ease',
                    ...DOT_STYLES[type],
                  }}>
                    {DOT_ICON[type] ?? null}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>


          {/* 2-COL GRID: Today + Balance */}
          <div className="dash-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>

            {/* TODAY CARD */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              onClick={todayState === 'scheduled' ? handleStartWorkout : undefined}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 22,
                cursor: todayState === 'scheduled' ? 'pointer' : 'default',
                transition: 'transform 0.2s, border-color 0.2s',
              }}
              whileHover={todayState === 'scheduled' ? { y: -2, transition: { duration: 0.2 } } : {}}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>TODAY</span>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: todayState === 'completed' ? 'var(--text-muted)' : todayState === null ? 'var(--border)' : 'var(--green)', animation: todayState === 'scheduled' ? 'pulse 2s ease-in-out infinite' : 'none' }} />
              </div>

              {todayState === null ? (
                <>
                  <div style={{ height: 22, background: 'var(--surface2)', borderRadius: 6, marginBottom: 8, width: '55%', opacity: 0.6 }} />
                  <div style={{ height: 14, background: 'var(--surface2)', borderRadius: 4, marginBottom: 20, width: '75%', opacity: 0.35 }} />
                  <div style={{ height: 2, background: 'var(--surface2)', borderRadius: 100, marginBottom: 16 }} />
                </>
              ) : todayState === 'rest' ? (
                <>
                  <p style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Rest Day</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 300, marginBottom: 16, lineHeight: 1.5 }}>
                    {restSuggestion ?? 'Recovery is part of the program.'}
                  </p>
                </>
              ) : todayState === 'completed' ? (
                <>
                  <p style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Completed</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 300, marginBottom: 16, lineHeight: 1.5 }}>
                    {workoutName} · {(todaySession?.exercises ?? []).map(ex => ex.name).join(', ') || `${exerciseCount} exercises`}
                  </p>
                  <div style={{ height: 2, background: 'var(--surface2)', borderRadius: 100, marginBottom: 16, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--green)', borderRadius: 100, width: '100%', transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>{workoutName}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 300, marginBottom: 16 }}>
                    {muscleGroups ? `${muscleGroups} · ` : ''}{exerciseCount} exercises
                  </p>
                  <div style={{ height: 2, background: 'var(--surface2)', borderRadius: 100, marginBottom: 16, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--green)', borderRadius: 100, width: '0%', transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="6" cy="6" r="5"/><path d="M6 3v3.5l1.5 1.5"/></svg>
                      {profile?.session_length ? `~${profile.session_length} min` : '~55 min'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2 6h1.5m5 0H10M3.5 6a2.5 2.5 0 005 0m-5 0a2.5 2.5 0 015 0"/></svg>
                      Not started
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleStartWorkout() }}
                    style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, background: 'var(--green)', color: '#000', border: 'none', borderRadius: 100, padding: '11px 24px', cursor: 'pointer', transition: 'opacity 0.2s, transform 0.2s', width: '100%' }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none' }}
                  >Start workout</button>
                </>
              )}
            </motion.div>

            {/* BALANCE CARD */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 22,
                opacity: hasBalance ? 1 : 0.4, transition: 'opacity 0.4s',
              }}
            >
              <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 16 }}>TRAINING BALANCE</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {hasBalance ? balance.map(item => {
                  const barColor   = item.color === 'green' ? '#4a9a30' : item.color === 'yellow' ? '#c8a020' : item.color === 'red' ? '#c84040' : 'var(--surface2)'
                  const badgeBg    = item.color === 'green' ? '#1a2e14' : item.color === 'yellow' ? '#2a2510' : item.color === 'red' ? '#2a1212' : 'transparent'
                  const badgeColor = item.color === 'green' ? '#4a9a30' : item.color === 'yellow' ? '#c8a020' : item.color === 'red' ? '#c84040' : 'var(--text-muted)'
                  return (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 300, width: 72, flexShrink: 0 }}>{item.label}</span>
                    <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 100, height: 4, overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${item.pct ?? 0}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        style={{ height: '100%', borderRadius: 100, background: barColor }}
                      />
                    </div>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 100, fontWeight: 500, flexShrink: 0, background: badgeBg, color: badgeColor }}>
                      {item.status}
                    </span>
                  </div>
                )}) : (() => {
                  const skeletonCategories = deriveBalanceCategories(program) ?? []
                  return (
                    <>
                      {skeletonCategories.map(({ label }) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 300, width: 72, flexShrink: 0 }}>{label}</span>
                          <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 100, height: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: '0%', borderRadius: 100, background: 'var(--green)' }} />
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 32, textAlign: 'right', flexShrink: 0 }}>—</span>
                        </div>
                      ))}
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 300, fontStyle: 'italic', marginTop: 10 }}>Waiting for session data</p>
                    </>
                  )
                })()}
              </div>
            </motion.div>
          </div>

          {/* AI INSIGHT CARD */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            style={{ background: '#0c1a08', border: '1px solid #1e3015', borderRadius: 16, padding: 18, display: 'flex', gap: 12, marginBottom: 14 }}
          >
            <div style={{ flexShrink: 0, marginTop: 1 }}>
              <PulsingOrb size={24} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 300, lineHeight: 1.65 }}>
              <ReactMarkdown>{aiText || ''}</ReactMarkdown>
            </div>
          </motion.div>

          {/* WORKOUT PLAN CARD */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
            <WorkoutPlanCard program={program} todayDay={todayDay} />
          </motion.div>

        </div>
      </div>

      {/* Responsive */}
      <style>{`
        @media (max-width: 768px) {
          .dash-sidebar { display: none !important; }
          .dash-hamburger { display: flex !important; }
          .dash-main { padding: 20px 16px 48px !important; }
          .dash-week-dots { gap: 4px !important; }
          .dash-week-dots > div > div { width: 22px !important; height: 22px !important; }
        }
        @media (max-width: 480px) {
          .dash-2col { grid-template-columns: 1fr !important; }
          .dash-plan-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .dash-header-row { flex-direction: column; gap: 16px; }
          .dash-week-dots { gap: 5px !important; }
          .dash-week-dots > div > div { width: 26px !important; height: 26px !important; }
        }
      `}</style>
    </div>
  )
}
