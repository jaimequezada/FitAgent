// WeeklyInsightRow.jsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
// Two half-width cards: current week dots + single coach insight.
//
// Dot states (derived from program.schedule + session records):
//   completed — filled green circle   (session.completed === true)
//   upcoming  — empty circle          (future or today, scheduled, not yet done)
//   rest      — short dash            (no workout in schedule for that day)
//   missed    — small filled grey     (past, scheduled, no completed session)
//
// Today's dot always gets a subtle green ring outline regardless of state.

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

// ── Date helpers ─────────────────────────────────────────────────────────────

function getWeekDates() {
  const today     = new Date()
  const dayOfWeek = today.getDay()
  const monday    = new Date(today)
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

// Returns true if the program has a scheduled workout on the given ISO date.
// Falls back to true (assume scheduled) when program has no schedule field.
function hasScheduledWorkout(program, isoDate) {
  const schedule = program?.schedule
  if (!schedule) return !!program?.days?.length  // old rotation programs: always scheduled
  const dow = new Date(isoDate + 'T12:00:00').getDay() // noon avoids DST edge cases
  return !!schedule[dow]
}

// Derive the display state for a single day cell.
function getDayState(isoDate, todayStr, program, sessionMap) {
  const session    = sessionMap.get(isoDate)
  const isRest     = !hasScheduledWorkout(program, isoDate)
  const isPast     = isoDate < todayStr
  const isToday    = isoDate === todayStr

  if (session?.completed)               return 'completed'
  if (isRest)                           return 'rest'
  if (isPast || isToday)                return isPast ? 'missed' : 'upcoming'
  return 'upcoming'  // future scheduled
}

// ── Dot renderer ─────────────────────────────────────────────────────────────

function DayDot({ state, isToday }) {
  // Today ring — applied as an outline on all states
  const todayStyle = isToday
    ? { outline: '2px solid rgba(57,255,20,0.35)', outlineOffset: '2px' }
    : {}

  if (state === 'completed') {
    return (
      <div
        className="w-3.5 h-3.5 rounded-full"
        style={{
          background:  'var(--accent-green)',
          boxShadow:   '0 0 5px rgba(57,255,20,0.4)',
          borderRadius: '50%',
          ...todayStyle,
        }}
      />
    )
  }

  if (state === 'rest') {
    return (
      <div
        style={{
          width:        '10px',
          height:       '2px',
          background:   'rgba(255,255,255,0.2)',
          borderRadius: '2px',
          ...todayStyle,
        }}
      />
    )
  }

  if (state === 'missed') {
    return (
      <div
        style={{
          width:        '8px',
          height:       '8px',
          borderRadius: '50%',
          background:   'rgba(255,255,255,0.3)',
          ...todayStyle,
        }}
      />
    )
  }

  // 'upcoming' — empty circle
  return (
    <div
      className="w-3.5 h-3.5"
      style={{
        borderRadius: '50%',
        border:       '1px solid rgba(255,255,255,0.2)',
        background:   'transparent',
        ...todayStyle,
      }}
    />
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export default function WeeklyInsightRow({ sessions = [], insight, program }) {
  const weekDates  = getWeekDates()
  const todayStr   = new Date().toISOString().split('T')[0]

  // Map date → session for O(1) lookup
  const sessionMap = new Map((sessions ?? []).map(s => [s.date, s]))

  const completedCount = weekDates.filter(d => sessionMap.get(d)?.completed).length
  const scheduledCount = weekDates.filter(d => hasScheduledWorkout(program, d)).length
  const planned        = scheduledCount || (sessions?.length ?? 0)

  return (
    <div className="grid grid-cols-2 gap-3 weekly-insight-grid">

      {/* Left: This Week */}
      <div
        className="rounded-2xl px-4 py-4 flex flex-col gap-3"
        style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <p className="text-[9px] tracking-[0.22em] text-[var(--text-secondary)] uppercase">
          This Week
        </p>
        <div className="flex items-center justify-between">
          {weekDates.map((date, i) => {
            const state   = getDayState(date, todayStr, program, sessionMap)
            const isToday = date === todayStr
            return (
              <div key={date} className="flex flex-col items-center gap-1.5">
                <span className="text-[9px] text-[var(--text-secondary)]">{DAY_LABELS[i]}</span>
                {/* Fixed-size container keeps row alignment regardless of dot size */}
                <div className="flex items-center justify-center" style={{ width: 16, height: 16 }}>
                  <DayDot state={state} isToday={isToday} />
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-[var(--text-secondary)]">
          {completedCount} of {planned} sessions
        </p>
      </div>

      {/* Right: Coach Insight */}
      <div
        className="rounded-2xl px-4 py-4 flex flex-col gap-2"
        style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <p className="text-[9px] tracking-[0.22em] text-[var(--text-secondary)] uppercase">
          Insight
        </p>
        {insight === null ? (
          <div className="flex flex-col gap-2 mt-1">
            <div className="h-2.5 w-full rounded bg-[var(--bg-elevated)] animate-pulse" />
            <div className="h-2.5 w-4/5 rounded bg-[var(--bg-elevated)] animate-pulse" />
            <div className="h-2.5 w-3/5 rounded bg-[var(--bg-elevated)] animate-pulse" />
          </div>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <span className="leading-relaxed">{children}</span>,
              strong: ({ children }) => <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
            }}
          >
            {insight}
          </ReactMarkdown>
        )}
      </div>

      <style>{`
        @media (max-width: 480px) {
          .weekly-insight-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
