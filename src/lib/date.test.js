/* Every day key in the app is a local-timezone 'YYYY-MM-DD' string, so the
   interesting failures here are the ones that only appear away from UTC or
   across a DST boundary. CI runs this file under UTC, +14 and -10; the handful
   of assertions that depend on a specific zone pin it explicitly. */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addDays,
  dayKeyOf,
  dayRange,
  daysBetween,
  formatPeriod,
  formatShort,
  fromKey,
  periodLength,
  periodRange,
  periodStart,
  relativeDays,
  startOfMonth,
  startOfWeek,
  todayKey,
  toKey,
} from './date.js'

/** Run a body with the process timezone pinned. Node reads TZ per Date call,
    so this is enough without reloading the module. */
function withTZ(tz, body) {
  const prev = process.env.TZ
  process.env.TZ = tz
  try {
    body()
  } finally {
    process.env.TZ = prev
  }
}

describe('toKey / fromKey', () => {
  it('round-trips a key through a Date', () => {
    expect(toKey(fromKey('2025-03-09'))).toBe('2025-03-09')
  })

  it('zero-pads single-digit months and days', () => {
    expect(toKey(new Date(2025, 0, 5))).toBe('2025-01-05')
  })

  it('builds a local midnight, not a UTC one', () => {
    const d = fromKey('2025-06-15')
    expect(d.getHours()).toBe(0)
    expect(d.getDate()).toBe(15)
    expect(d.getMonth()).toBe(5)
  })
})

describe('dayKeyOf', () => {
  it('returns null for missing or unparseable input', () => {
    expect(dayKeyOf(null)).toBeNull()
    expect(dayKeyOf(undefined)).toBeNull()
    expect(dayKeyOf('')).toBeNull()
    expect(dayKeyOf('garbage')).toBeNull()
  })

  it('uses the local day, not the UTC one', () => {
    // 03:30 UTC on the 10th is still the evening of the 9th in New York.
    // Slicing the ISO string would wrongly yield '2025-03-10'.
    withTZ('America/New_York', () => {
      expect(dayKeyOf('2025-03-10T03:30:00.000Z')).toBe('2025-03-09')
    })
    // And east of Greenwich the same instant is already the 10th.
    withTZ('Europe/Berlin', () => {
      expect(dayKeyOf('2025-03-10T03:30:00.000Z')).toBe('2025-03-10')
    })
  })
})

describe('addDays', () => {
  it('rolls forward over a month end', () => {
    expect(addDays('2025-01-31', 1)).toBe('2025-02-01')
  })

  it('rolls backward over a year start', () => {
    expect(addDays('2025-01-01', -1)).toBe('2024-12-31')
  })

  it('handles a leap day', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01')
  })
})

describe('daysBetween', () => {
  it('is signed and zero for the same day', () => {
    expect(daysBetween('2025-05-01', '2025-05-04')).toBe(3)
    expect(daysBetween('2025-05-04', '2025-05-01')).toBe(-3)
    expect(daysBetween('2025-05-01', '2025-05-01')).toBe(0)
  })

  /* The implementation divides a millisecond difference by 86400000 and
     rounds. Across a DST shift the true gap is 23 or 25 hours, so the rounding
     is what keeps this correct — switching it to Math.floor would silently
     break every streak in the app. These assertions exist to catch that. */
  it('counts whole days across both DST transitions', () => {
    withTZ('America/New_York', () => {
      expect(daysBetween('2025-03-08', '2025-03-09')).toBe(1) // 23-hour day
      expect(daysBetween('2025-11-01', '2025-11-02')).toBe(1) // 25-hour day
      expect(daysBetween('2025-03-01', '2025-06-01')).toBe(92)
    })
  })

  it('counts whole days across a southern-hemisphere DST shift', () => {
    withTZ('Australia/Sydney', () => {
      expect(daysBetween('2025-04-05', '2025-04-06')).toBe(1)
      expect(daysBetween('2025-10-04', '2025-10-05')).toBe(1)
    })
  })
})

describe('startOfWeek', () => {
  /* One assertion exercising three things at once: the (getDay - weekStart + 7)
     shift, setDate's negative rollover, and the year decrement. */
  it('walks back across a year boundary', () => {
    expect(startOfWeek('2025-01-05', 1)).toBe('2024-12-30')
  })

  it('treats a Sunday as its own week start when weekStart is 0', () => {
    expect(startOfWeek('2025-01-05', 0)).toBe('2025-01-05')
  })

  it('leaves a week start untouched', () => {
    expect(startOfWeek('2025-06-16', 1)).toBe('2025-06-16') // a Monday
  })

  it('defaults to a Monday week start', () => {
    expect(startOfWeek('2025-06-18')).toBe(startOfWeek('2025-06-18', 1))
  })

  it('is idempotent for every weekday and both week starts', () => {
    for (const weekStart of [0, 1]) {
      for (let i = 0; i < 7; i++) {
        const key = addDays('2025-06-15', i)
        const once = startOfWeek(key, weekStart)
        expect(startOfWeek(once, weekStart)).toBe(once)
        // and the start is never more than 6 days behind the day itself
        const back = daysBetween(once, key)
        expect(back).toBeGreaterThanOrEqual(0)
        expect(back).toBeLessThanOrEqual(6)
      }
    }
  })
})

