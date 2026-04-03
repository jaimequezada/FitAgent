// RestTimer.jsx
// Countdown timer shown between sets during gym mode.
// Displays giant countdown number. Vibrates on mobile when complete.
// Tap anywhere to skip rest and advance immediately.
// Auto-advances to next set when timer reaches zero.

import { useState, useEffect } from 'react'

export default function RestTimer({ duration = 90, onComplete }) {
  const [remaining, setRemaining] = useState(duration)

  useEffect(() => {
    if (remaining <= 0) {
      try { navigator.vibrate(200) } catch {}
      onComplete()
      return
    }
    const id = setTimeout(() => setRemaining(r => r - 1), 1000)
    return () => clearTimeout(id)
  }, [remaining, onComplete])

  const mins = Math.floor(remaining / 60)
  const secs = String(remaining % 60).padStart(2, '0')

  return (
    <button
      onClick={onComplete}
      className="flex flex-col items-center justify-center gap-4 w-full h-full"
    >
      <div className="flex items-center justify-center gap-3">
        <span className="text-[10px] tracking-[0.2em] text-[var(--text-secondary)] uppercase">Rest</span>
        <span
          className="text-5xl font-bold tabular-nums"
          style={{ color: remaining <= 10 ? 'var(--accent-green)' : 'var(--text-primary)' }}
        >
          {mins}:{secs}
        </span>
      </div>
      <p className="text-[var(--text-muted)] text-sm">Tap to skip</p>
    </button>
  )
}
