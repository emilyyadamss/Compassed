import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import Modal from './Modal.jsx'
import { COLOR_SLOTS, colorVar } from '../lib/model.js'
import {
  SAVINGS_STATUS, currencySymbol, formatMoney, statusOfPot, toMoney, withPotStatus,
} from '../lib/savings.js'
import { SAVINGS_ICON_CHOICES, GoalIcon } from '../lib/goalIcons.jsx'

export default function SavingsEditor({ pot, isNew, currency, saved = 0, onSave, onDelete, onClose }) {
  // A price of 0 shows as an empty field: typing a number into a box already
  // holding "0" is a small, avoidable annoyance.
  const [draft, setDraft] = useState(() => ({ ...pot, target: pot.target || '' }))
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))
  const valid = draft.name.trim().length > 0
  const target = Math.max(0, toMoney(draft.target))
  const status = statusOfPot(draft)

  const submit = () => {
    if (!valid) return
    onSave({ ...draft, name: draft.name.trim(), note: (draft.note || '').trim(), target })
  }

  return (
    <Modal
      title={isNew ? 'New savings goal' : 'Edit savings goal'}
      onClose={onClose}
      footer={
        <>
          {!isNew && (
            <button
              className="btn btn-ghost btn-danger btn-icon"
              onClick={() => onDelete(draft.id)}
              aria-label="Delete savings goal"
              title="Delete savings goal"
              style={{ marginRight: 'auto' }}
            >
              <Trash2 size={16} />
            </button>
          )}
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={!valid}>
            {isNew ? 'Start saving' : 'Save changes'}
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="s-name">What are you saving for?</label>
        <input
          id="s-name"
          className="input"
          value={draft.name}
          placeholder="New laptop, car, house..."
          onChange={(e) => set({ name: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter' && valid) submit() }}
        />
      </div>

      <div className="field">
        <label htmlFor="s-target">What does it cost?</label>
        <div className="money-input">
          <span className="money-symbol" aria-hidden="true">{currencySymbol(currency)}</span>
          <input
            id="s-target"
            className="input"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={draft.target}
            onChange={(e) => set({ target: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter' && valid) submit() }}
          />
        </div>
        <span className="hint">
          {target > 0
            ? `${formatMoney(target, currency)} to find${saved > 0 ? ` · ${formatMoney(saved, currency)} already in` : ''}. A rough price is fine, you can change it later.`
            : 'Leave it at 0 if you don’t know the price yet, the pot still adds up what you put in, it just has nothing to fill.'}
        </span>
      </div>

      <div className="field">
        <label htmlFor="s-note">Why it matters <span className="hint">(optional)</span></label>
        <input
          id="s-note"
          className="input"
          value={draft.note || ''}
          placeholder="Replacing the one that keeps dying mid-call"
          onChange={(e) => set({ note: e.target.value })}
        />
      </div>

      <div className="field">
        <span className="label">Colour</span>
        <div className="swatch-picker">
          {COLOR_SLOTS.map((c) => (
            <button
              key={c.slot}
              aria-pressed={draft.colorSlot === c.slot}
              aria-label={c.name}
              title={c.name}
              style={{ background: colorVar(c.slot), '--sw': colorVar(c.slot) }}
              onClick={() => set({ colorSlot: c.slot })}
            />
          ))}
        </div>
      </div>

      <div className="field">
        <span className="label">Icon</span>
        <div className="emoji-picker">
          {SAVINGS_ICON_CHOICES.map((id) => (
            <button key={id} aria-pressed={draft.icon === id} aria-label={`Icon ${id}`} onClick={() => set({ icon: id })}>
              <GoalIcon id={id} size={16} />
            </button>
          ))}
        </div>
      </div>

      {!isNew && (
        <div className="field">
          <span className="label">State</span>
          <div className="seg">
            <button
              aria-pressed={status === SAVINGS_STATUS.SAVING}
              onClick={() => set(withPotStatus(draft, SAVINGS_STATUS.SAVING))}
            >
              Saving
            </button>
            <button
              aria-pressed={status === SAVINGS_STATUS.BOUGHT}
              onClick={() => set(withPotStatus(draft, SAVINGS_STATUS.BOUGHT))}
            >
              Bought
            </button>
          </div>
          <span className="hint">
            {status === SAVINGS_STATUS.BOUGHT
              ? 'Filed away as bought. It keeps every payment you made, and stops counting towards what you still need.'
              : 'Still filling up. It counts towards the totals at the top of the page.'}
          </span>
        </div>
      )}
    </Modal>
  )
}
