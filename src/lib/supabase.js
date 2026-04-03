// supabase.js
// Initializes and exports the Supabase client.
// Credentials are read from environment variables (Vite exposes VITE_ prefix).
// This is the single shared client instance used across the app.
// Never import Supabase directly elsewhere — always use this module.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars not set. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
