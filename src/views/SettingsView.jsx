import { useRef, useState } from 'react'
import { colorVar } from '../lib/model.js'
import { CURRENCIES, currencyLabel, hasCurrency } from '../lib/savings.js'
import { exportJSON, parseImport, download } from '../lib/storage.js'
import { GoalIcon } from '../lib/goalIcons.jsx'

function Row({ title, sub, children }) {
  return (
    <div className="switch">
      <div className="switch-copy">
        <div className="t">{title}</div>
        {sub && <div className="s">{sub}</div>}
      </div>
      {children}
    </div>
  )
}

export default function SettingsView({
  settings, setSettings, state, ranked,
  onImport, onLoadSample, onClearAll, toast, email, onSignOut, onDeleteAccount,
}) {
  const fileRef = useRef(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const w = settings.recencyWeight

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Tune how Compassed decides what to point you at.</p>
        </div>
      </div>

      <div className="stack" style={{ maxWidth: 720 }}>
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Account</div>
              <div className="card-sub">Signed in as {email}</div>
            </div>
            <div className="button-row">
              <button className="btn btn-ghost" onClick={onSignOut}>Sign out</button>
              {confirmDelete ? (
                <>
                  <button
                    className="btn btn-danger"
                    disabled={deleting}
                    onClick={async () => {
                      setDeleting(true)
                      try {
                        await onDeleteAccount()
                      } catch (err) {
                        toast(err.message || 'Could not delete your account, try again')
                        setDeleting(false)
                        setConfirmDelete(false)
                      }
                    }}
                  >
                    {deleting ? 'Deleting…' : 'Yes, delete my account'}
                  </button>
                  <button className="btn btn-ghost" disabled={deleting} onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </button>
                </>
              ) : (
                <button className="btn btn-ghost btn-danger" onClick={() => setConfirmDelete(true)}>
                  Delete account
                </button>
              )}
            </div>
          </div>
          {confirmDelete && (
            <p className="hint" style={{ marginTop: 12, color: 'var(--error-text)' }}>
              This permanently deletes your account, all {state.goals.length} goals,{' '}
              {state.entries.length} entries and {(state.pots || []).length} savings goals.
              There's no undo! Export a backup first if you want one.
            </p>
          )}
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title">The nudge</div></div>

          <div className="field" style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
              <span className="label">Longest neglected</span>
              <span className="label">Furthest behind target</span>
            </div>
            <input
              type="range"
              min="0" max="100" step="5"
              value={w}
              onChange={(e) => setSettings({ recencyWeight: Number(e.target.value) })}
              aria-label="Balance between recency and deficit"
            />
            <span className="hint">
              {w >= 70 ? 'Mostly asks “what have I not touched in a while?”'
                : w <= 30 ? 'Mostly asks “what is furthest from its target?”'
                : 'A blend — a goal has to be both quiet and behind to reach the top.'}
              {' '}({w}% recency / {100 - w}% deficit)
            </span>
          </div>

          <div className="field" style={{ marginBottom: 18 }}>
            <span className="label">A goal starts feeling neglected after {settings.staleAfterDays} days</span>
            <input
              type="range"
              min="1" max="14" step="1"
              value={settings.staleAfterDays}
              onChange={(e) => setSettings({ staleAfterDays: Number(e.target.value) })}
              aria-label="Days before a goal counts as stale"
            />
            <span className="hint">
              Lower means daily habits get nudged fast; higher suits goals you work in longer blocks.
            </span>
          </div>

          <div>
            <span className="label" style={{ display: 'block', marginBottom: 8 }}>
              Current order with these settings
            </span>
            {ranked.length === 0 && <span className="hint">No active goals yet.</span>}
            {ranked.map((r, i) => (
              <div key={r.goal.id} className="entry-row">
                <span className="e-date" style={{ width: 26 }}>{i + 1}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <span style={{
                    width: 9, height: 9, borderRadius: 999, flex: 'none',
                    background: colorVar(r.goal.colorSlot),
                  }} />
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    <GoalIcon id={r.goal.emoji} size={13} style={{ flex: 'none' }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.goal.name}
                    </span>
                  </span>
                </span>
                <span className="hint" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  score {r.score.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title">Appearance</div></div>

          <Row title="Theme" sub="Follows your system by default">
            <div className="seg">
              {['system', 'light', 'dark'].map((t) => (
                <button key={t} aria-pressed={settings.theme === t} onClick={() => setSettings({ theme: t })}>
                  {t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </Row>

          <Row title="Week starts on">
            <div className="seg">
              <button aria-pressed={settings.weekStart === 1} onClick={() => setSettings({ weekStart: 1 })}>Monday</button>
              <button aria-pressed={settings.weekStart === 0} onClick={() => setSettings({ weekStart: 0 })}>Sunday</button>
            </div>
          </Row>

          <Row title="Heatmap length" sub={`${settings.heatmapWeeks} weeks of history`}>
            <div className="seg">
              {[13, 27, 53].map((n) => (
                <button key={n} aria-pressed={settings.heatmapWeeks === n} onClick={() => setSettings({ heatmapWeeks: n })}>
                  {n === 13 ? '3M' : n === 27 ? '6M' : '1Y'}
                </button>
              ))}
            </div>
          </Row>

          <Row
            title="Currency"
            sub={hasCurrency(settings.currency)
              ? 'What savings goals are counted in'
              : 'Not set yet — your first savings goal will ask'}
          >
            <select
              className="input"
              style={{ width: 'auto' }}
              aria-label="Currency"
              value={hasCurrency(settings.currency) ? settings.currency : ''}
              onChange={(e) => setSettings({ currency: e.target.value || null })}
            >
              <option value="">Choose a currency…</option>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{currencyLabel(c)}</option>
              ))}
            </select>
          </Row>

          <Row title="Show data tables" sub="A readable table under every chart, also what screen readers get">
            <button
              className="toggle"
              aria-pressed={settings.showTables}
              aria-label="Show data tables"
              onClick={() => setSettings({ showTables: !settings.showTables })}
            />
          </Row>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Your data</div>
              <div className="card-sub">
                {state.goals.length} goals · {state.entries.length} entries ·{' '}
                {(state.pots || []).length} savings goals · synced to your account
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn"
              onClick={() => {
                download(`compassed-${new Date().toISOString().slice(0, 10)}.json`, exportJSON(state))
                toast('Backup downloaded')
              }}
            >
              Export backup
            </button>

            <button className="btn" onClick={() => fileRef.current?.click()}>Import backup</button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                try {
                  onImport(parseImport(await file.text()))
                  toast('Backup restored')
                } catch (err) {
                  toast(err.message || 'Could not read that file')
                }
                e.target.value = ''
              }}
            />

            {state.goals.length === 0 && (
              <button className="btn" onClick={onLoadSample}>Load sample data</button>
            )}

            {confirmClear ? (
              <>
                <button className="btn btn-danger" onClick={() => { onClearAll(); setConfirmClear(false) }}>
                  Yes, delete everything
                </button>
                <button className="btn btn-ghost" onClick={() => setConfirmClear(false)}>Cancel</button>
              </>
            ) : (
              <button className="btn btn-ghost btn-danger" onClick={() => setConfirmClear(true)}>
                Clear all data
              </button>
            )}
          </div>

          <p className="hint" style={{ marginTop: 12 }}>
            Your goals live in your account and follow you across devices. Export a
            backup anyway before clearing data, it's the only way back if you change your mind.
          </p>
        </div>
      </div>
    </>
  )
}
