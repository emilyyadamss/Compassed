/* The scoring engine. These tests go through the real goalStats pipeline rather
   than stubbing it, because the signals are defined in terms of stats fields
   (quietFor, rolling, age, periodLength) and stubbing those would let the two
   drift apart silently.

   The three private signals are exercised through scoreGoals by pinning the
   weight to one end or the other: recencyWeight 100 makes score === recency,
   and a goal with no target makes deficit exactly 0. */

import { describe, expect, it } from 'vitest'
import { pickNudge, scoreGoals, suggestedAction, healthyCount, revisitDue } from './nudge.js'
import { indexEntries, goalStats } from './stats.js'
import { DEFAULT_SETTINGS } from './model.js'

const TODAY = '2025-06-15'

const settings = (over = {}) => ({ ...DEFAULT_SETTINGS, ...over })

/** A goal with sane defaults; `createdAt` drives `age`, which drives both the
    deficit maturity fade and quietFor for never-logged goals. */
const goal = (over = {}) => ({
  id: 'g1',
  name: 'Guitar',
  cadence: 'week',
  target: 7,
  unitId: 'hours',
  status: 'active',
  createdAt: '2025-01-01T09:00:00.000Z',
  ...over,
})

/** entries → the byGoal index scoreGoals expects. */
const index = (entries) => indexEntries(entries)
const entry = (goalId, date, amount) => ({ id: `${goalId}-${date}`, goalId, date, amount })

/** Score a single goal and hand back its ranked row. */
function scoreOne(g, entries, s = settings()) {
  const [row] = scoreGoals([g], index(entries), s, TODAY)
  return row
}

describe('deficit signal — maturity fade', () => {
  /* A goal created this morning has had no real chance at a weekly target, so
     it must not read as 100% behind on day one. Documented behaviour and the
     easiest thing to regress by "simplifying" the maturity term away. */
  it('fades in over the first window instead of starting at full strength', () => {
    const row = scoreOne(goal({ createdAt: `${TODAY}T09:00:00.000Z` }), [])
    // raw deficit is 1 (nothing logged), scaled by maturity (0 + 1) / 7
    expect(row.deficit).toBeCloseTo(1 / 7, 5)
    expect(row.deficit).not.toBeCloseTo(1, 2)
  })

  it('reaches full strength once a whole window has elapsed', () => {
    const row = scoreOne(goal({ createdAt: '2025-06-08T09:00:00.000Z' }), [])
    expect(row.deficit).toBeCloseTo(1, 5)
  })

  it('is zero when the goal is at or over target', () => {
    const entries = [entry('g1', TODAY, 7)]
    expect(scoreOne(goal(), entries).deficit).toBe(0)
    expect(scoreOne(goal(), [entry('g1', TODAY, 99)], settings()).deficit).toBe(0)
  })

  it('is exactly zero for a goal with no target, however stale', () => {
    // No target → recency alone decides, so deficit must not manufacture urgency.
    const row = scoreOne(goal({ target: 0 }), [])
    expect(row.deficit).toBe(0)
  })

  it('scales linearly with how far under target you are', () => {
    // half the weekly target logged today → half the deficit
    const row = scoreOne(goal(), [entry('g1', TODAY, 3.5)])
    expect(row.deficit).toBeCloseTo(0.5, 5)
  })
})

describe('recency signal', () => {
  const pureRecency = settings({ recencyWeight: 100, staleAfterDays: 4 })

  it('is zero the day it was logged', () => {
    const row = scoreOne(goal(), [entry('g1', TODAY, 1)], pureRecency)
    expect(row.recency).toBe(0)
    expect(row.score).toBe(0)
  })

  it('sits at 1 - 1/e exactly at the stale threshold', () => {
    const row = scoreOne(goal(), [entry('g1', '2025-06-11', 1)], pureRecency) // 4 days
    expect(row.recency).toBeCloseTo(1 - Math.exp(-1), 5) // ≈ 0.632
  })

  it('saturates rather than running away at 3x the threshold', () => {
    const row = scoreOne(goal(), [entry('g1', '2025-06-03', 1)], pureRecency) // 12 days
    expect(row.recency).toBeCloseTo(1 - Math.exp(-3), 5) // ≈ 0.950
    expect(row.recency).toBeLessThan(1)
  })

  it('stays finite when staleAfterDays is zero', () => {
    // Math.max(1, staleAfter) guards the division; without it this is NaN.
    const row = scoreOne(goal(), [entry('g1', '2025-06-01', 1)], settings({ staleAfterDays: 0 }))
    expect(Number.isFinite(row.score)).toBe(true)
    expect(row.recency).toBeGreaterThan(0)
  })

  it('counts from creation for a goal that has never been logged', () => {
    // quietFor falls back to age, so a goal added today starts at zero rather
    // than reading as infinitely neglected.
    const row = scoreOne(goal({ createdAt: `${TODAY}T09:00:00.000Z` }), [], pureRecency)
    expect(row.recency).toBe(0)
  })
})

