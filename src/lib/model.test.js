/* The migration functions run against every row read from the database, so a
   regression here corrupts existing accounts rather than just breaking a view.
   These tests pin the shapes that older saves are allowed to have. */

import { describe, expect, it } from 'vitest'
import {
  STATUS,
  categoryList,
  formatAmount,
  groupByCategory,
  inPlay,
  isActive,
  isDone,
  isRevisit,
  migrateGoal,
  migrateTask,
  reopenTask,
  revisitEvery,
  revisitLabel,
  statusOf,
  unitFor,
  unitWord,
  withStatus,
  withUnit,
} from './model.js'

describe('statusOf', () => {
  it('trusts a valid explicit status', () => {
    expect(statusOf({ status: 'active' })).toBe(STATUS.ACTIVE)
    expect(statusOf({ status: 'revisit' })).toBe(STATUS.REVISIT)
    expect(statusOf({ status: 'done' })).toBe(STATUS.DONE)
  })

  /* Goals written before statuses existed carry only a boolean `archived`. */
  it('falls back to the legacy archived flag', () => {
    expect(statusOf({ archived: true })).toBe(STATUS.DONE)
    expect(statusOf({ archived: false })).toBe(STATUS.ACTIVE)
  })

  it('defaults to active for an unknown, missing or nullish goal', () => {
    expect(statusOf({ status: 'nonsense' })).toBe(STATUS.ACTIVE)
    expect(statusOf({})).toBe(STATUS.ACTIVE)
    expect(statusOf(null)).toBe(STATUS.ACTIVE)
    expect(statusOf(undefined)).toBe(STATUS.ACTIVE)
  })

  it('prefers an explicit status over a stale archived flag', () => {
    expect(statusOf({ status: 'active', archived: true })).toBe(STATUS.ACTIVE)
  })
})

describe('status predicates', () => {
  it('classify each state', () => {
    const active = { status: 'active' }
    const revisit = { status: 'revisit' }
    const done = { status: 'done' }

    expect([isActive(active), isRevisit(active), isDone(active)]).toEqual([true, false, false])
    expect([isActive(revisit), isRevisit(revisit), isDone(revisit)]).toEqual([false, true, false])
    expect([isActive(done), isRevisit(done), isDone(done)]).toEqual([false, false, true])
  })

  it('treats everything but done as still in play', () => {
    expect(inPlay({ status: 'active' })).toBe(true)
    expect(inPlay({ status: 'revisit' })).toBe(true)
    expect(inPlay({ status: 'done' })).toBe(false)
  })
})

describe('migrateGoal', () => {
  it('fills in every field a pre-status goal lacks', () => {
    const got = migrateGoal({ id: 'g1', name: 'Guitar', emoji: '🎸' })
    expect(got).toMatchObject({
      id: 'g1',
      name: 'Guitar',
      emoji: 'guitar', // legacy emoji mapped to an icon id
      status: STATUS.ACTIVE,
      archived: false,
      revisitEvery: 30,
      completedAt: null,
    })
  })

  it('maps a legacy archived goal to done and keeps both fields consistent', () => {
    const got = migrateGoal({ id: 'g1', archived: true })
    expect(got.status).toBe(STATUS.DONE)
    expect(got.archived).toBe(true)
  })

  it('repairs an archived flag that disagrees with the status', () => {
    const got = migrateGoal({ id: 'g1', status: 'active', archived: true })
    expect(got.status).toBe(STATUS.ACTIVE)
    expect(got.archived).toBe(false)
  })

  it('falls back to the first icon for an unrecognised one', () => {
    expect(migrateGoal({ emoji: '🦄' }).emoji).toBe('target')
    expect(migrateGoal({}).emoji).toBe('target')
  })

  it('leaves an already-valid icon id alone', () => {
    expect(migrateGoal({ emoji: 'piano' }).emoji).toBe('piano')
  })

  it('preserves unknown fields rather than dropping them', () => {
    const got = migrateGoal({ id: 'g1', somethingNew: 42 })
    expect(got.somethingNew).toBe(42)
  })

  it('does not overwrite an existing revisit interval or completion date', () => {
    const got = migrateGoal({ revisitEvery: 7, completedAt: '2025-01-01T00:00:00.000Z' })
    expect(got.revisitEvery).toBe(7)
    expect(got.completedAt).toBe('2025-01-01T00:00:00.000Z')
  })

  it('is idempotent', () => {
    const once = migrateGoal({ id: 'g1', emoji: '🎸', archived: true })
    expect(migrateGoal(once)).toEqual(once)
  })
})

