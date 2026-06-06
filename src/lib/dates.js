// dates.js — local-time date helpers.
//
// Every date KEY in the app — session.date, daily_threads.date,
// profiles.last_chat_date, and missed-session detection — uses the user's
// LOCAL calendar day. A 9pm workout is logged on the day the user actually
// trained, not the next UTC day. Previously some paths used
// `new Date().toISOString().slice(0,10)` (UTC) while others used local
// getDay()/getDate(), which could disagree by a day near midnight for users in
// non-UTC timezones. Route all of it through here so it stays consistent.
//
// YYYY-MM-DD strings sort lexicographically in chronological order, so they're
// safe to compare with <, >, and Supabase gte/lte filters.

export function localDateStr(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
