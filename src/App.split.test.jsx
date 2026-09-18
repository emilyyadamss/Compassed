/**
 * @vitest-environment jsdom
 *
 * Guards the code splitting, which is invisible when it breaks. The mobile nav
 * is the only part of the signed-in app that animates, so it carries the
 * animation library with it. Mounting it on a desktop would pull that library
 * back into every desktop visit and nothing on screen would look wrong.
 *
 * These tests assert the mount, not the download: if the nav is mounted only at
 * mobile widths, the bundler's own splitting takes care of the rest.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
}))

vi.mock('./lib/supabaseClient.js', () => ({
  supabase: { auth: { getSession: auth.getSession, onAuthStateChange: auth.onAuthStateChange } },
  isRecoveryRedirect: false,
  authReady: Promise.resolve(),
}))

// Signed in with nothing saved: enough to render the app shell, which is all
// these tests look at.
vi.mock('./lib/db.js', () => ({
  fetchState: vi.fn().mockResolvedValue({
    goals: [], entries: [], tasks: [], pots: [], deposits: [], settings: {},
  }),
  putGoal: vi.fn(), removeGoal: vi.fn(), putEntry: vi.fn(), removeEntry: vi.fn(),
  putTask: vi.fn(), removeTask: vi.fn(), putPot: vi.fn(), removePot: vi.fn(),
  putDeposit: vi.fn(), removeDeposit: vi.fn(), putSettings: vi.fn(),
  replaceData: vi.fn(), replaceAll: vi.fn(),
}))

const { fetchState } = await import('./lib/db.js')
const { default: App } = await import('./App.jsx')

/** jsdom has no matchMedia; this is the window width the app gets to see. */
function widthMatches(matches) {
  window.matchMedia = vi.fn(() => ({
    matches,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

const findMenuButton = () => screen.queryByRole('button', { name: /open menu/i })

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  auth.getSession.mockReset().mockResolvedValue({
    data: { session: { user: { id: 'u1', email: 'someone@example.com' } } },
  })
  auth.onAuthStateChange
    .mockReset()
    .mockReturnValue({ data: { subscription: { unsubscribe() {} } } })
  // Re-armed per test: the afterEach restore below clears it otherwise, and a
  // fetchState returning undefined blows up in an effect rather than a test.
  fetchState.mockReset().mockResolvedValue({
    goals: [], entries: [], tasks: [], pots: [], deposits: [], settings: {},
  })
})

afterEach(() => {
  cleanup()
  delete window.matchMedia
  vi.restoreAllMocks()
})

describe('the mobile nav', () => {
  it('is mounted at a mobile width', async () => {
    widthMatches(true)
    render(<App />)

    await waitFor(() => expect(findMenuButton()).not.toBeNull(), { timeout: 3000 })
  })

  /* The one that matters. The sidebar already covers desktop, so the nav is
     pure weight there. */
  it('is not mounted at a desktop width', async () => {
    widthMatches(false)
    render(<App />)

    // Wait for the sidebar, so this is not passing merely because nothing has
    // rendered yet.
    await screen.findByRole('complementary', {}, { timeout: 3000 })

    expect(findMenuButton()).toBeNull()
  })
})

describe('a view that is no longer in the first download', () => {
  /* Deep-linking straight to one is the case that would break first: the view
     has to arrive, and its Suspense fallback has to give way to it. */
  it('loads and renders when the URL asks for it directly', async () => {
    widthMatches(false)
    window.history.replaceState(null, '', '/activity')
    render(<App />)

    expect(await screen.findByRole('heading', { name: /activity/i }, { timeout: 3000 }))
      .not.toBeNull()
  })

  it('loads when navigated to from the sidebar', async () => {
    widthMatches(false)
    render(<App />)

    const link = await screen.findByRole('link', { name: /settings/i }, { timeout: 3000 })
    link.click()

    expect(await screen.findByRole('heading', { name: /settings/i }, { timeout: 3000 }))
      .not.toBeNull()
  })
})
