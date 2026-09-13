/* Savings pots: a thing you are saving up for, and the money you have put
   towards it.

   A pot is deliberately not a goal. Goals are practices — measured in hours or
   pages, scored on how long they have gone quiet, and nudged. A pot is a
   balance against a price: it only ever asks "how much of this have I got
   yet?", so it stays out of the nudge entirely and keeps its own view.

   Like entries, a deposit is an ordinary dated record you can delete. Taking
   money back out is just a deposit with a negative amount, so the balance is
   always the plain sum of everything recorded — never a stored total that can
   drift away from its own history. */

import { normaliseSavingsIconId, SAVINGS_ICON_CHOICES } from './goalIcons.jsx'
import { todayKey, daysBetween } from './date.js'

export const SAVINGS_STATUS = { SAVING: 'saving', BOUGHT: 'bought' }

export const isSaving = (p) => statusOfPot(p) === SAVINGS_STATUS.SAVING
export const isBought = (p) => statusOfPot(p) === SAVINGS_STATUS.BOUGHT

export function statusOfPot(pot) {
  return pot?.status === SAVINGS_STATUS.BOUGHT ? SAVINGS_STATUS.BOUGHT : SAVINGS_STATUS.SAVING
}

/* ---------------------------------------------------------------- money */

/* The currencies the picker offers. Anything Intl knows about would work —
   these are just the ones worth putting one tap away. */
export const CURRENCIES = [
  { code: 'GBP', label: 'Pound (£)' },
  { code: 'USD', label: 'Dollar ($)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'CAD', label: 'Canadian dollar (C$)' },
  { code: 'AUD', label: 'Australian dollar (A$)' },
  { code: 'NZD', label: 'New Zealand dollar (NZ$)' },
]

export const DEFAULT_CURRENCY = 'GBP'

/** Whole amounts lose the ".00" — most pots are priced in round numbers, and
    "£1,200" reads faster than "£1,200.00". Pence show when there are any. */
export function formatMoney(value, currency = DEFAULT_CURRENCY) {
  const n = Number(value) || 0
  const whole = Math.abs(n - Math.round(n)) < 0.005
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    }).format(whole ? Math.round(n) : n)
  } catch {
    return `${currencySymbol(currency)}${(whole ? Math.round(n) : n).toFixed(whole ? 0 : 2)}`
  }
}

/** Just the symbol, for prefixing an amount input. */
export function currencySymbol(currency = DEFAULT_CURRENCY) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency })
      .formatToParts(0)
      .find((p) => p.type === 'currency')?.value || currency
  } catch {
    return currency
  }
}

/** Money in, rounded to the nearest penny so sums stay exact. */
export const toMoney = (value) => Math.round((Number(value) || 0) * 100) / 100

/* ---------------------------------------------------------------- shapes */

export function newPot(index = 0) {
  return {
    id: crypto.randomUUID(),
    name: '',
    target: 0,
    icon: SAVINGS_ICON_CHOICES[index % SAVINGS_ICON_CHOICES.length],
    colorSlot: (index % 8) + 1,
    note: '',
    status: SAVINGS_STATUS.SAVING,
    boughtAt: null,
    createdAt: new Date().toISOString(),
  }
}

export function newDeposit(potId, dateKey, amount, note = '') {
  return {
    id: crypto.randomUUID(),
    potId,
    date: dateKey,
    amount: toMoney(amount),
    note,
    loggedAt: new Date().toISOString(),
  }
}

/** Fill in fields a pot from an older save (or an older backup) won't have. */
export function migratePot(pot) {
  return {
    ...pot,
    name: String(pot.name || '').trim(),
    target: Math.max(0, toMoney(pot.target)),
    icon: normaliseSavingsIconId(pot.icon),
    colorSlot: Number(pot.colorSlot) || 1,
    note: pot.note || '',
    status: statusOfPot(pot),
    boughtAt: pot.boughtAt ?? null,
  }
}

export function migrateDeposit(deposit) {
  return { ...deposit, amount: toMoney(deposit.amount) }
}

