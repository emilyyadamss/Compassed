/* Derived numbers. The streak helpers are the classic off-by-one territory
   here, and rollingTotal/periodTotals feed the nudge engine directly. */

import { describe, expect, it } from 'vitest'
import {
  balanceScore,
  cumulativeSeries,
  currentStreak,
  goalStats,
  indexEntries,
  lastLoggedDate,
  longestStreak,
  nextTask,
  periodTotals,
  rollingTotal,
  taskSummary,
} from './stats.js'
import { DEFAULT_SETTINGS } from './model.js'

const TODAY = '2025-06-15' // a Sunday
const settings = (over = {}) => ({ ...DEFAULT_SETTINGS, ...over })
const entry = (goalId, date, amount) => ({ id: `${goalId}-${date}`, goalId, date, amount })
const days = (pairs) => new Map(pairs)

describe('indexEntries', () => {
  it('buckets entries by goal and sums same-day amounts', () => {
    const byGoal = indexEntries([
      entry('a', '2025-06-01', 2),
      entry('a', '2025-06-01', 3), // same day → summed
      entry('a', '2025-06-02', 1),
      entry('b', '2025-06-01', 9),
    ])
    expect(byGoal.get('a').get('2025-06-01')).toBe(5)
    expect(byGoal.get('a').get('2025-06-02')).toBe(1)
    expect(byGoal.get('b').get('2025-06-01')).toBe(9)
  })

  it('returns an empty index for no entries', () => {
    expect(indexEntries([]).size).toBe(0)
  })
})

describe('rollingTotal', () => {
  it('counts a window inclusive of the from-day', () => {
    const d = days([
      ['2025-06-15', 1],
      ['2025-06-14', 2],
      ['2025-06-13', 4],
    ])
    expect(rollingTotal(d, 1, TODAY)).toBe(1) // today only
    expect(rollingTotal(d, 2, TODAY)).toBe(3)
    expect(rollingTotal(d, 3, TODAY)).toBe(7)
  })

  it('excludes anything older than the window', () => {
    const d = days([['2025-06-01', 100]])
    expect(rollingTotal(d, 7, TODAY)).toBe(0)
  })

  it('is zero for missing data', () => {
    expect(rollingTotal(null, 7, TODAY)).toBe(0)
    expect(rollingTotal(days([]), 7, TODAY)).toBe(0)
  })
})

describe('currentStreak', () => {
  it('counts back from today', () => {
    const d = days([
      ['2025-06-15', 1],
      ['2025-06-14', 1],
      ['2025-06-13', 1],
    ])
    expect(currentStreak(d, TODAY)).toBe(3)
  })

  /* A streak shouldn't die just because today isn't over yet — yesterday
     still counts as alive. */
  it('survives a not-yet-logged today', () => {
    const d = days([
      ['2025-06-14', 1],
      ['2025-06-13', 1],
    ])
    expect(currentStreak(d, TODAY)).toBe(2)
  })

  it('is zero once two days have been missed', () => {
    const d = days([['2025-06-13', 1]])
    expect(currentStreak(d, TODAY)).toBe(0)
  })

  it('stops at the first gap', () => {
    const d = days([
      ['2025-06-15', 1],
      ['2025-06-14', 1],
      // 13th missing
      ['2025-06-12', 1],
    ])
    expect(currentStreak(d, TODAY)).toBe(2)
  })

  it('is zero for no data', () => {
    expect(currentStreak(null, TODAY)).toBe(0)
    expect(currentStreak(days([]), TODAY)).toBe(0)
  })
})

describe('longestStreak', () => {
  it('finds the best run anywhere in the history', () => {
    const d = days([
      ['2025-06-01', 1],
      ['2025-06-02', 1],
      ['2025-06-03', 1], // run of 3
      ['2025-06-10', 1],
      ['2025-06-11', 1], // run of 2
    ])
    expect(longestStreak(d)).toBe(3)
  })

  it('is 1 for a single logged day', () => {
    expect(longestStreak(days([['2025-06-01', 1]]))).toBe(1)
  })

  it('is 0 for no data', () => {
    expect(longestStreak(null)).toBe(0)
    expect(longestStreak(days([]))).toBe(0)
  })

  it('does not depend on insertion order', () => {
    const d = days([
      ['2025-06-03', 1],
      ['2025-06-01', 1],
      ['2025-06-02', 1],
    ])
    expect(longestStreak(d)).toBe(3)
  })
})

