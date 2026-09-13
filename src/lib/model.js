/* Goal / entry shapes, unit presets, and the categorical color slots. */

import { ICON_CHOICES, normaliseIconId } from './goalIcons.jsx'

/* The eight validated categorical slots, in fixed order. A goal keeps its slot
   for life — color follows the entity, never its position in a list. */
export const COLOR_SLOTS = [
  { slot: 1, name: 'Blue' },
  { slot: 2, name: 'Orange' },
  { slot: 3, name: 'Aqua' },
  { slot: 4, name: 'Yellow' },
  { slot: 5, name: 'Magenta' },
  { slot: 6, name: 'Green' },
  { slot: 7, name: 'Violet' },
  { slot: 8, name: 'Red' },
]

export const colorVar = (slot) => `var(--series-${((slot - 1) % 8) + 1})`

/* Unit presets. `step` drives the quick-log stepper; `precision` how values
   render. Anything here can be overridden per goal, including a custom unit. */
export const UNIT_PRESETS = [
  { id: 'hours',    label: 'Hours',     one: 'hour',    many: 'hours',    abbr: 'h',    step: 0.5, precision: 1 },
  { id: 'minutes',  label: 'Minutes',   one: 'minute',  many: 'minutes',  abbr: 'min',  step: 15,  precision: 0 },
  { id: 'sessions', label: 'Sessions',  one: 'session', many: 'sessions', abbr: '',     step: 1,   precision: 0 },
  { id: 'projects', label: 'Projects',  one: 'project', many: 'projects', abbr: '',     step: 1,   precision: 0 },
  { id: 'pages',    label: 'Pages',     one: 'page',    many: 'pages',    abbr: 'pp',   step: 5,   precision: 0 },
  { id: 'words',    label: 'Words',     one: 'word',    many: 'words',    abbr: 'w',    step: 100, precision: 0 },
  { id: 'problems', label: 'Problems',  one: 'problem', many: 'problems', abbr: '',     step: 1,   precision: 0 },
  { id: 'reps',     label: 'Reps',      one: 'rep',     many: 'reps',     abbr: '',     step: 5,   precision: 0 },
  { id: 'km',       label: 'Kilometres',one: 'km',      many: 'km',       abbr: 'km',   step: 1,   precision: 1 },
  { id: 'miles',    label: 'Miles',     one: 'mile',    many: 'miles',    abbr: 'mi',   step: 1,   precision: 1 },
  { id: 'lessons',  label: 'Lessons',   one: 'lesson',  many: 'lessons',  abbr: '',     step: 1,   precision: 0 },
  { id: 'custom',   label: 'Custom…',   one: 'unit',    many: 'units',    abbr: '',     step: 1,   precision: 0 },
]

/* Categories are free text — these are only starting suggestions. A goal with
   no category isn't broken; it just lands in "Uncategorised" at the bottom.
   Categories organise the UI only: the nudge scores every goal globally, so
   filing things away can't hide one from you. */
export const CATEGORY_SUGGESTIONS = ['Learning', 'Health', 'Creative', 'Career', 'Personal']

export const UNCATEGORISED = ''
export const categoryLabel = (c) => (c && c.trim()) || 'Uncategorised'

export const normaliseCategory = (c) => (c || '').trim()

/** Distinct categories in use, alphabetical, with uncategorised always last. */
export function categoryList(goals) {
  const named = new Set()
  let hasBlank = false
  for (const g of goals) {
    const c = normaliseCategory(g.category)
    if (c) named.add(c)
    else hasBlank = true
  }
  const out = [...named].sort((a, b) => a.localeCompare(b))
  if (hasBlank) out.push(UNCATEGORISED)
  return out
}

/** [[category, items], …] in display order. `pick` maps an item to its goal. */
export function groupByCategory(items, pick = (x) => x) {
  const map = new Map()
  for (const item of items) {
    const c = normaliseCategory(pick(item).category)
    if (!map.has(c)) map.set(c, [])
    map.get(c).push(item)
  }
  return [...map.entries()].sort(([a], [b]) =>
    a === UNCATEGORISED ? 1 : b === UNCATEGORISED ? -1 : a.localeCompare(b),
  )
}

