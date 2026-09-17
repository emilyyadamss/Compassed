import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import { todayKey, addDays, formatLong } from '../lib/date.js'
import { colorVar, unitFor, unitWord, formatAmount } from '../lib/model.js'

export default function LogModal({ goals, goalId, date, onSave, onClose }) {
  const [gid, setGid] = useState(goalId || goals[0]?.id)
  const [when, setWhen] = useState(date || todayKey())
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  const goal = goals.find((g) => g.id === gid) || goals[0]
  const unit = goal ? unitFor(goal) : null

  useEffect(() => {
    if (goal && amount === '') setAmount(String(unitFor(goal).step))
  }, [gid]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!goal) return null

  const value = Number(amount)
  const valid = isFinite(value) && value > 0
  const bump = (dir) => {
    const next = Math.max(0, (Number(amount) || 0) + dir * unit.step)
    setAmount(String(unit.precision === 0 ? Math.round(next) : Number(next.toFixed(2))))
  }

  const submit = () => {
    if (!valid) return
    onSave({ goalId: gid, date: when, amount: value, note: note.trim() })
  }

  const presets = [unit.step, unit.step * 2, unit.step * 4].filter((v, i, a) => a.indexOf(v) === i)

  return (
    <Modal
      title="Log progress"
      width={480}
      onClose={onClose}
      footer={
        <>
          <span className="hint" style={{ marginRight: 'auto' }}>⌘↵ to save</span>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={!valid}>Log it</button>
        </>
      }
    >
      {/* A keyboard-only shortcut wrapper (⌘↵ to submit) — it adds no
          mouse-driven behaviour that a keyboard user would miss. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
        style={{ display: 'contents' }}
      >
        <div className="field">
          <label htmlFor="l-goal">Goal</label>
          <select id="l-goal" className="input" value={gid} onChange={(e) => { setGid(e.target.value); setAmount('') }}>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="l-amt">How much? <span className="hint">({unit.many})</span></label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-icon" onClick={() => bump(-1)} aria-label={`Less by ${unit.step}`}>−</button>
            <input
              id="l-amt"
              className="input"
              type="number"
              min="0"
              step={unit.step}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ textAlign: 'center', fontWeight: 600, fontSize: 17 }}
            />
            <button className="btn btn-icon" onClick={() => bump(1)} aria-label={`More by ${unit.step}`}>+</button>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
            {presets.map((p) => (
              <button
                key={p}
                className="btn btn-sm"
                onClick={() => setAmount(String(p))}
                style={{
                  borderColor: Number(amount) === p ? colorVar(goal.colorSlot) : undefined,
                }}
              >
                {formatAmount(p, unit)} {unit.abbr || unitWord(p, unit)}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="l-date">When</label>
          <input
            id="l-date"
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
          <label htmlFor="l-note">Note <span className="hint">(optional)</span></label>
          <textarea
            id="l-note"
            className="input"
            value={note}
            placeholder="Finished chapter 4, shadowing drills…"
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  )
}
