// TodayWorkoutCard.jsx
// Three mutually exclusive states:
//
//   'rest'      — no workout scheduled for today's day of week
//   'scheduled' — workout planned, session not yet completed
//   'completed' — session logged and completed today
//
// Props:
//   todayState        'rest' | 'scheduled' | 'completed'
//   day               Program day object (used in scheduled + completed for name)
//   sessionLength     number (minutes) — shown in scheduled state
//   lastSessionDate   string ISO date   — shown in scheduled state
//   onStartGym        () => void        — only wired in scheduled state
//   suggestion        string | null     — Haiku suggestion for rest state
//   todaySession      session record    — used in completed state
//   (completedFeedback removed — completed state now shows exercise list)

// ── Helpers ─────────────────────────────────────────────────────────────────

function getMuscleGroups(label = '') {
  const l = label.toLowerCase()
  if (l.includes('push'))                       return 'Chest · Shoulders · Triceps'
  if (l.includes('pull'))                       return 'Back · Biceps'
  if (l.includes('leg') || l.includes('lower')) return 'Quads · Hamstrings · Glutes'
  if (l.includes('upper'))                      return 'Chest · Back · Shoulders'
  if (l.includes('full'))                       return 'Full Body'
  return null
}

function getWorkoutName(label = '') {
  const dashMatch = label.match(/—\s*(.+)$/)
  if (dashMatch) {
    const name = dashMatch[1].trim()
    return name.toLowerCase().includes('day') ? name : `${name} Day`
  }
  return label
}

function formatRelativeDate(dateStr) {
  if (!dateStr) return null
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7)  return `${days} days ago`
  if (days < 14) return 'Last week'
  return `${Math.floor(days / 7)} weeks ago`
}

function formatTime(isoString) {
  if (!isoString) return null
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

const BASE_CARD = {
  background: '#0d0d0d',
  border:     '1px solid rgba(255,255,255,0.07)',
}

// ── Component ────────────────────────────────────────────────────────────────

export default function TodayWorkoutCard({
  todayState = 'scheduled',
  day,
  sessionLength,
  lastSessionDate,
  onStartGym,
  suggestion,
  todaySession,
}) {

  // ── REST DAY ───────────────────────────────────────────────────────────────
  if (todayState === 'rest') {
    return (
      <div
        className="w-full px-5 py-5 rounded-2xl"
        style={{ ...BASE_CARD, borderLeft: '3px solid rgba(255,255,255,0.08)', opacity: 0.7 }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-[9px] tracking-[0.22em] text-[var(--text-secondary)] uppercase">Today</p>
          <p className="text-[9px] tracking-[0.22em] text-[var(--text-muted)] uppercase">Rest Day</p>
        </div>

        <p className="text-2xl font-bold text-[var(--text-primary)] mb-1">Active Recovery</p>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Your body grows during rest, not just during training.
        </p>

        <p className="text-xs text-[var(--text-secondary)]">
          {suggestion === null
            ? <span className="inline-block h-2.5 w-48 rounded bg-[var(--bg-elevated)] animate-pulse" />
            : (suggestion || 'Good day for a walk or light mobility work.')}
        </p>
      </div>
    )
  }

  // ── COMPLETED ──────────────────────────────────────────────────────────────
  if (todayState === 'completed') {
    const exerciseCount = todaySession?.exercises?.length ?? 0
    const completedTime = formatTime(todaySession?.created_at)
    const workoutName   = day
      ? getWorkoutName(day.label)
      : (todaySession?.workout_name ?? 'Workout')

    const meta = [
      exerciseCount > 0 ? `${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''}` : null,
      completedTime     ? `Completed ${completedTime}` : null,
    ].filter(Boolean).join(' · ')

    return (
      <div
        className="w-full px-5 py-5 rounded-2xl"
        style={{ ...BASE_CARD, borderLeft: '3px solid var(--accent-green)', opacity: 0.8 }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-[9px] tracking-[0.22em] text-[var(--text-secondary)] uppercase">Today</p>
          <p
            className="text-[9px] tracking-[0.22em] uppercase font-semibold"
            style={{ color: 'var(--accent-green)' }}
          >
            ✓ Completed
          </p>
        </div>

        <p className="text-2xl font-bold text-[var(--text-primary)] mb-1">{workoutName}</p>

        {meta && <p className="text-xs text-[var(--text-secondary)] mb-4">{meta}</p>}

        {(todaySession?.exercises ?? []).length > 0 && (
          <p className="text-xs text-[var(--text-secondary)]">
            {todaySession.exercises.map(ex => ex.name).join(' · ')}
          </p>
        )}
      </div>
    )
  }

  // ── SCHEDULED (default) ────────────────────────────────────────────────────
  if (!day) return null

  const workoutName   = getWorkoutName(day.label)
  const muscleGroups  = getMuscleGroups(day.label)
  const exerciseCount = day.exercises?.length ?? 0
  const lastTime      = formatRelativeDate(lastSessionDate)
  const mainExercise  = day.exercises?.find(ex => ex.weight_lbs > 0)
  const target        = mainExercise
    ? `Target: ${mainExercise.weight_lbs} lbs — ${mainExercise.name}`
    : null

  return (
    <button
      onClick={onStartGym}
      className="w-full text-left px-5 py-5 rounded-2xl relative overflow-hidden transition-opacity active:opacity-75"
      style={{ ...BASE_CARD, borderLeft: '3px solid var(--accent-green)' }}
    >
      <p className="text-[9px] tracking-[0.22em] text-[var(--text-secondary)] uppercase mb-3">Today</p>

      <p className="text-2xl font-bold text-[var(--text-primary)] mb-1 pr-8">{workoutName}</p>

      {muscleGroups && (
        <p className="text-sm text-[var(--text-secondary)] mb-4">{muscleGroups}</p>
      )}

      <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
        {exerciseCount > 0 && <span>{exerciseCount} exercises</span>}
        {sessionLength  && <span>{sessionLength} min</span>}
        {lastTime       && <span>Last: {lastTime}</span>}
      </div>

      {target && (
        <p className="text-xs mt-3" style={{ color: 'var(--accent-green)' }}>{target}</p>
      )}

      <span
        className="absolute right-5 top-1/2 -translate-y-1/2 text-base"
        style={{ color: 'var(--text-muted)' }}
      >
        →
      </span>
    </button>
  )
}
