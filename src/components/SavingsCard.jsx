import { colorVar } from '../lib/model.js'
import { formatMoney, paceLabel, isBought } from '../lib/savings.js'
import { relativeDays } from '../lib/date.js'
import { GoalIcon } from '../lib/goalIcons.jsx'

/* One thing you are saving for. The meter is the whole point of the card:
   where the money is against what the thing costs, in one glance. */
export default function SavingsCard({ pot, stats, currency, onOpen, onDeposit, onBought }) {
  const color = colorVar(pot.colorSlot)
  const pct = stats.pct == null ? null : Math.round(stats.pct)
  const bought = isBought(pot)
  const pace = bought ? null : paceLabel(stats)

  return (
    <div className={`goal-card${bought ? ' is-bought' : ''}`} style={{ '--goal-color': color }}>
      <button className="goal-card-top" onClick={() => onOpen(pot.id)} style={{ width: '100%' }}>
        <span className="goal-emoji" aria-hidden="true"><GoalIcon id={pot.icon} /></span>
        <span style={{ minWidth: 0, textAlign: 'left' }}>
          <span className="goal-card-name" style={{ display: 'block' }}>
            {pot.name}
            {bought && <span className="badge" style={{ marginLeft: 8 }}>✓ Bought</span>}
          </span>
          <span className="goal-card-meta">
            {stats.count === 0
              ? 'Nothing put in yet'
              : `${stats.count} ${stats.count === 1 ? 'payment' : 'payments'} · last ${relativeDays(stats.daysSince)}`}
          </span>
        </span>
        <span className="goal-card-val">
          <span className="n">{formatMoney(stats.saved, currency)}</span>
          <span className="u" style={{ display: 'block' }}>
            {stats.target > 0 ? `of ${formatMoney(stats.target, currency)}` : 'put away'}
          </span>
        </span>
      </button>

      {stats.target > 0 && (
        <div>
          <div className="meter-row">
            <span>{pct}% saved</span>
            <b>
              {stats.funded
                ? bought ? 'bought' : 'ready to buy'
                : `${formatMoney(stats.remaining, currency)} to go`}
            </b>
          </div>
          <div className={`meter${bought ? ' meter-quiet' : ''}`}>
            <i style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span className="hint" style={{ minWidth: 0 }}>
          {bought
            ? 'Saved for and bought'
            : pace || (stats.target > 0 ? 'Add a bit and the estimate follows' : 'No price set')}
        </span>
        <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
          {!bought && stats.funded && onBought && (
            <button className="btn btn-ghost btn-sm" onClick={() => onBought(pot)}>✓ Bought it</button>
          )}
          {!bought && (
            <button className="btn btn-sm" onClick={() => onDeposit(pot.id)}>Add money</button>
          )}
        </div>
      </div>
    </div>
  )
}
