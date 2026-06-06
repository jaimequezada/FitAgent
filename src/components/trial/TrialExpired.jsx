import { supabase } from '../../lib/supabase'

export default function TrialExpired() {
  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.replace('/')
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 24, textAlign: 'center',
    }}>
      <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 16 }}>
        FREE TRIAL ENDED
      </p>
      <h1 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: 16, lineHeight: 1.2 }}>
        Your 7 days are up.
      </h1>
      <p style={{ fontSize: 15, color: 'var(--text-secondary)', fontWeight: 300, maxWidth: 340, marginBottom: 48, lineHeight: 1.6 }}>
        Membership is coming soon. Check back shortly to continue your training.
      </p>
      <button
        onClick={handleSignOut}
        style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500,
          padding: '12px 28px', borderRadius: 12, cursor: 'pointer',
          background: 'var(--surface2)', border: '1px solid var(--border2)',
          color: 'var(--text-secondary)', transition: 'opacity 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.7' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
      >
        Sign out
      </button>
    </div>
  )
}
