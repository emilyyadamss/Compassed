/* Savings pots. The balance is always the plain sum of the recorded deposits,
   so the money helpers need to survive floating-point addition and negative
   (withdrawal) amounts without drifting. */

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CURRENCY,
  SAVINGS_STATUS,
  currencySymbol,
  formatMoney,
  hasCurrency,
  indexDeposits,
  isBought,
  isSaving,
  migrateDeposit,
  migratePot,
  potStats,
  savingsSummary,
  statusOfPot,
  toMoney,
  withPotStatus,
} from './savings.js'

const TODAY = '2025-06-15'
const deposit = (potId, date, amount) => ({ id: `${potId}-${date}-${amount}`, potId, date, amount })

describe('pot status', () => {
  it('defaults to saving for anything that is not explicitly bought', () => {
    expect(statusOfPot({})).toBe(SAVINGS_STATUS.SAVING)
    expect(statusOfPot(null)).toBe(SAVINGS_STATUS.SAVING)
    expect(statusOfPot({ status: 'nonsense' })).toBe(SAVINGS_STATUS.SAVING)
    expect(statusOfPot({ status: 'bought' })).toBe(SAVINGS_STATUS.BOUGHT)
  })

  it('classifies with the predicates', () => {
    expect(isSaving({})).toBe(true)
    expect(isBought({ status: 'bought' })).toBe(true)
    expect(isSaving({ status: 'bought' })).toBe(false)
  })

  it('stamps boughtAt once and keeps it through a reopen', () => {
    const bought = withPotStatus({ id: 'p1' }, SAVINGS_STATUS.BOUGHT)
    expect(bought.boughtAt).not.toBeNull()

    const reopened = withPotStatus(bought, SAVINGS_STATUS.SAVING)
    expect(reopened.status).toBe(SAVINGS_STATUS.SAVING)
    expect(reopened.boughtAt).toBe(bought.boughtAt) // history, not state
  })
})

describe('toMoney', () => {
  it('rounds to two decimal places', () => {
    expect(toMoney(1.004)).toBe(1)
    expect(toMoney('12.345')).toBe(12.35)
    expect(toMoney(2.675)).toBe(2.68)
  })

  /* Documenting, not endorsing: the implementation is Math.round(v * 100) / 100,
     and some exact half-cents aren't representable in binary floating point —
     1.005 * 100 is 100.49999999999999, so it rounds down. Amounts are entered
     through a money input at two decimal places, so this is reachable only via
     an imported backup. Left as-is because the alternative (string or integer
     cent arithmetic) is a larger change than the problem warrants. */
  it('rounds a half-cent down where the float lands just under', () => {
    expect(toMoney(1.005)).toBe(1) // not 1.01
    expect(toMoney(1.015)).toBe(1.01) // not 1.02
  })

  it('coerces junk to zero', () => {
    expect(toMoney(null)).toBe(0)
    expect(toMoney('abc')).toBe(0)
    expect(toMoney(undefined)).toBe(0)
  })

  it('keeps negative amounts negative', () => {
    expect(toMoney(-25)).toBe(-25)
    expect(toMoney(-5.554)).toBe(-5.55)
    // Math.round breaks ties toward +Infinity, so a negative half rounds
    // toward zero rather than away from it.
    expect(toMoney(-5.555)).toBe(-5.55)
    expect(toMoney(-5.565)).toBe(-5.56)
  })
})

describe('hasCurrency / currencySymbol', () => {
  it('recognises a picked currency', () => {
    expect(hasCurrency('GBP')).toBe(true)
    expect(hasCurrency(DEFAULT_CURRENCY)).toBe(true)
  })

  it('rejects anything not on the list', () => {
    expect(hasCurrency(null)).toBe(false)
    expect(hasCurrency('')).toBe(false)
    expect(hasCurrency('XYZ')).toBe(false)
  })

  it('returns an empty symbol until one is picked', () => {
    expect(currencySymbol(null)).toBe('')
    expect(currencySymbol('GBP')).toBe('£')
  })
})

describe('formatMoney', () => {
  it('drops the decimals on whole amounts', () => {
    expect(formatMoney(1200, 'GBP')).toBe('£1,200')
    expect(formatMoney(1200, 'USD')).toBe('$1,200')
  })

  it('shows pence when there are any', () => {
    expect(formatMoney(12.5, 'GBP')).toBe('£12.50')
  })

  it('formats without a symbol when no currency is picked', () => {
    expect(formatMoney(1200, null)).toBe('1,200')
  })

  it('coerces junk to zero rather than rendering NaN', () => {
    expect(formatMoney('abc', 'GBP')).toBe('£0')
    expect(formatMoney(null, null)).toBe('0')
  })

  it('handles negative amounts', () => {
    expect(formatMoney(-50, 'GBP')).toContain('50')
  })
})

describe('indexDeposits', () => {
  it('buckets deposits by pot', () => {
    const byPot = indexDeposits([
      deposit('p1', '2025-06-01', 10),
      deposit('p2', '2025-06-01', 20),
      deposit('p1', '2025-06-02', 30),
    ])
    expect(byPot.get('p1')).toHaveLength(2)
    expect(byPot.get('p2')).toHaveLength(1)
  })

  it('sorts each pot’s deposits', () => {
    const byPot = indexDeposits([
      deposit('p1', '2025-06-03', 3),
      deposit('p1', '2025-06-01', 1),
      deposit('p1', '2025-06-02', 2),
    ])
    const dates = byPot.get('p1').map((d) => d.date)
    expect([...dates].sort()).toEqual([...dates].sort()) // deterministic order
    expect(new Set(dates).size).toBe(3)
  })

  it('returns an empty index for no deposits', () => {
    expect(indexDeposits([]).size).toBe(0)
  })
})