/** Mark a pot bought, or put it back to saving. `boughtAt` is history: it
    records the first purchase and survives a later reopen. */
export function withPotStatus(pot, status) {
  return {
    ...pot,
    status,
    boughtAt: status === SAVINGS_STATUS.BOUGHT ? pot.boughtAt || new Date().toISOString() : pot.boughtAt || null,
  }
}

/* ----------------------------------------------------------------- stats */

/** potId → deposits, newest first. */
export function indexDeposits(deposits) {
  const byPot = new Map()
  for (const d of deposits) {
    let list = byPot.get(d.potId)
    if (!list) { list = []; byPot.set(d.potId, list) }
    list.push(d)
  }
  for (const list of byPot.values()) list.sort(depositOrder)
  return byPot
}

/** Newest first; several on one day fall back to the clock. */
export function depositOrder(a, b) {
  return b.date === a.date
    ? (b.loggedAt || '').localeCompare(a.loggedAt || '')
    : b.date.localeCompare(a.date)
}

/** Everything one pot's card and detail page need, from its deposits alone. */
export function potStats(pot, deposits = [], today = todayKey()) {
  const target = Math.max(0, toMoney(pot?.target))
  let saved = 0
  let paidIn = 0
  let takenOut = 0
  let first = null
  let last = null

  for (const d of deposits) {
    const amount = toMoney(d.amount)
    saved += amount
    if (amount >= 0) paidIn += amount
    else takenOut -= amount
    if (!first || d.date < first) first = d.date
    if (!last || d.date > last) last = d.date
  }
  saved = toMoney(saved)

  const remaining = target > 0 ? Math.max(0, toMoney(target - saved)) : 0
  const pct = target > 0 ? (saved / target) * 100 : null
  const funded = target > 0 && saved >= target

  /* Pace is measured from the first deposit to today, not between deposits —
     a fortnight of putting nothing aside should slow the estimate down, which
     is exactly the thing worth knowing. */
  const spanDays = first ? Math.max(1, daysBetween(first, today) + 1) : 0
  const perWeek = spanDays >= 7 && saved > 0 ? toMoney((saved / spanDays) * 7) : null
  const weeksLeft = perWeek > 0 && remaining > 0 ? remaining / perWeek : null

  return {
    target,
    saved,
    paidIn,
    takenOut,
    remaining,
    pct,
    funded,
    count: deposits.length,
    first,
    last,
    daysSince: last ? daysBetween(last, today) : null,
    perWeek,
    weeksLeft,
  }
}

/** The totals strip above the pot list. Bought pots are done, not pending, so
    they add to what you have put away but never to what is left to find. */
export function savingsSummary(pots, byPot, today = todayKey()) {
  let saved = 0
  let target = 0
  let remaining = 0
  let funded = 0

  for (const pot of pots) {
    const stats = potStats(pot, byPot.get(pot.id) || [], today)
    saved += stats.saved
    if (isSaving(pot)) {
      target += stats.target
      remaining += stats.remaining
      if (stats.funded) funded += 1
    }
  }

  /* No overall percentage on purpose: the money put away includes pots you
     have already bought, while the prices left only count the ones still
     filling, so a single share of the two would flatter itself. */
  return {
    saved: toMoney(saved),
    target: toMoney(target),
    remaining: toMoney(remaining),
    funded,
  }
}

/** "about 6 weeks away" — the honest version of an estimate nobody should
    plan around to the day. */
export function paceLabel(stats) {
  if (stats.funded) return 'Fully funded'
  if (stats.weeksLeft == null) return null
  const weeks = Math.ceil(stats.weeksLeft)
  if (weeks <= 1) return 'About a week away at this pace'
  if (weeks < 9) return `About ${weeks} weeks away at this pace`
  const months = Math.round(weeks / 4.345)
  if (months < 24) return `About ${months} ${months === 1 ? 'month' : 'months'} away at this pace`
  return 'Over two years away at this pace'
}
