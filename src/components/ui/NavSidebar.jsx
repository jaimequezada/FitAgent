import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { loadTodayThread } from '../../lib/dailyThread'
import PulsingOrb from './PulsingOrb'

const HomeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M2 8.5L8 3l6 5.5"/>
    <path d="M4 7V13h3v-3h2v3h3V7"/>
  </svg>
)

const WorkoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M2 8h2m8 0h2M4 8a4 4 0 008 0M4 8a4 4 0 018 0"/>
  </svg>
)

const navItems = [
  { to: '/home', label: 'Home', icon: <HomeIcon /> },
  { to: '/workout', label: 'Workout', icon: <WorkoutIcon /> },
  { to: '/agent', label: 'Agent', icon: <PulsingOrb size={16} borderRadius={5} /> },
]

export default function NavSidebar() {
  const location = useLocation()
  const { user } = useAuth()
  // Dot on the Agent item when an un-acted check-in is waiting in today's thread
  // (a pending program proposal, or an info check-in not yet viewed).
  const [checkinWaiting, setCheckinWaiting] = useState(false)

  useEffect(() => {
    if (!user?.id) { setCheckinWaiting(false); return }
    loadTodayThread(user.id).then(t => {
      setCheckinWaiting(Boolean(
        t?.some(m => m.checkin && (m.checkin.status === 'pending' || m.checkin.status === 'info'))
      ))
    })
  }, [user?.id, location.pathname])

  return (
    <div style={{
      width: 200,
      flexShrink: 0,
      borderRight: '1px solid var(--border)',
      padding: '20px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      {navItems.map(({ to, label, icon }) => {
        const active = location.pathname === to
        return (
          <Link
            key={to}
            to={to}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 400,
              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
              background: active ? 'var(--surface)' : 'transparent',
              textDecoration: 'none',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              if (!active) {
                e.currentTarget.style.background = 'var(--surface)'
                e.currentTarget.style.color = 'var(--text-secondary)'
              }
            }}
            onMouseLeave={e => {
              if (!active) {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--text-muted)'
              }
            }}
          >
            {icon}
            {label}
            {to === '/agent' && checkinWaiting && (
              <span style={{
                marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%',
                background: 'var(--green)', flexShrink: 0,
              }} />
            )}
          </Link>
        )
      })}
    </div>
  )
}
