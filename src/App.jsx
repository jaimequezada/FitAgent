// App.jsx
// Root component. React Router handles all routes.
// Auth guard and onboarding guard protect authenticated routes.

import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { supabase } from './lib/supabase'
import LandingPage from './components/landing/LandingPage'
import AuthScreen from './components/auth/AuthScreen'
import OnboardingChat from './components/onboarding/OnboardingChat'
import HomeScreen from './components/home/HomeScreen'
import GymMode from './components/gym/GymMode'
import AgentPage from './components/agent/AgentPage'
import TrialExpired from './components/trial/TrialExpired'
import Privacy from './components/legal/Privacy'
import Terms from './components/legal/Terms'
import Support from './components/legal/Support'

function AppRoutes() {
  const { user, isLoading: authLoading } = useAuth()
  const [onboardingComplete, setOnboardingComplete] = useState(null) // null = loading
  const [trialExpired, setTrialExpired] = useState(false)

  // Handle Supabase auth redirects (email confirmation, magic links)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(() => {
        window.history.replaceState({}, '', window.location.pathname)
      })
    }
  }, [])

  // Fetch onboarding status whenever the user changes
  useEffect(() => {
    if (!user) {
      setOnboardingComplete(null)
      return
    }
    supabase
      .from('profiles')
      .select('onboarding_complete, trial_started_at')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        setOnboardingComplete(data?.onboarding_complete ?? false)
        // UX gate only — enforcement lives server-side in api/chat.js
        // (TRIAL_DAYS there must match the 7 here).
        const trialStart = data?.trial_started_at
        if (trialStart) {
          const daysSinceStart = (Date.now() - new Date(trialStart).getTime()) / (1000 * 60 * 60 * 24)
          setTrialExpired(daysSinceStart > 7)
        }
      })
  }, [user])

  if (authLoading) return null

  // Redirect unauthenticated users to /signin.
  // Redirect authenticated users who haven't onboarded to /onboarding.
  function RequireOnboarded({ children }) {
    if (!user) return <Navigate to="/signin" replace />
    if (onboardingComplete === null) return null // still loading profile
    if (!onboardingComplete) return <Navigate to="/onboarding" replace />
    if (trialExpired) return <Navigate to="/trial-expired" replace />
    return children
  }

  // Redirect authenticated + onboarded users away from onboarding.
  function OnboardingGuard({ children }) {
    if (!user) return <Navigate to="/signin" replace />
    if (onboardingComplete === null) return null // still loading profile
    if (onboardingComplete) return <Navigate to="/home" replace />
    return children
  }

  // Redirect already-authenticated users away from auth pages.
  function PublicOnly({ children }) {
    if (user) return <Navigate to="/home" replace />
    return children
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route path="/signup" element={
        <PublicOnly><AuthScreen initialMode="signup" /></PublicOnly>
      } />
      <Route path="/signin" element={
        <PublicOnly><AuthScreen initialMode="signin" /></PublicOnly>
      } />

      <Route path="/onboarding" element={
        <OnboardingGuard>
          <OnboardingChat onComplete={() => {
            window.location.replace('/home')
          }} />
        </OnboardingGuard>
      } />

      <Route path="/home" element={
        <RequireOnboarded>
          <HomeScreen />
        </RequireOnboarded>
      } />

      <Route path="/workout" element={
        <RequireOnboarded>
          <GymMode userId={user?.id} />
        </RequireOnboarded>
      } />

      <Route path="/agent" element={
        <RequireOnboarded>
          <AgentPage />
        </RequireOnboarded>
      } />

      <Route path="/trial-expired" element={<TrialExpired />} />

      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/support" element={<Support />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
