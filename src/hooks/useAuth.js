// useAuth.js
// Subscribes to Supabase auth state changes.
// Returns the current session and user, plus sign-up, sign-in, sign-out helpers.
// isLoading is true during the initial session check — use it to avoid
// flashing the auth screen before the session is resolved.

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Resolve existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setIsLoading(false)
    }).catch((err) => {
      console.error('[useAuth] getSession failed:', err)
      setIsLoading(false)
    })

    // Subscribe to auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(prev => {
        const next = session?.user ?? null
        // Avoid re-render if the user ID hasn't changed (e.g. token refresh)
        if (prev?.id === next?.id) return prev
        return next
      })
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signUp(email, password) {
    setError(null)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) setError(error.message)
    return { error }
  }

  async function signIn(email, password) {
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    return { error }
  }

  async function signOut() {
    setError(null)
    await supabase.auth.signOut()
  }

  // Permanently deletes the account and all data via the server-side endpoint
  // (the only place with the service-role key). On success we sign out locally
  // so the auth-state listener drops the app back to the landing/auth screen.
  async function deleteAccount() {
    setError(null)
    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token
    if (!accessToken) {
      const message = 'Not signed in'
      setError(message)
      return { error: message }
    }

    try {
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        const message = body.error || 'Failed to delete account'
        setError(message)
        return { error: message }
      }
    } catch (err) {
      const message = err?.message || 'Failed to delete account'
      setError(message)
      return { error: message }
    }

    await supabase.auth.signOut()
    return { error: null }
  }

  return { user, isLoading, error, signUp, signIn, signOut, deleteAccount }
}
