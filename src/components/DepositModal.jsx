import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import { todayKey, addDays, formatLong } from '../lib/date.js'
import { currencySymbol, formatMoney, potStats, toMoney } from '../lib/savings.js'

const QUICK = [10, 25, 50, 100]

/* Putting money in, and taking it back out. Both are the same record — a
   withdrawal is just a negative one — so the pot's balance is always the sum
   of a list you can see and correct, never a number the app keeps for you. */
export default function DepositModal({ pots, byPot, potId, currency, onSave, onClose }) {
  const [pid, setPid] = useState(potId || pots[0]?.id)
  const [when, setWhen] = useState(todayKey())
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [out, setOut] = useState(false)

  const pot = pots.find((p) => p.id === pid) || pots[0]
  const stats = useMemo(
    () => (pot ? potStats(pot, byPot.get(pot.id) || []) : null),
    [pot, byPot],
  )

  useEffect(() => { setAmount(''); setOut(false) }, [pid])

  if (!pot) return null

  const value = toMoney(amount)
  const tooMuch = out && value > stats.saved
  const valid = isFinite(value) && value > 0 && !tooMuch

  const presets = out
    ? QUICK.filter((v) => v <= stats.saved)
    : QUICK.filter((v) => stats.remaining <= 0 || v < stats.remaining)

  const submit = () => {
    if (!valid) return
    onSave({ potId: pid, date: when, amount: out ? -value : value, note: note.trim() })
  }

  const after = toMoney(stats.saved + (out ? -value : value))

  return (
    <Modal
      title={out ? 'Take money out' : 'Add money'}
      width={480}
      onClose={onClose}
      footer={
        <>
          <span className="hint" style={{ marginRight: 'auto' }}>⌘↵ to save</span>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={!valid}>
            {out ? 'Take it out' : 'Add it'}
          </button>
        </>
      }
    >
      <div
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
        style={{ display: 'contents' }}
      >
        <div className="field">
          <label htmlFor="d-pot">Saving for</label>
          <select id="d-pot" className="input" value={pid} onChange={(e) => setPid(e.target.value)}>
            {pots.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <span className="label">Direction</span>
          <div className="seg">
            <button aria-pressed={!out} onClick={() => setOut(false)}>Put in</button>
            <button aria-pressed={out} onClick={() => setOut(true)}>Take out</button>
          </div>
        </div>

        <div className="field">
          <label htmlFor="d-amt">How much?</label>
          <div className="money-input">
            {currencySymbol(currency) && (
              <span className="money-symbol" aria-hidden="true">{currencySymbol(currency)}</span>
            )}
            <input
              id="d-amt"
              className="input"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={amount}
              placeholder="0"
              onChange={(e) => setAmount(e.target.value)}
              style={{ fontWeight: 600, fontSize: 17 }}
            />
          </div>
          <div className="chip-row" style={{ marginTop: 2 }}>
            {presets.map((p) => (
              <button
                key={p}
                className="chip-btn"
                aria-pressed={value === p}
                onClick={() => setAmount(String(p))}
              >
                {formatMoney(p, currency)}
              </button>
            ))}
            {!out && stats.remaining > 0 && (
              <button
                className="chip-btn"
                aria-pressed={value === stats.remaining}
                onClick={() => setAmount(String(stats.remaining))}
              >
                The rest, {formatMoney(stats.remaining, currency)}
              </button>
            )}
            {out && stats.saved > 0 && (
              <button
                className="chip-btn"
                aria-pressed={value === stats.saved}
                onClick={() => setAmount(String(stats.saved))}
              >
                All of it, {formatMoney(stats.saved, currency)}
              </button>
            )}
          </div>
          <span className="hint" style={{ color: tooMuch ? 'var(--error-text)' : undefined }}>
            {tooMuch
              ? `There is only ${formatMoney(stats.saved, currency)} in ${pot.name}.`
              : value > 0
                ? `${pot.name} goes to ${formatMoney(after, currency)}${
                    stats.target > 0 ? ` of ${formatMoney(stats.target, currency)}` : ''
                  }.`
                : `${formatMoney(stats.saved, currency)} in ${pot.name} so far.`}
          </span>
        </div>

        <div className="field">
          <label htmlFor="d-date">When</label>
          <input
            id="d-date"
            className="input"
            type="date"
            value={when}
            max={todayKey()}
            onChange={(e) => setWhen(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
            <button className="btn btn-sm" onClick={() => setWhen(todayKey())}>Today</button>
            <button className="btn btn-sm" onClick={() => setWhen(addDays(todayKey(), -1))}>Yesterday</button>
            <span className="hint" style={{ alignSelf: 'center', marginLeft: 4 }}>{formatLong(when)}</span>
          </div>
        </div>

        <div className="field">
          <label htmlFor="d-note">Note <span className="hint">(optional)</span></label>
          <input
            id="d-note"
            className="input"
            value={note}
            placeholder={out ? 'Needed it for the MOT' : 'Payday, birthday money…'}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  )
}