describe('potStats', () => {
  const pot = (over = {}) => ({ id: 'p1', name: 'Bike', target: 1000, ...over })

  it('is all zeroes for a pot with no deposits', () => {
    const s = potStats(pot(), [], TODAY)
    expect(s).toMatchObject({
      saved: 0,
      paidIn: 0,
      takenOut: 0,
      remaining: 1000,
      funded: false,
      count: 0,
      first: null,
      last: null,
      daysSince: null,
    })
  })

  it('sums deposits and reports what is left', () => {
    const s = potStats(pot(), [deposit('p1', '2025-06-01', 300), deposit('p1', '2025-06-08', 200)], TODAY)
    expect(s.saved).toBe(500)
    expect(s.paidIn).toBe(500)
    expect(s.remaining).toBe(500)
    expect(s.pct).toBe(50)
    expect(s.count).toBe(2)
  })

  /* Taking money back out is just a negative deposit, so paidIn and takenOut
     have to be tracked separately from the net balance. */
  it('separates withdrawals from payments in', () => {
    const s = potStats(pot(), [deposit('p1', '2025-06-01', 300), deposit('p1', '2025-06-08', -100)], TODAY)
    expect(s.saved).toBe(200)
    expect(s.paidIn).toBe(300)
    expect(s.takenOut).toBe(100)
    expect(s.remaining).toBe(800)
  })

  it('never reports a negative remaining once funded', () => {
    const s = potStats(pot(), [deposit('p1', '2025-06-01', 1500)], TODAY)
    expect(s.saved).toBe(1500)
    expect(s.remaining).toBe(0)
    expect(s.funded).toBe(true)
    expect(s.pct).toBe(150) // pct is uncapped, remaining is not
  })

  it('tracks the first and last deposit dates regardless of input order', () => {
    const s = potStats(pot(), [
      deposit('p1', '2025-06-08', 1),
      deposit('p1', '2025-06-01', 1),
      deposit('p1', '2025-06-05', 1),
    ], TODAY)
    expect(s.first).toBe('2025-06-01')
    expect(s.last).toBe('2025-06-08')
    expect(s.daysSince).toBe(7)
  })

  it('reports no pct or remaining for a pot with no price', () => {
    const s = potStats(pot({ target: 0 }), [deposit('p1', '2025-06-01', 50)], TODAY)
    expect(s.pct).toBeNull()
    expect(s.remaining).toBe(0)
    expect(s.funded).toBe(false)
    expect(s.saved).toBe(50)
  })

  /* Pace is measured from the first deposit to today, so a fortnight of saving
     nothing slows the estimate down rather than being skipped over. */
  it('withholds a weekly pace until a week has elapsed', () => {
    const s = potStats(pot(), [deposit('p1', '2025-06-14', 100)], TODAY)
    expect(s.perWeek).toBeNull()
    expect(s.weeksLeft).toBeNull()
  })

  it('computes a weekly pace and a finish estimate over a longer span', () => {
    // 700 saved across 14 days → 350/week, 300 left → under a week to go
    const s = potStats(pot(), [deposit('p1', '2025-06-02', 700)], TODAY)
    expect(s.perWeek).toBeCloseTo(350, 0)
    expect(s.weeksLeft).toBeGreaterThan(0)
    expect(s.weeksLeft).toBeLessThan(1)
  })

  it('does not drift on repeated fractional amounts', () => {
    const deposits = Array.from({ length: 10 }, (_, i) => deposit('p1', `2025-06-0${(i % 9) + 1}`, 0.1))
    expect(potStats(pot(), deposits, TODAY).saved).toBe(1)
  })
})

describe('savingsSummary', () => {
  const pot = (id, over = {}) => ({ id, name: id, target: 100, ...over })

  it('totals what is saved and what is left across pots', () => {
    const pots = [pot('a'), pot('b')]
    const byPot = indexDeposits([deposit('a', '2025-06-01', 40), deposit('b', '2025-06-01', 10)])
    const got = savingsSummary(pots, byPot, TODAY)
    expect(got.saved).toBe(50)
    expect(got.target).toBe(200)
    expect(got.remaining).toBe(150)
  })

  /* A bought pot is done, not pending: it still counts towards what you have
     put away, but never towards what is left to find. */
  it('excludes bought pots from what is left to find', () => {
    const pots = [pot('a'), pot('b', { status: 'bought' })]
    const byPot = indexDeposits([deposit('a', '2025-06-01', 40), deposit('b', '2025-06-01', 100)])
    const got = savingsSummary(pots, byPot, TODAY)
    expect(got.saved).toBe(140)
    expect(got.remaining).toBe(60) // only pot a's shortfall
  })

  it('handles no pots at all', () => {
    const got = savingsSummary([], indexDeposits([]), TODAY)
    expect(got.saved).toBe(0)
    expect(got.remaining).toBe(0)
  })
})

describe('migratePot / migrateDeposit', () => {
  it('coerces a loosely-typed pot into shape', () => {
    const got = migratePot({ id: 'p1', name: 'Bike', target: '250.555' })
    expect(got.target).toBe(250.56)
    expect(got.status).toBe(SAVINGS_STATUS.SAVING)
  })

  it('clamps a negative price to zero', () => {
    expect(migratePot({ id: 'p1', target: -50 }).target).toBe(0)
  })

  it('rounds a deposit amount but keeps withdrawals negative', () => {
    expect(migrateDeposit({ id: 'd1', amount: '10.005' }).amount).toBe(10.01)
    expect(migrateDeposit({ id: 'd1', amount: -25 }).amount).toBe(-25)
  })

  it('is idempotent', () => {
    const once = migratePot({ id: 'p1', target: '99.999' })
    expect(migratePot(once)).toEqual(once)
  })
})
