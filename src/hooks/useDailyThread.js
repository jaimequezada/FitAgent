// useDailyThread.js
// Daily rollover side effects for Home mode. Runs once on the first Home load of
// a new day and:
//   1. detects & logs any missed scheduled sessions (drives the week-dot "missed"
//      markers + missed-session signals)
//   2. advances profiles.last_chat_date
//   3. on a post-gym return, persists the (already-generated) feedback message to
//      the daily thread for continuity
//
// It deliberately does NOT generate a chat greeting. The Home green card already
// shows a personalized daily message (insight for returning users, welcome for new
// ones), and the /agent view opens from its own fresh greeting — so a separately
// generated daily greeting was an unused, duplicate Claude call (callWelcome even
// ran twice for new users). Removed to stop the waste.

import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { callWeeklyCheckin, isRateLimitError } from '../lib/claude'
import { detectAndLogMissedSession } from '../lib/missedSessions'
import { clearTodayThread, upsertThread } from '../lib/dailyThread'
import { localDateStr as todayStr } from '../lib/dates'

const DAY_MS = 86400000

// Decide whether the weekly / end-of-trial check-in should fire today.
// Returns { due, trialFinal }.
//   - trialFinal: it's the last day of the 7-day trial (days 6→7 since signup)
//   - weekly: ≥7 days since the last check-in (or since signup if never run)
// Requires at least one completed session — there's nothing to review otherwise.
// Note: under the current hard 7-day trial (with no paid tier), the recurring
// weekly branch effectively only fires for users past their trial; in practice
// the end-of-trial check-in is the one that triggers.
function evaluateCheckin({ hasSessions, lastCheckinAt, trialStartedAt }) {
  if (!hasSessions) return { due: false, trialFinal: false }
  const sinceSignup  = trialStartedAt ? (Date.now() - new Date(trialStartedAt).getTime()) / DAY_MS : Infinity
  const sinceCheckin = lastCheckinAt  ? (Date.now() - new Date(lastCheckinAt).getTime())  / DAY_MS : Infinity
  const trialFinal = trialStartedAt && sinceSignup >= 6 && sinceSignup < 7
  const weeklyDue  = lastCheckinAt ? sinceCheckin >= 7 : sinceSignup >= 7
  return { due: Boolean(trialFinal || weeklyDue), trialFinal: Boolean(trialFinal) }
}

// options:
//   sessions        — Session[] | null (wait for this before initialising)
//   postGymFeedback — string | null (triggers post-gym thread persistence)
export function useDailyThread(userId, { sessions = null, postGymFeedback = null } = {}) {
  const initDone = useRef(false)

  useEffect(() => {
    // Wait for sessions to resolve before initializing
    if (!userId || sessions === null || initDone.current) return
    initDone.current = true

    const today = todayStr()
    const hasSessions = sessions.filter(s => s.completed).length > 0

    async function init() {
      // ── Post-gym return ──────────────────────────────────────
      // Persist the feedback (generated in the gym flow — no call here) + roll the date.
      if (postGymFeedback) {
        await clearTodayThread(userId)
        await upsertThread(userId, [{ role: 'assistant', content: postGymFeedback, streaming: false }])
        await supabase
          .from('profiles')
          .update({ last_chat_date: today })
          .eq('user_id', userId)
        return
      }

      // ── Check last_chat_date ─────────────────────────────────
      const { data: profile } = await supabase
        .from('profiles')
        .select('last_chat_date, last_checkin_at, trial_started_at')
        .eq('user_id', userId)
        .single()

      const lastChatDate = profile?.last_chat_date
      const isNewDay     = !lastChatDate || lastChatDate < today
      if (!isNewDay) return

      // ── New day: detect missed sessions, clear stale thread ──
      try {
        // Pass last_chat_date so detection covers every scheduled day the
        // user was away for, not just yesterday.
        await detectAndLogMissedSession(userId, { since: lastChatDate })
      } catch (e) {
        console.error('[useDailyThread] detectAndLogMissedSession:', e)
      }

      await clearTodayThread(userId)

      // ── Weekly / end-of-trial check-in ───────────────────────
      // If due, generate the coach review and seed today's thread with it so the
      // Agent surfaces it. On failure we skip without stamping last_checkin_at so
      // it retries next day.
      const { due, trialFinal } = evaluateCheckin({
        hasSessions,
        lastCheckinAt:  profile?.last_checkin_at,
        trialStartedAt: profile?.trial_started_at,
      })
      if (due) {
        try {
          const { message, proposedProgram } = await callWeeklyCheckin(userId, { trialFinal })
          if (message) {
            await upsertThread(userId, [{
              role: 'assistant',
              content: message,
              streaming: false,
              checkin: proposedProgram
                ? { proposedProgram, status: 'pending' } // awaits user Apply/Keep
                : { status: 'info' },                    // info-only; cleared on first Agent view
            }])
            await supabase
              .from('profiles')
              .update({ last_checkin_at: new Date().toISOString() })
              .eq('user_id', userId)
          }
        } catch (e) {
          if (!isRateLimitError(e)) console.error('[useDailyThread] callWeeklyCheckin:', e)
        }
      }

      // ── Roll the date ────────────────────────────────────────
      await supabase
        .from('profiles')
        .update({ last_chat_date: today })
        .eq('user_id', userId)
    }

    init().catch(err => console.error('[useDailyThread]', err))
  }, [userId, sessions]) // eslint-disable-line react-hooks/exhaustive-deps
  // postGymFeedback intentionally excluded from deps: init runs once per mount and
  // HomeScreen remounts on every gym transition, so the value is fresh at init time.
}
