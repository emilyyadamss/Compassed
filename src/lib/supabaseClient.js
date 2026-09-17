import { createClient } from '@supabase/supabase-js'
import { parseAuthHash } from './authRedirect.js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your project credentials.',
  )
}

// Read before the hash is cleared below, which is the only place it says so.
export const isRecoveryRedirect = /[#&?]type=recovery\b/.test(window.location.hash + window.location.search)

/* Email links (password reset, magic link, signup and email-change
   confirmations) land with tokens in the hash. Supabase would clear them with
   `location.hash = ''`, which pushes a new history entry and leaves the
   tokenised URL one step back, where Back returns straight to it. Instead they
   come out here, with replaceState, before the client exists: the entry is
   rewritten in place and nothing tokenised is left in session history.

   This can't reach the browser's global history (Cmd+Y). The page visit is
   recorded before any script runs, so that needs the PKCE flow, which doesn't
   work when a reset is requested on one device and opened on another. */
const fromUrl = parseAuthHash(window.location.hash)
if (fromUrl) {
  const { pathname, search } = window.location
  window.history.replaceState(window.history.state, '', pathname + search)
}

export const supabase = createClient(url, anonKey, {
  // We have already taken the tokens out of the URL, so there is nothing for
  // the client to detect — and letting it look would bring back the push above.
  auth: { detectSessionInUrl: false },
})

/* Resolves once any tokens from the URL have been exchanged for a session.
   Nothing may read auth state before this settles. The client is unlocked by
   default, so getSession() does not queue behind setSession(), and a new
   onAuthStateChange subscriber is sent INITIAL_SESSION straight away — with
   null, while the exchange is still on the network. Either would show the
   landing page for a moment before the session arrived. App.jsx waits on this
   instead. It never rejects: a link that fails to sign in (expired, already
   used) just leaves you signed out, as it did before. */
export const authReady = fromUrl
  ? supabase.auth
      .setSession({ access_token: fromUrl.accessToken, refresh_token: fromUrl.refreshToken })
      .then(({ error }) => {
        if (error) console.error('Could not sign in from the email link', error)
      })
      .catch((err) => console.error('Could not sign in from the email link', err))
  : Promise.resolve()