describe('lastLoggedDate', () => {
  it('returns the latest key regardless of insertion order', () => {
    const d = days([
      ['2025-06-01', 1],
      ['2025-06-09', 1],
      ['2025-06-03', 1],
    ])
    expect(lastLoggedDate(d)).toBe('2025-06-09')
  })

  it('is null for no data', () => {
    expect(lastLoggedDate(null)).toBeNull()
    expect(lastLoggedDate(days([]))).toBeNull()
  })
})

describe('periodTotals', () => {
  it('buckets days into weeks and keeps empty periods', () => {
    const d = days([
      ['2025-06-02', 1], // week of Jun 2
      ['2025-06-03', 2], // week of Jun 2
      ['2025-06-16', 5], // week of Jun 16
    ])
    const got = periodTotals(d, '2025-06-02', '2025-06-16', 'week', 1)
    expect(got).toEqual([
      { start: '2025-06-02', total: 3 },
      { start: '2025-06-09', total: 0 }, // untouched week still appears
      { start: '2025-06-16', total: 5 },
    ])
  })

  it('ignores entries outside the range', () => {
    const d = days([
      ['2025-01-01', 99],
      ['2025-06-02', 1],
    ])
    const got = periodTotals(d, '2025-06-02', '2025-06-08', 'week', 1)
    expect(got).toEqual([{ start: '2025-06-02', total: 1 }])
  })
})

describe('cumulativeSeries', () => {
  it('accumulates across every day in the range', () => {
    const d = days([
      ['2025-06-01', 2],
      ['2025-06-03', 3],
    ])
    expect(cumulativeSeries(d, '2025-06-01', '2025-06-04')).toEqual([
      { date: '2025-06-01', value: 2 },
      { date: '2025-06-02', value: 2 }, // flat on an empty day
      { date: '2025-06-03', value: 5 },
      { date: '2025-06-04', value: 5 },
    ])
  })
})

describe('goalStats', () => {
  const goal = (over = {}) => ({
    id: 'g1',
    cadence: 'week',
    target: 7,
    createdAt: '2025-01-01T09:00:00.000Z',
    ...over,
  })
  const statsFor = (g, entries, s = settings()) =>
    goalStats(g, indexEntries(entries).get(g.id), s, TODAY)

  it('reports nulls and zeroes for a goal with no entries', () => {
    const s = statsFor(goal(), [])
    expect(s.lastLogged).toBeNull()
    expect(s.daysSince).toBeNull()
    expect(s.total).toBe(0)
    expect(s.streak).toBe(0)
  })

  /* quietFor is what the nudge engine actually scores on: days since the last
     entry, or the goal's age when it has never been logged. */
  it('falls back to age for quietFor when never logged', () => {
    const s = statsFor(goal({ createdAt: '2025-06-10T09:00:00.000Z' }), [])
    expect(s.daysSince).toBeNull()
    expect(s.age).toBe(5)
    expect(s.quietFor).toBe(5)
  })

  it('uses days since the last entry for quietFor once logged', () => {
    const s = statsFor(goal(), [entry('g1', '2025-06-13', 1)])
    expect(s.daysSince).toBe(2)
    expect(s.quietFor).toBe(2)
  })

  /* Imported history must not make an old goal look brand new: age is taken
     from the earlier of creation and first entry. */
  it('ages a goal from its first entry when that predates creation', () => {
    const s = statsFor(goal({ createdAt: '2025-06-14T09:00:00.000Z' }), [
      entry('g1', '2025-01-01', 1),
    ])
    expect(s.age).toBe(165)
  })

  it('sums totals and finds the best single day', () => {
    const s = statsFor(goal(), [
      entry('g1', '2025-06-13', 2),
      entry('g1', '2025-06-14', 5),
    ])
    expect(s.total).toBe(7)
    expect(s.bestDay).toBe(5)
    expect(s.activeDays).toBe(2)
  })

  it('derives pace and percentage from the target', () => {
    const s = statsFor(goal({ target: 7 }), [entry('g1', TODAY, 7)])
    expect(s.target).toBe(7)
    expect(s.rollingPct).toBe(1)
    expect(s.onPace).toBe(true)
  })

  it('treats a goal with no target as always on pace', () => {
    const s = statsFor(goal({ target: 0 }), [])
    expect(s.target).toBe(0)
    expect(s.pct).toBe(0)
    expect(s.onPace).toBe(true)
  })

  it('uses a 7-day rolling window for a weekly goal', () => {
    expect(statsFor(goal(), []).periodLength).toBe(7)
  })

  it('uses the calendar month length for a monthly goal', () => {
    const s = statsFor(goal({ cadence: 'month' }), [])
    expect(s.periodLength).toBe(30) // June
    expect(s.periodStart).toBe('2025-06-01')
  })
})