/* ------------------------------------------------------------- lifecycle */

/* A goal is in one of three states:

     active   — the everyday state; nudged on recency + deficit.
     revisit  — finished, but kept warm. It leaves the target treadmill and is
                nudged only when its revisit interval has elapsed, so a skill
                you worked for doesn't quietly fade.
     done     — finished and filed away. Never nudged, never counted.

   `archived` is kept in sync with `done` so older backups (and any export read
   by an older build) still round-trip. */
export const STATUS = { ACTIVE: 'active', REVISIT: 'revisit', DONE: 'done' }

export const REVISIT_PRESETS = [
  { days: 7,   label: 'Weekly' },
  { days: 14,  label: 'Every 2 weeks' },
  { days: 30,  label: 'Monthly' },
  { days: 60,  label: 'Every 2 months' },
  { days: 90,  label: 'Quarterly' },
  { days: 180, label: 'Twice a year' },
]

export const DEFAULT_REVISIT_EVERY = 30

/** Tolerant of goals written before statuses existed. */
export function statusOf(goal) {
  const s = goal?.status
  if (s === STATUS.ACTIVE || s === STATUS.REVISIT || s === STATUS.DONE) return s
  return goal?.archived ? STATUS.DONE : STATUS.ACTIVE
}

export const isActive = (g) => statusOf(g) === STATUS.ACTIVE
export const isRevisit = (g) => statusOf(g) === STATUS.REVISIT
export const isDone = (g) => statusOf(g) === STATUS.DONE
/** Still gets nudged: active goals and goals kept warm on a revisit interval. */
export const inPlay = (g) => statusOf(g) !== STATUS.DONE

export const revisitEvery = (g) =>
  Math.max(1, Math.round(Number(g?.revisitEvery) || DEFAULT_REVISIT_EVERY))

export const STATUS_LABELS = {
  [STATUS.ACTIVE]: 'Active',
  [STATUS.REVISIT]: 'Revisit',
  [STATUS.DONE]: 'Archived',
}

export function revisitLabel(days) {
  const preset = REVISIT_PRESETS.find((p) => p.days === days)
  return preset ? preset.label : `Every ${days} days`
}

/** Move a goal to a new state, keeping the compat fields honest.
    `completedAt` records the first completion and survives a later reopen —
    it's history, not state. */
export function withStatus(goal, status, patch = {}) {
  const finished = status === STATUS.DONE || status === STATUS.REVISIT
  return {
    ...goal,
    ...patch,
    status,
    archived: status === STATUS.DONE,
    completedAt: finished ? goal.completedAt || new Date().toISOString() : goal.completedAt || null,
  }
}

export { ICON_CHOICES } from './goalIcons.jsx'

export function unitFor(goal) {
  const preset = UNIT_PRESETS.find((u) => u.id === goal.unitId) || UNIT_PRESETS[0]
  return {
    ...preset,
    ...(goal.unitId === 'custom' ? { one: goal.unitOne || 'unit', many: goal.unitMany || 'units', abbr: '' } : {}),
    step: goal.unitStep ?? preset.step,
    precision: goal.unitPrecision ?? preset.precision,
  }
}

export function formatAmount(value, unit) {
  const n = Number(value) || 0
  const fixed = n.toFixed(unit.precision)
  const trimmed = unit.precision > 0 ? String(parseFloat(fixed)) : fixed
  return Number(trimmed).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: unit.precision,
  })
}

export function unitWord(value, unit) {
  return Math.abs(Number(value)) === 1 ? unit.one : unit.many
}

/** "12.5 hours" — the value with its unit spelled out. */
export function withUnit(value, unit) {
  return `${formatAmount(value, unit)} ${unitWord(value, unit)}`
}

