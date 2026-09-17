/**
 * @vitest-environment jsdom
 *
 * The History API half of the router. These cover the behaviours that are easy
 * to get subtly wrong and impossible to notice until something has gone badly
 * wrong in production — above all that mounting writes nothing to history.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useRoutedView } from './useRoutedView.js'

/** Move the URL *without* the spies counting it — this is test setup standing
    in for the browser's own address bar, not the hook navigating. */
function go(path) {
  window.history.replaceState(null, '', path)
  pushSpy?.mockClear()
  replaceSpy?.mockClear()
}

let pushSpy, replaceSpy

beforeEach(() => {
  // jsdom does not implement history.scrollRestoration; the hook feature-detects
  // it, so define it here to exercise that path rather than skip it.
  if (!('scrollRestoration' in window.history)) {
    Object.defineProperty(window.history, 'scrollRestoration', {
      value: 'auto',
      writable: true,
      configurable: true,
    })
  }
  pushSpy = vi.spyOn(window.history, 'pushState')
  replaceSpy = vi.spyOn(window.history, 'replaceState')
  go('/')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('mounting', () => {
  it('reads the current path', () => {
    go('/activity')
    const { result } = renderHook(() => useRoutedView())
    expect(result.current[0]).toEqual({ name: 'activity' })
  })

  it('reads a goal id from a deep link', () => {
    go('/goal/abc-123')
    const { result } = renderHook(() => useRoutedView())
    expect(result.current[0]).toEqual({ name: 'goal', goalId: 'abc-123' })
  })

  /* THE constraint: a URL the user arrived on is left as it is until they
     navigate. That is what lets a signed-out deep link survive sign-in. */
  it('writes nothing to history on mount', () => {
    go('/goal/abc-123')
    renderHook(() => useRoutedView())
    expect(pushSpy).not.toHaveBeenCalled()
    expect(replaceSpy).not.toHaveBeenCalled()
  })

  it('writes nothing on mount even for an unknown path', () => {
    go('/total-nonsense')
    const { result } = renderHook(() => useRoutedView())
    expect(result.current[0]).toEqual({ name: 'notfound' })
    // Notably it does NOT normalise the URL back to '/'.
    expect(window.location.pathname).toBe('/total-nonsense')
    expect(replaceSpy).not.toHaveBeenCalled()
  })
})

describe('navigate', () => {
  it('pushes a new entry and updates the view', () => {
    const { result } = renderHook(() => useRoutedView())
    act(() => result.current[1]({ name: 'settings' }))
    expect(window.location.pathname).toBe('/settings')
    expect(result.current[0]).toEqual({ name: 'settings' })
    expect(pushSpy).toHaveBeenCalledTimes(1)
  })

  it('builds a goal path from the id', () => {
    const { result } = renderHook(() => useRoutedView())
    act(() => result.current[1]({ name: 'goal', goalId: 'xyz' }))
    expect(window.location.pathname).toBe('/goal/xyz')
  })

  /* Deleting a goal then pressing Back must not return to the goal that was
     just deleted — that renders the "gone" panel and reads as a crash. */
  it('replaces instead of pushing when asked', () => {
    const { result } = renderHook(() => useRoutedView())
    act(() => result.current[1]({ name: 'dashboard' }, { replace: true }))
    expect(pushSpy).not.toHaveBeenCalled()
    expect(replaceSpy).toHaveBeenCalledTimes(1)
    expect(window.location.pathname).toBe('/')
  })

  it('stores extra state alongside the entry', () => {
    const { result } = renderHook(() => useRoutedView())
    act(() => result.current[1]({ name: 'signin' }, { state: { from: '/goal/abc' } }))
    expect(window.history.state.from).toBe('/goal/abc')
  })
})

describe('back and forward', () => {
  it('follows popstate to the new path', () => {
    go('/settings')
    const { result } = renderHook(() => useRoutedView())
    expect(result.current[0]).toEqual({ name: 'settings' })

    // Simulate the browser moving the URL and firing popstate, which is what
    // Back does.
    act(() => {
      window.history.replaceState({ k: 0 }, '', '/activity')
      window.dispatchEvent(new PopStateEvent('popstate', { state: { k: 0 } }))
    })
    expect(result.current[0]).toEqual({ name: 'activity' })
  })

  it('stops listening once unmounted', () => {
    const { result, unmount } = renderHook(() => useRoutedView())
    const before = result.current[0]
    unmount()
    act(() => {
      window.history.replaceState({ k: 0 }, '', '/archive')
      window.dispatchEvent(new PopStateEvent('popstate', { state: { k: 0 } }))
    })
    expect(result.current[0]).toEqual(before) // no update after teardown
  })
})

describe('scroll restoration', () => {
  it('takes manual control so Back can restore position itself', () => {
    renderHook(() => useRoutedView())
    expect(window.history.scrollRestoration).toBe('manual')
  })
})
