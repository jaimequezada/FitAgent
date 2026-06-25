// api/delete-account.js
// Vercel serverless function. Permanently deletes the authenticated user's
// account and all their data.
//
// Why server-side: removing an auth user requires auth.admin.deleteUser, which
// needs the Supabase SERVICE-ROLE key. That key must NEVER reach the browser
// bundle, so deletion can only happen here.
//
// Data cleanup is automatic: every table (profiles, sessions, daily_threads,
// interactions) references auth.users(id) ON DELETE CASCADE, so deleting the
// auth user wipes all their rows atomically — no manual table cleanup needed.
//
// Security:
//   1. Requires a valid Supabase access token (Authorization: Bearer <jwt>).
//   2. SELF-ONLY: deletes ONLY the JWT subject's user id. The request body is
//      never trusted for a user id, so a caller can only delete themselves.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function jsonError(res, status, message) {
  res.status(status).json({ error: message })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return jsonError(res, 405, 'Method not allowed')
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[api/delete-account] Supabase env vars missing on the server')
    return jsonError(res, 500, 'Server misconfiguration')
  }

  // ── 1. Authenticate the caller ───────────────────────────────────────────────
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return jsonError(res, 401, 'Authentication required')
  }

  // Per-request anon client carrying the caller's token, used only to resolve
  // who they are. Deletion runs through the admin client below.
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userErr } = await authClient.auth.getUser(token)
  const user = userData?.user
  if (userErr || !user) {
    return jsonError(res, 401, 'Invalid or expired session')
  }

  // ── 2. Delete the account (self only) ────────────────────────────────────────
  // The id comes from the verified token, never from the request body.
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error: deleteErr } = await admin.auth.admin.deleteUser(user.id)
  if (deleteErr) {
    console.error('[api/delete-account] deleteUser failed:', deleteErr.message)
    return jsonError(res, 500, 'Failed to delete account, try again shortly')
  }

  return res.status(200).json({ ok: true })
}
