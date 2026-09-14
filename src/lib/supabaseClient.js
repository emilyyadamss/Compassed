import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your project credentials.',
  )
}

// Read before the client starts: it strips the auth params from the URL once it
// has swapped them for a session, and its PASSWORD_RECOVERY event can fire
// before React has subscribed.
export const isRecoveryRedirect = /[#&?]type=recovery\b/.test(window.location.hash + window.location.search)

export const supabase = createClient(url, anonKey)
