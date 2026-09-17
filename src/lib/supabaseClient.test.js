/**
 * @vitest-environment jsdom
 *
 * What supabaseClient.js does with an email link, before anything else in the
 * app runs. The property that matters: the tokens leave the URL by rewriting
 * the current history entry, never by pushing a new one, so Back can't return
 * to them — and sign-in still goes ahead.
 *
 * The module does its work at import time, so each test sets the URL, then
 * imports a fresh copy.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, setSession } = vi.hoisted(() => {
  const setSession = vi.fn()
  const createClient = vi.fn(() => ({ auth: { setSession } }))
  return { createClient, setSession }
})
vi.mock('@supabase/supabase-js', () => ({ createClient }))

const RESET_LINK = '#access_token=aaa&expires_in=3600&refresh_token=rrr&token_type=bearer&type=recovery'

async function loadAt(path) {
  window.history.replaceState(null, '', path)
  vi.resetModules()
  return import('./supabaseClient.js')
}

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test')
  createClient.mockClear()
  setSession.mockReset().mockResolvedValue({ data: {}, error: null })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('arriving from a password-reset link', () => {
  it('removes the tokens from the address bar', async () => {
    await loadAt(`/${RESET_LINK}`)
    expect(window.location.hash).toBe('')
    expect(window.location.href).not.toContain('access_token')
    expect(window.location.href).not.toContain('refresh_token')
  })

  /* The whole point of the change. Supabase's own cleanup, `location.hash =
     ''`, adds an entry; the tokenised URL is then one Back press away. */
  it('rewrites the current history entry rather than adding one', async () => {
    window.history.replaceState(null, '', `/${RESET_LINK}`)
    const lengthBefore = window.history.length
    const push = vi.spyOn(window.history, 'pushState')
    const replace = vi.spyOn(window.history, 'replaceState')

    vi.resetModules()
    await import('./supabaseClient.js')

    // The behaviour first. jsdom models this faithfully: `location.hash = ''`
    // grows history by one and leaves a bare `/#`, which is exactly the bug.
    expect(window.history.length).toBe(lengthBefore)
    expect(window.location.href.endsWith('#')).toBe(false)
    expect(push).not.toHaveBeenCalled()
    expect(replace).toHaveBeenCalledTimes(1)
  })

  it('leaves the path and query string alone', async () => {
    await loadAt(`/goal/abc?ref=email${RESET_LINK}`)
    expect(window.location.pathname).toBe('/goal/abc')
    expect(window.location.search).toBe('?ref=email')
  })

  it('still knows it was a recovery link after the hash is gone', async () => {
    const mod = await loadAt(`/${RESET_LINK}`)
    expect(mod.isRecoveryRedirect).toBe(true)
  })

  it('signs in with the tokens it took', async () => {
    const mod = await loadAt(`/${RESET_LINK}`)
    await mod.authReady
    expect(setSession).toHaveBeenCalledWith({ access_token: 'aaa', refresh_token: 'rrr' })
  })

  /* If the client were left to look at the URL too, it would find nothing —
     but the setting is what guarantees it never pushes an entry of its own. */
  it('turns off the client’s own URL detection', async () => {
    await loadAt(`/${RESET_LINK}`)
    expect(createClient).toHaveBeenCalledWith(
      'http://localhost:54321',
      'test',
      expect.objectContaining({ auth: expect.objectContaining({ detectSessionInUrl: false }) }),
    )
  })
})

describe('other email links', () => {
  /* Magic links and signup confirmations use the same hash. Handling only
     resets would break sign-in for everyone who uses a magic link. */
  it('signs in from a magic link without treating it as a reset', async () => {
    const mod = await loadAt('/#access_token=m&refresh_token=n&type=magiclink')
    await mod.authReady
    expect(setSession).toHaveBeenCalledWith({ access_token: 'm', refresh_token: 'n' })
    expect(mod.isRecoveryRedirect).toBe(false)
    expect(window.location.hash).toBe('')
  })
})

describe('when sign-in from the link fails', () => {
  /* authReady gates all of App's auth reads. If it rejected — or never
     settled — the app would sit on its loader forever. */
  it('still settles when the tokens are rejected', async () => {
    setSession.mockResolvedValue({ data: {}, error: new Error('Token has expired') })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const mod = await loadAt(`/${RESET_LINK}`)
    await expect(mod.authReady).resolves.toBeUndefined()
  })

  it('still settles when the request itself throws', async () => {
    setSession.mockRejectedValue(new Error('network down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const mod = await loadAt(`/${RESET_LINK}`)
    await expect(mod.authReady).resolves.toBeUndefined()
  })

  it('still strips an access token that arrived without a refresh token', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const mod = await loadAt('/#access_token=lonely')
    await mod.authReady
    expect(window.location.href).not.toContain('lonely')
  })
})

describe('an ordinary page load', () => {
  it('touches neither history nor the session', async () => {
    window.history.replaceState(null, '', '/activity')
    const push = vi.spyOn(window.history, 'pushState')
    const replace = vi.spyOn(window.history, 'replaceState')

    vi.resetModules()
    const mod = await import('./supabaseClient.js')
    await mod.authReady

    expect(push).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
    expect(setSession).not.toHaveBeenCalled()
    expect(mod.isRecoveryRedirect).toBe(false)
  })

  it('leaves an unrelated hash alone', async () => {
    const mod = await loadAt('/settings#section-2')
    await mod.authReady
    expect(window.location.hash).toBe('#section-2')
    expect(setSession).not.toHaveBeenCalled()
  })
})
