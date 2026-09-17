import { useMemo, useState } from 'react'
import { colorVar, unitFor, formatAmount, unitWord, statusOf, STATUS } from '../lib/model.js'
import { todayKey, addDays, daysBetween, formatLong, formatTime } from '../lib/date.js'
import { GoalIcon } from '../lib/goalIcons.jsx'

/* The whole log, newest first — the place to go when something was entered
   twice, against the wrong goal, or with the wrong number. Nothing here is
   scored or nudged; it is the raw record, and any row can be taken back out.

   Deleting is two-tap on purpose. In a goal's own page you are looking at one
   goal's trail and the row you mean is obvious; here the rows are alike and a
   stray click would delete work you can't get back. */

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 0, label: 'All' },
]

export default function ActivityView({ goals, entries, onDelete, onOpen, onLog }) {
  const [range, setRange] = useState(30)
  const [goalId, setGoalId] = useState('all')
  const [query, setQuery] = useState('')
  /* The row whose Delete is armed. One at a time — arming another disarms it. */
  const [confirming, setConfirming] = useState(null)

  const today = todayKey()
  const goalById = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals])

  /* Goals that have ever been logged against, so the picker doesn't list
     goals whose rows could never appear. Archived ones stay: their history is
     just as editable as anyone else's. */
  const logged = useMemo(() => {
    const ids = new Set(entries.map((e) => e.goalId))
    return goals.filter((g) => ids.has(g.id))
  }, [goals, entries])

  const rows = useMemo(() => {
    const from = range > 0 ? addDays(today, -(range - 1)) : ''
    const q = query.trim().toLowerCase()
    return entries
      .filter((e) => {
        if (range > 0 && e.date < from) return false
        if (goalId !== 'all' && e.goalId !== goalId) return false
        if (!q) return true
        const name = goalById.get(e.goalId)?.name || ''
        return (e.note || '').toLowerCase().includes(q) || name.toLowerCase().includes(q)
      })
      .sort((a, b) => (b.date === a.date
        ? (b.loggedAt || '').localeCompare(a.loggedAt || '')
        : b.date.localeCompare(a.date)))
  }, [entries, range, goalId, query, today, goalById])

  /* [dateKey, entries] in the order they already sit in — `rows` is sorted by
     date, so a day's rows are always contiguous. */
  const days = useMemo(() => {
    const out = []
    for (const e of rows) {
      const last = out[out.length - 1]
      if (last && last[0] === e.date) last[1].push(e)
      else out.push([e.date, [e]])
    }
    return out
  }, [rows])

  const remove = (id) => {
    onDelete(id)
    setConfirming(null)
  }

  if (entries.length === 0) {
    return (
      <div className="empty">
        <h3>Nothing logged yet</h3>
        <p>
          Every bit of progress you log shows up here, newest first — so a number typed in
          wrong, or against the wrong goal, is always easy to find and take back out.
        </p>
        <button className="btn btn-primary" onClick={() => onLog()}>Log progress</button>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="log-filters">
          <div className="seg" role="group" aria-label="Time range">
            {RANGES.map((r) => (
              <button
                key={r.days}
                aria-pressed={range === r.days}
                onClick={() => { setRange(r.days); setConfirming(null) }}
              >
                {r.label}
              </button>
            ))}
          </div>

          <select
            className="input log-pick"
            aria-label="Filter by goal"
            value={goalId}
            onChange={(e) => { setGoalId(e.target.value); setConfirming(null) }}
          >
            <option value="all">All goals</option>
            {logged.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}{statusOf(g) === STATUS.DONE ? ' (archived)' : ''}
              </option>
            ))}
          </select>

          <input
            className="input log-search"
            type="search"
            placeholder="Search notes…"
            aria-label="Search notes"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setConfirming(null) }}
          />

          <span className="hint" style={{ marginLeft: 'auto' }}>
            {rows.length} of {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <p className="hint" style={{ textAlign: 'center', padding: '18px 0' }}>
            No entries match. Try a wider range or clear the search.
          </p>
        </div>
      ) : (
        days.map(([date, items]) => (
          <div key={date}>
            <div className="cat-head">
              <h3>{dayLabel(date, today)}</h3>
              <span className="count">
                {items.length} {items.length === 1 ? 'entry' : 'entries'}
              </span>
              <span className="rule" />
            </div>
            <div className="card">
              {items.map((e) => (
                <LogRow
                  key={e.id}
                  entry={e}
                  goal={goalById.get(e.goalId)}
                  armed={confirming === e.id}
                  onArm={() => setConfirming(e.id)}
                  onDisarm={() => setConfirming(null)}
                  onConfirm={() => remove(e.id)}
                  onOpen={onOpen}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function dayLabel(key, today) {
  const ago = daysBetween(key, today)
  if (ago === 0) return 'Today'
  if (ago === 1) return 'Yesterday'
  return formatLong(key)
}

/* A goal deleted while its entries survived — only reachable from a hand-edited
   or partial backup, but the row still has to be removable, so it renders. */
function LogRow({ entry, goal, armed, onArm, onDisarm, onConfirm, onOpen }) {
  const unit = goal ? unitFor(goal) : null
  const amount = unit
    ? `${formatAmount(entry.amount, unit)} ${unit.abbr || unitWord(entry.amount, unit)}`
    : String(entry.amount)

  return (
    <div
      className={`entry-row log-row${armed ? ' is-armed' : ''}`}
      style={{ '--goal-color': goal ? colorVar(goal.colorSlot) : 'var(--text-muted)' }}
    >
      {goal ? (
        <button className="log-goal" onClick={() => onOpen(goal.id)} title={`Open ${goal.name}`}>
          <span className="dot" />
          <GoalIcon id={goal.emoji} size={13} style={{ flex: 'none' }} />
          <span className="n">{goal.name}</span>
        </button>
      ) : (
        <span className="log-goal is-orphan"><span className="dot" /><span className="n">Deleted goal</span></span>
      )}

      <span className="e-amt">{amount}</span>
      <span className="e-note">
        {entry.note || <span style={{ color: 'var(--text-muted)' }}>—</span>}
      </span>

      {entry.taskId && (
        <span className="badge log-tag" title="Logged by ticking a step off — deleting this puts that step back on the list">
          ↩ step
        </span>
      )}
      <span className="log-time">{formatTime(entry.loggedAt)}</span>

      {armed ? (
        <span className="log-confirm">
          {/* Focus follows the confirmation into view — moving it here is the
              accessible behaviour, not a violation of it. */}
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <button className="btn btn-sm btn-danger" onClick={onConfirm} autoFocus>
            Delete
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onDisarm}>Cancel</button>
        </span>
      ) : (
        <button
          className="btn btn-ghost btn-sm e-del btn-danger"
          onClick={onArm}
          aria-label={`Delete ${goal ? `${goal.name} ` : ''}entry of ${amount}`}
        >
          Delete
        </button>
      )}
    </div>
  )
}
