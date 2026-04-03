import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Dev-only console test helper
// Usage: await window.__testAgent("Should I add more volume to my squat?")
if (import.meta.env.DEV) {
  const { callClaude } = await import('./lib/claude.js')
  const { supabase }   = await import('./lib/supabase.js')
  window.__testAgent = async (message, type = 'chat') => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { console.error('[testAgent] Not logged in'); return }
    console.log('[testAgent] userId:', user.id)
    console.log('[testAgent] sending:', message)
    const response = await callClaude(message, user.id, type)
    console.log('[testAgent] response:', response)
    return response
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
