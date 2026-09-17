/* The routing contract. parsePath and viewToPath are the whole of it — the hook
   around them is just History API plumbing — so they carry the tests. */

import { describe, expect, it } from 'vitest'
import { parsePath, viewToPath } from './useRoutedView.js'

describe('parsePath', () => {
  it('maps the root to the dashboard', () => {
    expect(parsePath('/')).toEqual({ name: 'dashboard' })
    expect(parsePath('')).toEqual({ name: 'dashboard' })
  })

  it('maps each top-level view', () => {
    expect(parsePath('/activity')).toEqual({ name: 'activity' })
    expect(parsePath('/savings')).toEqual({ name: 'savings' })
    expect(parsePath('/archive')).toEqual({ name: 'archive' })
    expect(parsePath('/settings')).toEqual({ name: 'settings' })
  })

  it('maps the pre-auth routes', () => {
    expect(parsePath('/signin')).toEqual({ name: 'signin' })
    expect(parsePath('/signup')).toEqual({ name: 'signup' })
  })

  it('pulls the id out of a goal or pot path', () => {
    expect(parsePath('/goal/abc-123')).toEqual({ name: 'goal', goalId: 'abc-123' })
    expect(parsePath('/pot/xyz-789')).toEqual({ name: 'pot', potId: 'xyz-789' })
  })

  it('tolerates a trailing slash', () => {
    expect(parsePath('/activity/')).toEqual({ name: 'activity' })
    expect(parsePath('/goal/abc/')).toEqual({ name: 'goal', goalId: 'abc' })
  })

  it('decodes a percent-encoded id', () => {
    expect(parsePath('/goal/a%20b')).toEqual({ name: 'goal', goalId: 'a b' })
  })

  it('survives a malformed escape rather than throwing', () => {
    expect(() => parsePath('/goal/%E0%A4%A')).not.toThrow()
    expect(parsePath('/goal/%E0%A4%A').name).toBe('goal')
  })

  /* Unknown paths must not silently redirect home — that hides typos and reads
     as a bug. They get their own view with the sidebar still rendered. */
  it('reports anything unrecognised as notfound', () => {
    expect(parsePath('/nonsense')).toEqual({ name: 'notfound' })
    expect(parsePath('/goal')).toEqual({ name: 'notfound' }) // no id
    expect(parsePath('/goal/a/b')).toEqual({ name: 'notfound' }) // too deep
    expect(parsePath('/activity/extra')).toEqual({ name: 'notfound' })
    expect(parsePath('/dashboard')).toEqual({ name: 'notfound' }) // the root is '/'
  })

  it('handles missing input without throwing', () => {
    expect(parsePath(undefined)).toEqual({ name: 'dashboard' })
    expect(parsePath(null)).toEqual({ name: 'dashboard' })
  })
})

describe('viewToPath', () => {
  it('maps each view back to its path', () => {
    expect(viewToPath({ name: 'dashboard' })).toBe('/')
    expect(viewToPath({ name: 'activity' })).toBe('/activity')
    expect(viewToPath({ name: 'savings' })).toBe('/savings')
    expect(viewToPath({ name: 'archive' })).toBe('/archive')
    expect(viewToPath({ name: 'settings' })).toBe('/settings')
    expect(viewToPath({ name: 'signin' })).toBe('/signin')
    expect(viewToPath({ name: 'signup' })).toBe('/signup')
    expect(viewToPath({ name: 'goal', goalId: 'abc' })).toBe('/goal/abc')
    expect(viewToPath({ name: 'pot', potId: 'xyz' })).toBe('/pot/xyz')
  })

  it('escapes an id with url-unsafe characters', () => {
    expect(viewToPath({ name: 'goal', goalId: 'a b' })).toBe('/goal/a%20b')
  })

  it('falls back to the root for an id-less goal or pot', () => {
    expect(viewToPath({ name: 'goal' })).toBe('/')
    expect(viewToPath({ name: 'pot' })).toBe('/')
  })

  it('falls back to the root for anything unknown', () => {
    expect(viewToPath({ name: 'bogus' })).toBe('/')
    expect(viewToPath(undefined)).toBe('/')
    expect(viewToPath(null)).toBe('/')
  })
})

describe('parsePath / viewToPath round trip', () => {
  /* Every view the app can be in must survive a round trip through the URL,
     which is what makes a link shareable and a refresh lossless. */
  const views = [
    { name: 'dashboard' },
    { name: 'activity' },
    { name: 'savings' },
    { name: 'archive' },
    { name: 'settings' },
    { name: 'signin' },
    { name: 'signup' },
    { name: 'goal', goalId: '7f3c1b9e-2a44-4d1e-9c8a-1b2c3d4e5f60' },
    { name: 'pot', potId: '0a1b2c3d-4e5f-6071-8293-a4b5c6d7e8f9' },
  ]

  it.each(views)('round-trips $name', (view) => {
    expect(parsePath(viewToPath(view))).toEqual(view)
  })

  it('round-trips an id needing escaping', () => {
    const view = { name: 'goal', goalId: 'a b/c' }
    expect(parsePath(viewToPath(view))).toEqual(view)
  })
})