describe('migrateTask', () => {
  it('coerces a loosely-typed task into shape', () => {
    const got = migrateTask({ id: 't1', title: '  read chapter 4  ', amount: '2.5' })
    expect(got).toMatchObject({
      id: 't1',
      title: 'read chapter 4', // trimmed
      amount: 2.5, // coerced from string
      done: false,
      order: 0,
      entryId: null,
      completedAt: null,
    })
  })

  it('clamps a negative or unparseable amount to zero', () => {
    expect(migrateTask({ amount: -5 }).amount).toBe(0)
    expect(migrateTask({ amount: 'abc' }).amount).toBe(0)
    expect(migrateTask({}).amount).toBe(0)
  })

  it('falls back to the list index for a missing order', () => {
    expect(migrateTask({ title: 'a' }, 3).order).toBe(3)
    expect(migrateTask({ title: 'a', order: 0 }, 3).order).toBe(0) // 0 is a real order
  })

  it('coerces done to a boolean', () => {
    expect(migrateTask({ done: 1 }).done).toBe(true)
    expect(migrateTask({ done: undefined }).done).toBe(false)
  })

  it('handles a missing title', () => {
    expect(migrateTask({}).title).toBe('')
    expect(migrateTask({ title: null }).title).toBe('')
  })

  it('is idempotent', () => {
    const once = migrateTask({ id: 't1', title: ' x ', amount: '3' }, 2)
    expect(migrateTask(once, 2)).toEqual(once)
  })
})

describe('withStatus', () => {
  it('records the first completion time', () => {
    const got = withStatus({ id: 'g1', completedAt: null }, STATUS.DONE)
    expect(got.status).toBe(STATUS.DONE)
    expect(got.archived).toBe(true)
    expect(got.completedAt).not.toBeNull()
  })

  /* completedAt is history, not state — reopening a goal must not erase it. */
  it('keeps the original completion time through a reopen', () => {
    const first = '2025-01-01T00:00:00.000Z'
    const reopened = withStatus({ id: 'g1', completedAt: first }, STATUS.ACTIVE)
    expect(reopened.completedAt).toBe(first)
    expect(reopened.archived).toBe(false)
  })

  it('does not overwrite an earlier completion when completing again', () => {
    const first = '2025-01-01T00:00:00.000Z'
    const got = withStatus({ id: 'g1', completedAt: first }, STATUS.REVISIT)
    expect(got.completedAt).toBe(first)
  })

  it('applies an extra patch alongside the status', () => {
    const got = withStatus({ id: 'g1' }, STATUS.REVISIT, { revisitEvery: 14 })
    expect(got.revisitEvery).toBe(14)
    expect(got.status).toBe(STATUS.REVISIT)
    expect(got.archived).toBe(false) // revisit is not archived
  })
})

describe('reopenTask', () => {
  it('clears the entry a finished task created', () => {
    const got = reopenTask({ id: 't1', done: true, entryId: 'e1', completedAt: 'x' })
    expect(got.done).toBe(false)
    expect(got.entryId).toBeNull()
  })
})

describe('revisitEvery', () => {
  it('defaults when unset and rounds a loose value', () => {
    expect(revisitEvery({})).toBe(30)
    expect(revisitEvery(null)).toBe(30)
    expect(revisitEvery({ revisitEvery: 7 })).toBe(7)
    expect(revisitEvery({ revisitEvery: '14' })).toBe(14)
    expect(revisitEvery({ revisitEvery: 6.6 })).toBe(7)
  })

  it('never returns less than a day', () => {
    expect(revisitEvery({ revisitEvery: 0 })).toBe(30) // 0 is falsy → default
    expect(revisitEvery({ revisitEvery: -5 })).toBe(1) // clamped
  })
})

