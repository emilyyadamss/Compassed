import { useMemo } from 'react'
import SavingsCard from '../components/SavingsCard.jsx'
import { formatMoney, potStats, savingsSummary, isSaving, isBought } from '../lib/savings.js'
import { todayKey } from '../lib/date.js'

/* Everything you are saving up for. Pots are listed in the order they were
   started, with bought ones dropped underneath — the list is a shelf, not a
   queue, and nothing here is scored or nudged. */
export default function SavingsView({ pots, byPot, currency, onOpen, onDeposit, onNewPot, onBought }) {
  const today = todayKey()
  const rows = useMemo(
    () => pots.map((pot) => ({ pot, stats: potStats(pot, byPot.get(pot.id) || [], today) })),
    [pots, byPot, today],
  )
  const saving = rows.filter((r) => isSaving(r.pot))
  const bought = rows.filter((r) => isBought(r.pot))
  const summary = useMemo(() => savingsSummary(pots, byPot, today), [pots, byPot, today])

  if (pots.length === 0) {
    return (
      <div className="empty">
        <h3>Nothing on the list yet</h3>
        <p>
          Add the thing you are saving up for. A car, a laptop, a trip, with what it costs.
          Then put money in whenever you put money aside, and the bar tells you how close it is.
        </p>
        <button className="btn btn-primary" onClick={onNewPot}>Add something to save for</button>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="kpi-row">
        <div className="stat">
          <div className="k">Put away</div>
          <div className="v">{formatMoney(summary.saved, currency)}</div>
          <div className="d">
            across {pots.length} {pots.length === 1 ? 'thing' : 'things'}
            {bought.length > 0 ? `, ${bought.length} already bought` : ''}
          </div>
        </div>
        <div className="stat">
          <div className="k">Still to find</div>
          <div className="v">{formatMoney(summary.remaining, currency)}</div>
          <div className="d">
            {summary.target > 0
              ? `of ${formatMoney(summary.target, currency)} in prices`
              : 'no prices set yet'}
          </div>
        </div>
        <div className="stat">
          <div className="k">Ready to buy</div>
          <div className="v">{summary.funded}</div>
          <div className="d">
            {summary.funded > 0
              ? `${summary.funded === 1 ? 'one is' : 'these are'} fully saved for`
              : 'nothing fully saved for yet'}
          </div>
        </div>
      </div>

      <div className="grid-cards">
        {saving.map(({ pot, stats }) => (
          <SavingsCard
            key={pot.id}
            pot={pot}
            stats={stats}
            currency={currency}
            onOpen={onOpen}
            onDeposit={onDeposit}
            onBought={onBought}
          />
        ))}
      </div>

      {bought.length > 0 && (
        <>
          <div className="cat-head">
            <h3>Bought</h3>
            <span className="count">{bought.length}</span>
            <span className="rule" />
          </div>
          <div className="grid-cards">
            {bought.map(({ pot, stats }) => (
              <SavingsCard
                key={pot.id}
                pot={pot}
                stats={stats}
                currency={currency}
                onOpen={onOpen}
                onDeposit={onDeposit}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