describe('score blending', () => {
  it('is pure deficit at recencyWeight 0', () => {
    const s = settings({ recencyWeight: 0 })
    const row = scoreOne(goal(), [], s) // old goal, nothing logged → deficit 1
    expect(row.score).toBeCloseTo(row.deficit, 10)
    expect(row.score).toBeCloseTo(1, 5)
  })

  it('is exactly zero at recencyWeight 0 for an untargeted goal, however stale', () => {
    const s = settings({ recencyWeight: 0 })
    const row = scoreOne(goal({ target: 0, createdAt: '2020-01-01T09:00:00.000Z' }), [], s)
    expect(row.score).toBe(0)
  })

  it('is pure recency at recencyWeight 100', () => {
    const s = settings({ recencyWeight: 100 })
    const row = scoreOne(goal(), [], s)
    expect(row.score).toBeCloseTo(row.recency, 10)
  })

  it('blends both halves at 50', () => {
    const s = settings({ recencyWeight: 50 })
    const row = scoreOne(goal(), [], s)
    expect(row.score).toBeCloseTo(0.5 * row.recency + 0.5 * row.deficit, 10)
  })

  it('clamps an out-of-range weight instead of extrapolating', () => {
    const high = scoreOne(goal(), [], settings({ recencyWeight: 999 }))
    expect(high.score).toBeCloseTo(high.recency, 10)
    const low = scoreOne(goal(), [], settings({ recencyWeight: -50 }))
    expect(low.score).toBeCloseTo(low.deficit, 10)
  })
})

describe('revisit signal', () => {
  const revisitGoal = (over = {}) =>
    goal({ status: 'revisit', revisitEvery: 30, createdAt: '2020-01-01T09:00:00.000Z', ...over })

  /* The cliff at the interval is the feature: a revisit goal one day early must
     be completely unnudgeable, not merely low-scoring. */
  it('scores exactly zero the day before it is due', () => {
    const row = scoreOne(revisitGoal(), [entry('g1', '2025-05-17', 1)]) // 29 days
    expect(row.stats.quietFor).toBe(29)
    expect(row.score).toBe(0)
  })

  it('enters at 0.3 the day it comes due', () => {
    const row = scoreOne(revisitGoal(), [entry('g1', '2025-05-16', 1)]) // 30 days
    expect(row.stats.quietFor).toBe(30)
    expect(row.score).toBeCloseTo(0.3, 10)
  })

  it('climbs above the entry point once overdue', () => {
    const row = scoreOne(revisitGoal(), [entry('g1', '2025-04-16', 1)]) // 60 days
    expect(row.stats.quietFor).toBe(60)
    expect(row.score).toBeCloseTo(0.3 + 0.7 * (1 - Math.exp(-1)), 5) // ≈ 0.742
  })

  it('reports revisit mode and zero deficit regardless of target', () => {
    const row = scoreOne(revisitGoal(), [entry('g1', '2025-04-16', 1)])
    expect(row.mode).toBe('revisit')
    expect(row.deficit).toBe(0)
    expect(row.revisit.every).toBe(30)
    expect(row.revisit.due).toBe(true)
  })

  it('ignores the recency weight entirely', () => {
    const entries = [entry('g1', '2025-04-16', 1)]
    const a = scoreOne(revisitGoal(), entries, settings({ recencyWeight: 0 }))
    const b = scoreOne(revisitGoal(), entries, settings({ recencyWeight: 100 }))
    expect(a.score).toBeCloseTo(b.score, 10)
  })
})

describe('scoreGoals', () => {
  it('excludes archived goals and keeps active and revisit ones', () => {
    const goals = [
      goal({ id: 'a', status: 'active' }),
      goal({ id: 'b', status: 'revisit' }),
      goal({ id: 'c', status: 'done' }),
    ]
    const ranked = scoreGoals(goals, index([]), settings(), TODAY)
    expect(ranked.map((r) => r.goal.id).sort()).toEqual(['a', 'b'])
  })

  it('returns an empty list for no goals', () => {
    expect(scoreGoals([], index([]), settings(), TODAY)).toEqual([])
  })

  it('sorts by score descending', () => {
    const goals = [
      goal({ id: 'fresh' }), // logged today → low score
      goal({ id: 'stale' }), // never logged → high score
    ]
    const entries = [entry('fresh', TODAY, 7)]
    const ranked = scoreGoals(goals, index(entries), settings(), TODAY)
    expect(ranked[0].goal.id).toBe('stale')
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score)
  })

  it('breaks a score tie with the longer silence', () => {
    // Untargeted goals at recencyWeight 0 both score exactly 0, so only the
    // tiebreak can order them.
    const goals = [
      goal({ id: 'recent', target: 0 }),
      goal({ id: 'ancient', target: 0 }),
    ]
    const entries = [entry('recent', '2025-06-14', 1), entry('ancient', '2025-01-02', 1)]
    const ranked = scoreGoals(goals, index(entries), settings({ recencyWeight: 0 }), TODAY)
    expect(ranked.map((r) => r.score)).toEqual([0, 0])
    expect(ranked[0].goal.id).toBe('ancient')
  })
})