describe('revisitLabel', () => {
  it('names the presets and falls back for anything else', () => {
    expect(revisitLabel(7)).toBe('Weekly')
    expect(revisitLabel(30)).toBe('Monthly')
    expect(revisitLabel(11)).toBe('Every 11 days')
  })
})

describe('unitFor', () => {
  it('resolves a preset', () => {
    expect(unitFor({ unitId: 'hours' })).toMatchObject({ one: 'hour', many: 'hours', step: 0.5 })
  })

  it('falls back to the first preset for an unknown unit', () => {
    expect(unitFor({ unitId: 'nonsense' }).id).toBe('hours')
  })

  it('uses the goal’s own words for a custom unit', () => {
    const u = unitFor({ unitId: 'custom', unitOne: 'chapter', unitMany: 'chapters' })
    expect(u).toMatchObject({ one: 'chapter', many: 'chapters', abbr: '' })
  })

  it('falls back to generic words for a custom unit with no words set', () => {
    expect(unitFor({ unitId: 'custom' })).toMatchObject({ one: 'unit', many: 'units' })
  })

  it('lets a goal override step and precision, including with zero', () => {
    const u = unitFor({ unitId: 'hours', unitStep: 2, unitPrecision: 0 })
    expect(u.step).toBe(2)
    expect(u.precision).toBe(0) // ?? not ||, so an explicit 0 must survive
  })
})

describe('amount formatting', () => {
  const hours = unitFor({ unitId: 'hours' })
  const pages = unitFor({ unitId: 'pages' })

  it('respects each unit’s precision', () => {
    expect(formatAmount(2.5, hours)).toBe('2.5')
    expect(formatAmount(3, hours)).toBe('3') // no trailing .0
    expect(formatAmount(2.6, pages)).toBe('3') // whole units round
  })

  it('coerces junk to zero', () => {
    expect(formatAmount('abc', hours)).toBe('0')
    expect(formatAmount(null, hours)).toBe('0')
  })

  it('singularises only at exactly one', () => {
    expect(unitWord(1, hours)).toBe('hour')
    expect(unitWord(-1, hours)).toBe('hour')
    expect(unitWord(0, hours)).toBe('hours')
    expect(unitWord(1.5, hours)).toBe('hours')
  })

  it('spells out a value with its unit', () => {
    expect(withUnit(1, hours)).toBe('1 hour')
    expect(withUnit(2.5, hours)).toBe('2.5 hours')
  })
})

describe('categories', () => {
  const g = (id, category) => ({ id, category })

  it('sorts named categories and pushes the blank one last', () => {
    const got = categoryList([g('a', 'Music'), g('b', ''), g('c', 'Body')])
    expect(got[0]).toBe('Body')
    expect(got[1]).toBe('Music')
    expect(got).toHaveLength(3) // plus the uncategorised marker
  })

  it('groups goals and keeps the uncategorised group last', () => {
    const goals = [g('a', 'Music'), g('b', ''), g('c', 'Body'), g('d', 'Music')]
    const groups = groupByCategory(goals)
    expect(groups.map(([c]) => c).slice(0, 2)).toEqual(['Body', 'Music'])
    expect(groups[groups.length - 1][1].map((x) => x.id)).toEqual(['b'])
    expect(groups.find(([c]) => c === 'Music')[1]).toHaveLength(2)
  })

  it('maps an item to its goal through the pick function', () => {
    const rows = [{ goal: g('a', 'Music') }, { goal: g('b', 'Music') }]
    const groups = groupByCategory(rows, (r) => r.goal)
    expect(groups).toHaveLength(1)
    expect(groups[0][1]).toHaveLength(2)
  })
})