describe('balanceScore', () => {
  const goal = (id, over = {}) => ({ id, cadence: 'week', target: 7, status: 'active', ...over })

  it('is null with fewer than two active goals', () => {
    expect(balanceScore([], indexEntries([]), settings(), TODAY)).toBeNull()
    expect(balanceScore([goal('a')], indexEntries([]), settings(), TODAY)).toBeNull()
  })

  it('is 0 when nothing has been logged at all', () => {
    const got = balanceScore([goal('a'), goal('b')], indexEntries([]), settings(), TODAY)
    expect(got).toBe(0)
  })

  it('is 100 when attention is split evenly', () => {
    const entries = [entry('a', TODAY, 7), entry('b', TODAY, 7)]
    const got = balanceScore([goal('a'), goal('b')], indexEntries(entries), settings(), TODAY)
    expect(got).toBe(100)
  })

  it('drops when one goal takes all the attention', () => {
    const entries = [entry('a', TODAY, 7)]
    const got = balanceScore([goal('a'), goal('b')], indexEntries(entries), settings(), TODAY)
    expect(got).toBe(0) // all weight on one goal → zero entropy
  })

  /* Revisit goals are deliberately low-volume; counting them would read as
     lopsided attention when it is the intended shape. */
  it('ignores revisit and archived goals', () => {
    const goals = [goal('a'), goal('b'), goal('c', { status: 'revisit' }), goal('d', { status: 'done' })]
    const entries = [entry('a', TODAY, 7), entry('b', TODAY, 7)]
    expect(balanceScore(goals, indexEntries(entries), settings(), TODAY)).toBe(100)
  })
})

describe('taskSummary', () => {
  const task = (over = {}) => ({ id: 't', title: 'x', amount: 1, done: false, ...over })

  it('counts open and done work', () => {
    const got = taskSummary(
      [task({ amount: 2 }), task({ amount: 3, done: true })],
      { target: 7, thisPeriod: 3 },
    )
    expect(got).toMatchObject({ total: 2, open: 1, done: 1, planned: 2, delivered: 3, pct: 50 })
  })

  /* `covers` is measured against what is left, not the whole target, so a goal
     already halfway there isn't told it needs the full amount again. */
  it('measures coverage against the remaining target', () => {
    const got = taskSummary([task({ amount: 4 })], { target: 10, thisPeriod: 6 })
    expect(got.remaining).toBe(4)
    expect(got.covers).toBe(1)
    expect(got.enough).toBe(true)
  })

  it('reports not-enough when open tasks fall short', () => {
    const got = taskSummary([task({ amount: 1 })], { target: 10, thisPeriod: 0 })
    expect(got.covers).toBeCloseTo(0.1, 5)
    expect(got.enough).toBe(false)
  })

  it('treats an already-met target as covered', () => {
    const got = taskSummary([task({ amount: 1 })], { target: 5, thisPeriod: 5 })
    expect(got.remaining).toBe(0)
    expect(got.enough).toBe(true)
  })

  it('handles an empty list', () => {
    const got = taskSummary([], { target: 5, thisPeriod: 0 })
    expect(got).toMatchObject({ total: 0, open: 0, done: 0, planned: 0, pct: 0 })
  })
})

describe('nextTask', () => {
  it('returns the first open task in list order', () => {
    const list = [
      { id: 'a', done: true },
      { id: 'b', done: false },
      { id: 'c', done: false },
    ]
    expect(nextTask(list).id).toBe('b')
  })

  it('is null when everything is done or the list is empty', () => {
    expect(nextTask([{ id: 'a', done: true }])).toBeNull()
    expect(nextTask([])).toBeNull()
    expect(nextTask(null)).toBeNull()
  })
})
