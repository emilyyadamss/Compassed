import { useMemo, useState } from 'react'
import { colorVar } from '../lib/model.js'
import {
  SAVINGS_STATUS, formatMoney, isBought, paceLabel, potStats,
} from '../lib/savings.js'
import { formatShort, formatLong, formatTime, dayKeyOf, relativeDays, todayKey } from '../lib/date.js'
import { GoalIcon } from '../lib/goalIcons.jsx'

/* One pot, in full: where the money is, and every payment that got it there.
   The history is the pot — nothing is stored as a total, so deleting a wrong
   payment here is all it takes to make the balance right again. */
export default function SavingsDetail({
  pot, deposits = [], currency, onEdit, onDeposit, onDeleteDeposit, onSetStatus, onBack,
}) {
  const color = colorVar(pot.colorSlot)
  const stats = useMemo(() => potStats(pot, deposits, todayKey()), [pot, deposits])
  const bought = isBought(pot)
  const pct = stats.pct == null ? null : Math.round(stats.pct)
  const pace = bought ? null : paceLabel(stats)
  const boughtOn = pot.boughtAt ? formatShort(dayKeyOf(pot.boughtAt)) : null

  const [showAll, setShowAll] = useState(false)
  const [confirming, setConfirming] = useState(null)
  const shown = showAll ? deposits : deposits.slice(0, 12)

  return (
    <>
      <div className="page-head">
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0 }}>
          <span
            className="goal-emoji"
            style={{ '--goal-color': color, width: 46, height: 46, borderRadius: 999 }}
            aria-hidden="true"
          >
            <GoalIcon id={pot.icon} size={22} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 className="page-title">{pot.name}</h1>
              {bought && <span className="badge">✓ Bought</span>}
              {!bought && stats.funded && <span className="badge">Ready to buy</span>}
            </div>
            <p className="page-sub">
              {stats.target > 0
                ? `${formatMoney(stats.saved, currency)} of ${formatMoney(stats.target, currency)}`
                : `${formatMoney(stats.saved, currency)} put away · no price set`}
              {bought && boughtOn ? ` · bought ${boughtOn}` : ''}
              {pot.note ? ` · ${pot.note}` : ''}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={onBack}>← All savings</button>
          <button className="btn" onClick={() => onEdit(pot)}>Edit</button>
          {bought ? (
            <button className="btn btn-primary" onClick={() => onSetStatus(pot.id, SAVINGS_STATUS.SAVING)}>
              Back to saving
            </button>
          ) : (
            <>
              {stats.funded && (
                <button className="btn" onClick={() => onSetStatus(pot.id, SAVINGS_STATUS.BOUGHT)}>
                  ✓ Bought it
                </button>
              )}
              <button className="btn btn-primary" onClick={() => onDeposit(pot.id)}>Add money</button>
            </>
          )}
        </div>
      </div>

      <div className="stack">
        <div className="card" style={{ '--goal-color': color }}>
          <div className="card-head">
            <div>
              <div className="card-title">
                {stats.target > 0
                  ? stats.funded
                    ? bought ? 'Saved for and bought' : 'Fully saved for'
                    : `${formatMoney(stats.remaining, currency)} to go`
                  : 'No price set'}
              </div>
              <div className="card-sub">
                {stats.target > 0
                  ? pace || 'Put money in and an estimate appears once there’s a week of history'
                  : 'Add what it costs and this fills up as you save'}
              </div>
            </div>
            {pct != null && <span className="pot-pct">{pct}%</span>}
          </div>

          {stats.target > 0 && (
            <div className={`meter meter-tall${bought ? ' meter-quiet' : ''}`}>
              <i style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
          )}

          <div className="kpi-row" style={{ marginTop: 4 }}>
            <div className="stat">
              <div className="k">In the pot</div>
              <div className="v">{formatMoney(stats.saved, currency)}</div>
              <div className="d">
                {stats.takenOut > 0
                  ? `${formatMoney(stats.paidIn, currency)} in, ${formatMoney(stats.takenOut, currency)} back out`
                  : `over ${stats.count} ${stats.count === 1 ? 'payment' : 'payments'}`}
              </div>
            </div>
            <div className="stat">
              <div className="k">Still to find</div>
              <div className="v">{stats.target > 0 ? formatMoney(stats.remaining, currency) : '—'}</div>
              <div className="d">{stats.target > 0 ? `of ${formatMoney(stats.target, currency)}` : 'no price set'}</div>
            </div>
            <div className="stat">
              <div className="k">Going in</div>
              <div className="v">{stats.perWeek ? formatMoney(stats.perWeek, currency) : '—'}</div>
              <div className="d">{stats.perWeek ? 'a week, on average' : 'not enough history yet'}</div>
            </div>
            <div className="stat">
              <div className="k">Last payment</div>
              <div className="v" style={{ fontSize: 20 }}>
                {stats.last ? formatShort(stats.last) : '—'}
              </div>
              <div className="d">{stats.last ? relativeDays(stats.daysSince) : 'nothing in yet'}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Payments</div>
              <div className="card-sub">
                Every amount in and out, newest first. Put one in by mistake? Take it back off here.
              </div>
            </div>
            <span className="hint">{deposits.length} {deposits.length === 1 ? 'payment' : 'payments'}</span>
          </div>

          {deposits.length === 0 ? (
            <p className="hint" style={{ textAlign: 'center', padding: '18px 0' }}>
              Nothing in yet. Add the first amount and the bar starts moving.
            </p>
          ) : (
            <>
              {shown.map((d) => {
                const armed = confirming === d.id
                const money = formatMoney(Math.abs(d.amount), currency)
                return (
                  <div key={d.id} className={`entry-row${armed ? ' is-armed' : ''}`}>
                    <span className="e-date" title={formatLong(d.date)}>{formatShort(d.date)}</span>
                    <span className={`e-amt${d.amount < 0 ? ' is-out' : ''}`}>
                      {d.amount < 0 ? `− ${money}` : `+ ${money}`}
                    </span>
                    <span className="e-note">
                      {d.note || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </span>
                    <span className="log-time">{formatTime(d.loggedAt)}</span>
                    {armed ? (
                      <span className="log-confirm">
                        {/* Focus follows the confirmation into view — moving it
                            here is the accessible behaviour, not a violation. */}
                        {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                        <button autoFocus
                          className="btn btn-sm btn-danger"
                          onClick={() => { onDeleteDeposit(d.id); setConfirming(null) }}
                        >
                          Delete
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(null)}>
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        className="btn btn-ghost btn-sm btn-danger e-del"
                        onClick={() => setConfirming(d.id)}
                        aria-label={`Delete payment of ${money} on ${formatLong(d.date)}`}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )
              })}
              {deposits.length > 12 && (
                <button
                  className="btn btn-sm"
                  style={{ marginTop: 12 }}
                  onClick={() => setShowAll((v) => !v)}
                >
                  {showAll ? 'Show recent only' : `Show all ${deposits.length}`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
