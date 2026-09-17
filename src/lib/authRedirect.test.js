import { describe, expect, it } from 'vitest'
import { parseAuthHash } from './authRedirect.js'

describe('parseAuthHash', () => {
  it('reads the tokens from a password-reset link', () => {
    expect(parseAuthHash('#access_token=aaa&expires_in=3600&refresh_token=rrr&token_type=bearer&type=recovery'))
      .toEqual({ accessToken: 'aaa', refreshToken: 'rrr', type: 'recovery' })
  })

  /* Every implicit-flow email link carries tokens the same way. If only resets
     were recognised, turning off Supabase's own URL detection would silently
     break magic-link sign-in and signup confirmation. */
  it('reads magic-link, signup and email-change links the same way', () => {
    for (const type of ['magiclink', 'signup', 'email_change', 'invite']) {
      expect(parseAuthHash(`#access_token=a&refresh_token=r&type=${type}`))
        .toEqual({ accessToken: 'a', refreshToken: 'r', type })
    }
  })

  it('accepts a hash with or without its leading #', () => {
    expect(parseAuthHash('access_token=a&refresh_token=r')?.accessToken).toBe('a')
  })

  it('returns null when there is nothing to take', () => {
    expect(parseAuthHash('')).toBeNull()
    expect(parseAuthHash('#')).toBeNull()
    expect(parseAuthHash(undefined)).toBeNull()
    expect(parseAuthHash('#section-2')).toBeNull()
  })

  /* An expired or already-used link comes back as an error hash. There is
     nothing secret in it, so it is left in the URL as it always was. */
  it('ignores an error hash', () => {
    expect(parseAuthHash('#error=access_denied&error_code=otp_expired&error_description=Link+expired'))
      .toBeNull()
  })

  /* Still returned, so the caller strips it: a lone access token can't sign
     anyone in through setSession, but it is a live credential for an hour. */
  it('still reports an access token that has no refresh token', () => {
    expect(parseAuthHash('#access_token=a')).toEqual({ accessToken: 'a', refreshToken: null, type: null })
  })

  it('does not mangle a JWT', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJlLV8'
    expect(parseAuthHash(`#access_token=${jwt}&refresh_token=r`).accessToken).toBe(jwt)
  })
})