export function newGoal(index = 0) {
  return {
    id: crypto.randomUUID(),
    name: '',
    category: '',
    emoji: ICON_CHOICES[index % ICON_CHOICES.length],
    colorSlot: (index % 8) + 1,
    unitId: 'hours',
    unitOne: '',
    unitMany: '',
    unitStep: null,
    unitPrecision: null,
    cadence: 'week',
    target: 5,
    why: '',
    status: STATUS.ACTIVE,
    archived: false,
    revisitEvery: DEFAULT_REVISIT_EVERY,
    completedAt: null,
    createdAt: new Date().toISOString(),
  }
}

/** Fill in fields a goal from an older save (or an older backup) won't have. */
export function migrateGoal(goal) {
  return {
    ...goal,
    emoji: normaliseIconId(goal.emoji),
    status: statusOf(goal),
    archived: statusOf(goal) === STATUS.DONE,
    revisitEvery: goal.revisitEvery ?? DEFAULT_REVISIT_EVERY,
    completedAt: goal.completedAt ?? null,
  }
}

export function newEntry(goalId, dateKey, amount, note = '', taskId = null) {
  return {
    id: crypto.randomUUID(),
    goalId,
    date: dateKey,
    amount: Number(amount) || 0,
    note,
    taskId,
    loggedAt: new Date().toISOString(),
  }
}

/* ------------------------------------------------------------------ tasks */

/* A task is one concrete thing you mean to do for a goal — "read chapter 4",
   "run the 5k loop". It carries the amount it's worth, so ticking it off logs
   that amount against the goal and the goal moves. Tasks never invent progress
   of their own: everything they add is an ordinary entry, visible and
   deletable like any other, and untick removes it again.

   `amount: 0` is allowed and means "a step with no measurable size" — it gets
   checked off without touching the goal's numbers. */
export function newTask(goalId, title, amount, order = 0) {
  return {
    id: crypto.randomUUID(),
    goalId,
    title: String(title || '').trim(),
    amount: Math.max(0, Number(amount) || 0),
    done: false,
    order,
    entryId: null,          // the entry this task created, so untick can undo it
    createdAt: new Date().toISOString(),
    completedAt: null,
  }
}

/** Fill in fields a task from an older save won't have. */
export function migrateTask(task, index = 0) {
  return {
    ...task,
    title: String(task.title || '').trim(),
    amount: Math.max(0, Number(task.amount) || 0),
    done: !!task.done,
    order: Number.isFinite(task.order) ? task.order : index,
    entryId: task.entryId ?? null,
    completedAt: task.completedAt ?? null,
  }
}

/** Put a finished task back on the list, forgetting the entry it made. */
export const reopenTask = (task) => ({ ...task, done: false, entryId: null, completedAt: null })

/** goalId → tasks, open first, each group in the order you added them. */
export function indexTasks(tasks) {
  const byGoal = new Map()
  for (const t of tasks) {
    let list = byGoal.get(t.goalId)
    if (!list) { list = []; byGoal.set(t.goalId, list) }
    list.push(t)
  }
  for (const list of byGoal.values()) list.sort(taskOrder)
  return byGoal
}

/** Open before done; within each, by the order they were added. */
export function taskOrder(a, b) {
  if (a.done !== b.done) return a.done ? 1 : -1
  if (a.done) return (b.completedAt || '').localeCompare(a.completedAt || '')
  return (a.order ?? 0) - (b.order ?? 0) || (a.createdAt || '').localeCompare(b.createdAt || '')
}

export const DEFAULT_SETTINGS = {
  theme: 'system',       // 'system' | 'light' | 'dark'
  currency: 'GBP',       // what savings pots are counted in
  weekStart: 1,          // 0 Sun, 1 Mon
  recencyWeight: 50,     // 0–100; deficit weight is the complement
  staleAfterDays: 4,     // a goal starts feeling neglected after this long
  heatmapWeeks: 27,
  showTables: false,
}
