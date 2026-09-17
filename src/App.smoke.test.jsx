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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('./lib/supabaseClient.js', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
  isRecoveryRedirect: false,
}))

const { default: App } = await import('./App.jsx')

beforeEach(() => {
  window.history.replaceState(null, '', '/')
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
