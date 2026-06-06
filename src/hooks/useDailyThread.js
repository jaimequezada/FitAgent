// useDailyThread.js
// Manages the daily chat thread lifecycle for Home mode.
//
// On mount (after sessions are known):
//   - If postGymFeedback is provided → clear today's thread, start fresh with feedback
//   - Else if last_chat_date < today:
//       1. detectAndLogMissedSession (writes DB before greeting context is built)
//       2. callGreeting with missedResult + todayWorkout context
//       3. Save thread + update last_chat_date
//   - Else → restore today's thread from Supabase
//
// Returns:
//   initialThread  — null while loading, Message[] when ready
//   saveThread     — call after every completed exchange

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { callGreeting, callWelcome, isRateLimitError } from '../lib/claude'
import { detectAndLogMissedSession } from '../lib/missedSessions'
import { loadTodayThread, upsertThread, clearTodayThread } from '../lib/dailyThread'
import { localDateStr as todayStr } from '../lib/dates'

// options:
//   sessions       — Session[] | null (wait for this before initialising)
//   postGymFeedback — string | null (triggers post-gym thread flow)
//   todayWorkout   — program day object | null (passed to greeting for context)
export function useDailyThread(userId, { sessions = null, postGymFeedback = null, todayWorkout = null } = {}) {
  // null = still loading; Message[] = ready (may be empty)
  const [initialThread, setInitialThread] = useState(null)
  const initDone = useRef(false)

  useEffect(() => {
    // Wait for sessions to resolve before initializing
    if (!userId || sessions === null || initDone.current) return
    initDone.current = true

    const today     = todayStr()
    const hasSessions = sessions.filter(s => s.completed).length > 0

    async function init() {
      // ── Post-gym return ──────────────────────────────────────
      // Always start a fresh thread with the session feedback.
      if (postGymFeedback) {
        await clearTodayThread(userId)
        const thread = [{ role: 'assistant', content: postGymFeedback, streaming: false }]
        await upsertThread(userId, thread)
        await supabase
          .from('profiles')
          .update({ last_chat_date: today })
          .eq('user_id', userId)
        setInitialThread(thread)
        return
      }

      // ── Check last_chat_date ─────────────────────────────────
      const { data: profile } = await supabase
        .from('profiles')
        .select('last_chat_date')
        .eq('user_id', userId)
        .single()

      const lastChatDate = profile?.last_chat_date
      const isNewDay     = !lastChatDate || lastChatDate < today

      if (isNewDay) {
        // ── STEP 1: Detect and log missed session ───────────────
        // Must complete before buildContextBrief so the signal is
        // included in the greeting context.
        let missedResult = { missed: false }
        try {
          // Pass last_chat_date so detection covers every scheduled day the
          // user was away for, not just yesterday.
          missedResult = await detectAndLogMissedSession(userId, { since: lastChatDate })
        } catch (e) {
          console.error('[useDailyThread] detectAndLogMissedSession:', e)
        }

        // ── STEP 2: Clear stale thread ──────────────────────────
        await clearTodayThread(userId)

        // ── STEP 3: Generate fresh greeting ────────────────────
        // buildContextBrief is called inside callGreeting, so it
        // now reads the freshly written missed session signal.
        let greetingText = ''
        try {
          greetingText = hasSessions
            ? await callGreeting(userId, {
                missed:           missedResult.missed,
                missedCount:      missedResult.count ?? 0,
                workoutName:      missedResult.workoutName ?? null,
                todayWorkoutLabel: todayWorkout?.label ?? null,
              })
            : await callWelcome(userId)
        } catch (e) {
          if (isRateLimitError(e)) greetingText = 'Daily limit reached — come back tomorrow.'
          // else silently fall through — empty thread is still valid
        }

        const thread = greetingText
          ? [{ role: 'assistant', content: greetingText, streaming: false }]
          : []
        if (thread.length) await upsertThread(userId, thread)

        await supabase
          .from('profiles')
          .update({ last_chat_date: today })
          .eq('user_id', userId)

        setInitialThread(thread)
      } else {
        // ── Same day: restore existing thread ──────────────────
        const saved = await loadTodayThread(userId)
        setInitialThread(saved ?? [])
      }
    }

    init().catch(err => {
      console.error('[useDailyThread]', err)
      setInitialThread([]) // Fail open — empty thread is usable
    })
  }, [userId, sessions]) // eslint-disable-line react-hooks/exhaustive-deps
  // postGymFeedback and todayWorkout intentionally excluded from deps:
  // init runs once per mount and HomeScreen remounts on every gym transition,
  // so the values are always fresh at init time.

  const saveThread = useCallback((messages) => {
    if (!userId) return
    upsertThread(userId, messages).catch(err => {
      console.error('[useDailyThread] saveThread:', err)
    })
  }, [userId])

  return { initialThread, saveThread }
}
