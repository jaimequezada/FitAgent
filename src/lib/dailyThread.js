// dailyThread.js
// CRUD helpers for the daily_threads table.
// One record per user per day (user_id + date composite PK).
// Called by useDailyThread — not imported directly by components.

import { supabase } from './supabase'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// loadTodayThread(userId) → Message[] | null
// Returns today's thread or null if none exists yet.
export async function loadTodayThread(userId) {
  const { data } = await supabase
    .from('daily_threads')
    .select('thread')
    .eq('user_id', userId)
    .eq('date', todayStr())
    .maybeSingle()
  return data?.thread ?? null
}

// upsertThread(userId, messages)
// Saves settled (non-streaming) messages. Skips if nothing to save.
export async function upsertThread(userId, messages) {
  const settled = messages.filter(m => !m.streaming)
  if (!settled.length) return
  await supabase
    .from('daily_threads')
    .upsert(
      { user_id: userId, date: todayStr(), thread: settled, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    )
}

// clearTodayThread(userId)
// Removes today's record. Called on day rollover or post-gym return.
export async function clearTodayThread(userId) {
  await supabase
    .from('daily_threads')
    .delete()
    .eq('user_id', userId)
    .eq('date', todayStr())
}
