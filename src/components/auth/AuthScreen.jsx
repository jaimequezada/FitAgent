// AuthScreen.jsx
// Minimal sign in / sign up form.
// initialMode prop is set by the router (/signin vs /signup).

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import PulsingOrb from '../ui/PulsingOrb'

export default function AuthScreen({ initialMode = 'signin' }) {
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const { signIn, signUp, error } = useAuth()

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setMessage('')

    if (mode === 'signup') {
      const { error } = await signUp(email, password)
      if (!error) {
        setMessage('Check your email to confirm your account.')
      }
    } else {
      await signIn(email, password)
    }

    setSubmitting(false)
  }

  return (
    <div className="flex flex-col min-h-dvh" style={{ paddingTop: 60 }}>

      {/* Navbar */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 60,
        display: 'flex', alignItems: 'center', padding: '0 24px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)', zIndex: 100,
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 500, letterSpacing: '0.1em', color: 'var(--text-primary)', textDecoration: 'none' }}>
          <PulsingOrb size={24} />
          FITAGENT
        </Link>
      </nav>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', fontFamily: "'DM Sans', sans-serif" }}>

        {/* Card */}
        <div style={{ width: '100%', maxWidth: 400, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Heading */}
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
              {mode === 'signup' ? 'Create your account' : 'Welcome back'}
            </h1>
            <p style={{ fontSize: 13, fontWeight: 300, color: 'var(--text-muted)', margin: 0 }}>
              {mode === 'signup'
                ? 'Start your free trial. No credit card required.'
                : 'Sign in to continue with your coach.'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="Email"
              style={{
                background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 12,
                padding: '12px 16px', fontSize: 14, fontWeight: 300, color: 'var(--text-primary)',
                outline: 'none', fontFamily: "'DM Sans', sans-serif", transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--border)'}
              onBlur={e => e.target.style.borderColor = 'var(--border2)'}
            />
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={6}
              placeholder="Password"
              style={{
                background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 12,
                padding: '12px 16px', fontSize: 14, fontWeight: 300, color: 'var(--text-primary)',
                outline: 'none', fontFamily: "'DM Sans', sans-serif", transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--border)'}
              onBlur={e => e.target.style.borderColor = 'var(--border2)'}
            />

            {error && <p style={{ fontSize: 13, color: '#cc4444', margin: 0 }}>{error}</p>}
            {message && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{message}</p>}

            <button
              type="submit"
              disabled={submitting}
              style={{
                marginTop: 4, padding: '13px 0', borderRadius: 12, border: 'none',
                background: 'var(--green)', color: '#000', fontSize: 14, fontWeight: 500,
                fontFamily: "'DM Sans', sans-serif", cursor: submitting ? 'default' : 'pointer',
                opacity: submitting ? 0.5 : 1, transition: 'opacity 0.2s',
              }}
            >
              {submitting ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
          </form>

          {/* Toggle */}
          <button
            type="button"
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage('') }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center',
              fontSize: 13, fontWeight: 300, color: 'var(--text-muted)', fontFamily: "'DM Sans', sans-serif",
              transition: 'color 0.2s', padding: 0,
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            {mode === 'signin' ? 'No account? Sign up free' : 'Already have an account? Sign in'}
          </button>

        </div>
      </div>
    </div>
  )
}