describe('startOfMonth / periodStart', () => {
  it('pins to the first of the month', () => {
    expect(startOfMonth('2025-07-23')).toBe('2025-07-01')
  })

  it('routes by cadence', () => {
    expect(periodStart('2025-07-23', 'month')).toBe('2025-07-01')
    expect(periodStart('2025-07-23', 'week', 1)).toBe('2025-07-21')
  })
})

describe('periodLength', () => {
  it('is always 7 for a week', () => {
    expect(periodLength('week', '2025-02-01')).toBe(7)
  })

  it('knows February in leap and common years', () => {
    expect(periodLength('month', '2024-02-01')).toBe(29)
    expect(periodLength('month', '2025-02-01')).toBe(28)
  })

  it('handles 30- and 31-day months', () => {
    expect(periodLength('month', '2025-04-01')).toBe(30)
    expect(periodLength('month', '2025-12-01')).toBe(31)
  })
})

describe('periodRange', () => {
  it('yields exactly twelve month starts across a year, in order', () => {
    const got = periodRange('2025-01-15', '2025-12-31', 'month')
    expect(got).toHaveLength(12)
    expect(new Set(got).size).toBe(12) // no duplicates
    expect(got[0]).toBe('2025-01-01')
    expect(got[11]).toBe('2025-12-01')
    expect([...got].sort()).toEqual(got) // already ascending
  })

  it('crosses a February without skipping or repeating a month', () => {
    const got = periodRange('2024-01-01', '2024-04-01', 'month')
    expect(got).toEqual(['2024-01-01', '2024-02-01', '2024-03-01', '2024-04-01'])
  })

  it('steps weekly and stays on the week start', () => {
    const got = periodRange('2025-06-16', '2025-07-07', 'week', 1)
    expect(got).toEqual(['2025-06-16', '2025-06-23', '2025-06-30', '2025-07-07'])
  })

  it('returns a single period when from and to share one', () => {
    expect(periodRange('2025-06-17', '2025-06-19', 'week', 1)).toEqual(['2025-06-16'])
  })

  /* The loop has a 1000-iteration guard. A two-year span is ~104 weeks, so a
     correct implementation never approaches it; if this ever returns exactly
     1000 the cursor has stopped advancing. */
  it('does not trip its guard on a two-year span', () => {
    const weeks = periodRange('2023-01-01', '2025-01-01', 'week', 1)
    expect(weeks.length).toBeGreaterThan(100)
    expect(weeks.length).toBeLessThan(120)
    const months = periodRange('2023-01-01', '2025-01-01', 'month')
    expect(months).toHaveLength(25)
  })
})

describe('dayRange', () => {
  it('is inclusive at both ends', () => {
    expect(dayRange('2025-06-01', '2025-06-04')).toEqual([
      '2025-06-01',
      '2025-06-02',
      '2025-06-03',
      '2025-06-04',
    ])
  })

  it('returns a single day when from equals to', () => {
    expect(dayRange('2025-06-01', '2025-06-01')).toEqual(['2025-06-01'])
  })

  it('returns nothing when the range is inverted', () => {
    expect(dayRange('2025-06-04', '2025-06-01')).toEqual([])
  })
})

describe('todayKey', () => {
  afterEach(() => vi.useRealTimers())

  it('reports the local day late at night, not the UTC one', () => {
    withTZ('America/New_York', () => {
      vi.useFakeTimers()
      // New York is EDT (UTC-4) by this date, so 23:59 local on the 9th is
      // 03:59 UTC on the 10th. Keying off UTC would roll the day over early.
      vi.setSystemTime(new Date('2025-03-10T03:59:00.000Z'))
      expect(todayKey()).toBe('2025-03-09')
    })
  })
})

describe('formatting helpers', () => {
  it('formats a short date', () => {
    expect(formatShort('2025-01-05')).toBe('Jan 5')
  })

  it('labels periods by cadence', () => {
    expect(formatPeriod('2025-01-01', 'month')).toBe('Jan 2025')
    expect(formatPeriod('2025-01-06', 'week')).toBe('Week of Jan 6')
  })
})

describe('relativeDays', () => {
  it('names the recent past', () => {
    expect(relativeDays(null)).toBe('never')
    expect(relativeDays(0)).toBe('today')
    expect(relativeDays(-1)).toBe('today') // clamped, never "in 1 day"
    expect(relativeDays(1)).toBe('yesterday')
    expect(relativeDays(5)).toBe('5 days ago')
  })

  it('switches to months at the documented boundaries', () => {
    expect(relativeDays(29)).toBe('29 days ago')
    expect(relativeDays(30)).toBe('a month ago')
    expect(relativeDays(59)).toBe('a month ago')
    expect(relativeDays(60)).toBe('2 months ago')
  })
})
