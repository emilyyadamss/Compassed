/* Tokens arriving in the URL from an email link.

   Supabase's implicit flow sends password-reset, magic-link, signup and
   email-change links back to the site as
   `/#access_token=…&refresh_token=…&type=recovery`. Left to itself, the client
   clears that with `location.hash = ''`, which pushes a new history entry and
   leaves the tokenised URL one step back — press Back and the tokens are in the
   address bar again. supabaseClient.js takes them out itself instead, with
   replaceState, and this is the parsing half of that. Kept pure so it can be
   tested without a browser or a Supabase client. */

/** The tokens in a URL hash, or null when the hash carries none. Returned
    whenever an access token is present — even without a refresh token — so the
    caller still strips it from the URL; a half-formed pair is useless for
    signing in but no less sensitive for being so. */
export function parseAuthHash(hash) {
  const params = new URLSearchParams(String(hash || '').replace(/^#/, ''))
  const accessToken = params.get('access_token')
  if (!accessToken) return null
  return {
    accessToken,
    refreshToken: params.get('refresh_token'),
    type: params.get('type'),
  }
}
