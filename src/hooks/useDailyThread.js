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
import { detectAndLogMissedSession } from '../lib/missedSessions'
import { clearTodayThread, upsertThread } from '../lib/dailyThread'
import { localDateStr as todayStr } from '../lib/dates'

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
        .select('last_chat_date')
        .eq('user_id', userId)
        .single()

      const lastChatDate = profile?.last_chat_date
      const isNewDay     = !lastChatDate || lastChatDate < today
      if (!isNewDay) return

      // ── New day: detect missed sessions, clear stale thread, roll the date ──
      try {
        // Pass last_chat_date so detection covers every scheduled day the
        // user was away for, not just yesterday.
        await detectAndLogMissedSession(userId, { since: lastChatDate })
      } catch (e) {
        console.error('[useDailyThread] detectAndLogMissedSession:', e)
      }

      await clearTodayThread(userId)
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
