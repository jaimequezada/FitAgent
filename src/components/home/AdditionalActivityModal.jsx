// AdditionalActivityModal.jsx
// Modal for logging additional activities after a completed gym session.
// Saves to sessions.additional_activities, calls Haiku for acknowledgment,
// shows ack briefly, then persists ack to daily thread and closes.

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { callActivityAck } from '../../lib/claude'
import { loadTodayThread, upsertThread } from '../../lib/dailyThread'

const ACTIVITY_TYPES = [
  { id: 'cardio',     label: 'Cardio' },
  { id: 'mobility',   label: 'Mobility' },
  { id: 'extra_sets', label: 'Extra sets' },
  { id: 'other',      label: 'Other' },
]

export default function AdditionalActivityModal({ userId, todaySession, onClose }) {
  const [activityType, setActivityType] = useState(null)
  const [duration,     setDuration]     = useState('')
  const [notes,        setNotes]        = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [ack,          setAck]          = useState(null)   // null = not yet, '' = done

  async function handleSubmit() {
    if (!activityType || submitting) return
    setSubmitting(true)

    try {
      // Save activity to sessions table
      const newActivity = {
        type:             activityType,
        duration_minutes: duration ? parseInt(duration, 10) : null,
        notes:            notes.trim() || null,
        logged_at:        new Date().toISOString(),
      }

      const currentActivities = todaySession?.additional_activities ?? []
      await supabase
        .from('sessions')
        .update({ additional_activities: [...currentActivities, newActivity] })
        .eq('id', todaySession.id)

      // Fetch Haiku acknowledgment
      const ackText = await callActivityAck(
        userId,
        activityType,
        duration ? parseInt(duration, 10) : null,
        notes.trim(),
      )

      // Persist ack to daily thread so it survives same-day revisits
      try {
        const currentThread = await loadTodayThread(userId) ?? []
        await upsertThread(userId, [
          ...currentThread,
          { role: 'assistant', content: ackText, streaming: false },
        ])
      } catch {
        // Non-critical — ack still shown in modal
      }

      setAck(ackText)

      // Auto-close after showing the acknowledgment
      setTimeout(() => onClose(), 1800)
    } catch (err) {
      console.error('[AdditionalActivityModal]', err)
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-t-3xl px-6 pt-6 pb-10 flex flex-col gap-5"
        style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Handle */}
        <div className="w-10 h-1 rounded-full bg-[rgba(255,255,255,0.15)] mx-auto -mt-1" />

        {/* Heading */}
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          What else did you do?
        </h2>

        {/* Ack state — shown after submit */}
        {ack !== null ? (
          <div className="py-6 text-center">
            <p className="text-sm text-[var(--text-secondary)]">{ack}</p>
          </div>
        ) : (
          <>
            {/* Activity type grid */}
            <div className="grid grid-cols-2 gap-2">
              {ACTIVITY_TYPES.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setActivityType(id)}
                  className="py-3 px-4 rounded-xl text-sm text-left transition-colors"
                  style={{
                    background:  activityType === id ? 'var(--accent-green)' : 'var(--bg-base)',
                    color:       activityType === id ? '#0a0a0a' : 'var(--text-secondary)',
                    border:      `1px solid ${activityType === id ? 'transparent' : 'rgba(255,255,255,0.08)'}`,
                    fontWeight:  activityType === id ? 600 : 400,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Duration */}
            <div className="flex flex-col gap-2">
              <label className="text-xs text-[var(--text-secondary)]">
                How long? (minutes)
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                placeholder="0"
                className="w-full py-4 px-4 rounded-xl text-2xl font-bold text-[var(--text-primary)] bg-[var(--bg-base)] border border-[var(--border)] outline-none focus:border-[var(--text-secondary)] text-center"
                style={{ appearance: 'textfield' }}
              />
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Anything worth noting?"
                className="w-full py-3 px-4 rounded-xl text-sm text-[var(--text-primary)] bg-[var(--bg-base)] border border-[var(--border)] outline-none focus:border-[var(--text-secondary)] placeholder:text-[var(--text-muted)]"
              />
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!activityType || submitting}
              className="w-full py-4 rounded-xl text-sm font-semibold tracking-widest uppercase transition-opacity disabled:opacity-30"
              style={{ background: 'var(--accent-green)', color: '#0a0a0a' }}
            >
              {submitting ? 'Logging…' : 'Log it'}
            </button>

            {/* Cancel */}
            <button
              onClick={onClose}
              className="text-sm text-[var(--text-muted)] text-center w-full"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  )
}
