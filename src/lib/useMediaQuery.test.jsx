/**
 * @vitest-environment jsdom
 *
 * The hook that decides whether the mobile nav is mounted at all. It exists for
 * weight, not for looks — the nav is the only thing pulling in the animation
 * library, so a hook that wrongly answers `true` on a desktop quietly undoes
 * the code splitting without breaking anything visible.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import useMediaQuery from './useMediaQuery.js'

/** Installs a matchMedia jsdom does not provide, and hands back a way to flip
    the answer the way a real browser does when the window is resized. */
function stubMatchMedia(initial) {
  const listeners = new Set()
  let matches = initial
  window.matchMedia = vi.fn(() => ({
    get matches() {
      return matches
    },
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
  }))
  return {
    resizeTo(next) {
      matches = next
      act(() => listeners.forEach((fn) => fn({ matches: next })))
    },
    get listenerCount() {
      return listeners.size
    },
  }
}

afterEach(() => {
  cleanup()
  delete window.matchMedia
  vi.restoreAllMocks()
})

describe('useMediaQuery', () => {
  it('reports a match that is already true on the first render', () => {
    stubMatchMedia(true)
    const { result } = renderHook(() => useMediaQuery('(max-width: 900px)'))
    expect(result.current).toBe(true)
  })

  it('reports no match on a window that is already wide', () => {
    stubMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(max-width: 900px)'))
    expect(result.current).toBe(false)
  })

  it('follows the window across the breakpoint, both ways', () => {
    const screen = stubMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(max-width: 900px)'))

    screen.resizeTo(true)
    expect(result.current).toBe(true)

    screen.resizeTo(false)
    expect(result.current).toBe(false)
  })

  it('stops listening once unmounted', () => {
    const screen = stubMatchMedia(true)
    const { unmount } = renderHook(() => useMediaQuery('(max-width: 900px)'))
    expect(screen.listenerCount).toBe(1)

    unmount()
    expect(screen.listenerCount).toBe(0)
  })

  /* Some environments have no matchMedia at all. Answering false there keeps
     the nav unmounted, which is the harmless way to be wrong: the sidebar
     already lists every page it offers. */
  it('answers false where matchMedia does not exist', () => {
    delete window.matchMedia
    const { result } = renderHook(() => useMediaQuery('(max-width: 900px)'))
    expect(result.current).toBe(false)
  })
})
