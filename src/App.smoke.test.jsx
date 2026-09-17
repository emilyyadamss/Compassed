/**
 * @vitest-environment jsdom
 *
 * Integration smoke test: does the app actually render the right screen for a
 * given URL? The router's own tests cover parsing and history; this covers the
 * wiring in App.jsx, which is where a `setView` that no longer matches its new
 * signature would show up.
 *
 * Supabase is mocked to a signed-out session so nothing touches the network.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

const auth = vi.hoisted(() => ({
  // Swapped per test; the getter below makes App read the current one.
  ready: Promise.resolve(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
}))

vi.mock('./lib/supabaseClient.js', () => ({
  supabase: {
    auth: {
      getSession: auth.getSession,
      onAuthStateChange: auth.onAuthStateChange,
    },
  },
  isRecoveryRedirect: false,
  get authReady() {
    return auth.ready
  },
}))

const { default: App } = await import('./App.jsx')

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  auth.ready = Promise.resolve()
  auth.getSession.mockReset().mockResolvedValue({ data: { session: null } })
  auth.onAuthStateChange
    .mockReset()
    .mockReturnValue({ data: { subscription: { unsubscribe() {} } } })
})

// Vitest globals are off, so Testing Library can't register this itself —
// without it every render stays mounted and later queries match earlier apps.
afterEach(cleanup)

describe('arriving from an email link', () => {
  /* While tokens from the URL are being exchanged, asking Supabase anything
     returns null and the landing page flashes before the reset screen. App has
     to hold on its loader, touching no auth state, until the exchange settles. */
  it('holds on the loader, reading nothing, until authReady settles', async () => {
    let settle
    auth.ready = new Promise((resolve) => {
      settle = resolve
    })

    render(<App />)
    await new Promise((r) => setTimeout(r, 30)) // give any premature read its chance

    expect(auth.getSession).not.toHaveBeenCalled()
    expect(auth.onAuthStateChange).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toBeDefined() // the loader
    expect(document.querySelector('input[type="password"]')).toBeNull()

    settle()

    await waitFor(() => expect(auth.getSession).toHaveBeenCalled())
    await waitFor(() => expect(auth.onAuthStateChange).toHaveBeenCalled())
  })
})

describe('signed out', () => {
  it('shows the landing page at the root', async () => {
    render(<App />)
    expect((await screen.findAllByText(/Compassed/i, {}, { timeout: 3000 })).length).toBeGreaterThan(0)
  })

  it('shows the auth form at /signin', async () => {
    window.history.replaceState(null, '', '/signin')
    render(<App />)
    // AuthScreen renders a password field; the landing page does not.
    const inputs = await vi.waitFor(
      () => {
        const found = document.querySelectorAll('input[type="password"]')
        if (found.length === 0) throw new Error('not yet')
        return found
      },
      { timeout: 3000 },
    )
    expect(inputs.length).toBeGreaterThan(0)
  })

  /* A signed-out visitor on a private deep link must keep that URL, so they
     land back on it after signing in. The landing page shows, the address bar
     does not change. */
  it('keeps a deep link in the address bar while signed out', async () => {
    window.history.replaceState(null, '', '/goal/abc-123')
    render(<App />)
    await screen.findAllByText(/Compassed/i, {}, { timeout: 3000 })
    expect(window.location.pathname).toBe('/goal/abc-123')
  })

  it('does not rewrite an unknown path', async () => {
    window.history.replaceState(null, '', '/total-nonsense')
    render(<App />)
    await screen.findAllByText(/Compassed/i, {}, { timeout: 3000 })
    expect(window.location.pathname).toBe('/total-nonsense')
  })
})