describe('pickNudge', () => {
  it('returns null for an empty list', () => {
    expect(pickNudge([])).toBeNull()
  })

  it('returns the top goal once it crosses the threshold', () => {
    const ranked = scoreGoals([goal()], index([]), settings(), TODAY)
    expect(ranked[0].score).toBeGreaterThanOrEqual(0.2)
    expect(pickNudge(ranked)).toBe(ranked[0])
  })

  it('surfaces an unstarted goal even when it is not ranked first', () => {
    const goals = [
      // on target, logged yesterday → scores low but above the unstarted goal
      goal({ id: 'ontrack' }),
      // created today, never logged → very low score, but never started
      goal({ id: 'unstarted', createdAt: `${TODAY}T09:00:00.000Z` }),
    ]
    const entries = [entry('ontrack', '2025-06-14', 7)]
    const ranked = scoreGoals(goals, index(entries), settings(), TODAY)

    expect(ranked[0].score).toBeLessThan(0.2) // nothing is actually slipping
    expect(ranked[0].goal.id).not.toBe('unstarted') // and it isn't first

    const pick = pickNudge(ranked)
    expect(pick.goal.id).toBe('unstarted')
    expect(pick.fresh).toBe(true)
  })

  it('returns null when everything is on track and started', () => {
    const goals = [goal({ id: 'a' }), goal({ id: 'b' })]
    const entries = [entry('a', TODAY, 7), entry('b', TODAY, 7)]
    const ranked = scoreGoals(goals, index(entries), settings(), TODAY)
    expect(pickNudge(ranked)).toBeNull()
  })

  /* The subtlest branch in the file: a revisit goal that has never been logged
     has daysSince == null, but it must not be adopted as the "fresh" pick —
     one that isn't due yet has earned its quiet. */
  it('never treats an unstarted revisit goal as the fresh pick', () => {
    const goals = [
      goal({ id: 'ontrack' }),
      goal({
        id: 'revisit-unstarted',
        status: 'revisit',
        revisitEvery: 30,
        createdAt: `${TODAY}T09:00:00.000Z`,
      }),
    ]
    const entries = [entry('ontrack', TODAY, 7)]
    const ranked = scoreGoals(goals, index(entries), settings(), TODAY)

    const unstarted = ranked.find((r) => r.goal.id === 'revisit-unstarted')
    expect(unstarted.stats.daysSince).toBeNull() // it would qualify but for the guard
    expect(unstarted.score).toBe(0)
    expect(pickNudge(ranked)).toBeNull()
  })
})

describe('suggestedAction', () => {
  const statsFor = (g, entries) => goalStats(g, index(entries).get(g.id), settings(), TODAY)

  it('asks for a session when there is no target', () => {
    const g = goal({ target: 0 })
    expect(suggestedAction(g, statsFor(g, []))).toBe('Log a session of Guitar')
  })

  it('asks only to keep ticking over once the target is met', () => {
    const g = goal()
    const s = statsFor(g, [entry('g1', TODAY, 10)])
    expect(suggestedAction(g, s)).toBe('Keep Guitar ticking over')
  })

  it('asks for a bite-sized slice rather than the whole gap', () => {
    const g = goal({ target: 20 })
    const s = statsFor(g, []) // nothing logged, gap is the full 20
    // a quarter of the target, not all of it
    expect(suggestedAction(g, s)).toContain('5')
    expect(suggestedAction(g, s)).not.toContain('20')
  })

  it('keeps the ask tiny for a revisit goal', () => {
    const g = goal({ status: 'revisit' })
    const s = statsFor(g, [])
    expect(suggestedAction(g, s, 'revisit')).toBe(
      '0.5 hours is enough to keep Guitar from fading',
    )
  })

  /* Documents a rough edge rather than asserting it is right: the ask is
     floored at the unit's step, so a `pages` goal one page short is still
     asked for five. The comment in the source calls this "a nudge, not a
     guilt trip" — if that floor is ever revisited, this test should change
     with it deliberately. */
  it('floors the ask at one unit step, even when the gap is smaller', () => {
    const g = goal({ unitId: 'pages', target: 100 })
    const s = statsFor(g, [entry('g1', TODAY, 99)]) // gap of exactly 1 page
    expect(suggestedAction(g, s)).toBe('5 pages today gets you moving again')
  })
})

describe('healthyCount / revisitDue', () => {
  it('counts the goals sitting below the slipping threshold', () => {
    const goals = [goal({ id: 'a' }), goal({ id: 'b' })]
    const entries = [entry('a', TODAY, 7)] // a is fine, b has never been logged
    const ranked = scoreGoals(goals, index(entries), settings(), TODAY)
    expect(healthyCount(ranked)).toBe(1)
  })

  it('lists only revisit goals whose interval has come round', () => {
    const goals = [
      goal({ id: 'due', status: 'revisit', revisitEvery: 30 }),
      goal({ id: 'fresh', status: 'revisit', revisitEvery: 30 }),
      goal({ id: 'active' }),
    ]
    const entries = [entry('due', '2025-04-16', 1), entry('fresh', '2025-06-14', 1)]
    const ranked = scoreGoals(goals, index(entries), settings(), TODAY)
    expect(revisitDue(ranked).map((r) => r.goal.id)).toEqual(['due'])
  })
})
