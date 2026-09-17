import { useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import logoUrl from '../assets/logo.png'
import logoLightUrl from '../assets/logo-light.png'

/* Shown after following a reset link. The link has already signed the user in
   with a short-lived recovery session; this just gives it a new password. */
export default function ResetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    if (password !== confirm) {
      setError("Those passwords don't match.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw err
      onDone()
    } catch (err) {
      setError(err.message || 'Could not update your password.')
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="card auth-card">
        <div className="brand" style={{ marginBottom: 18 }}>
          <span className="brand-mark" aria-hidden="true">
            <img src={logoUrl} className="logo-for-light" alt="" />
            <img src={logoLightUrl} className="logo-for-dark" alt="" />
          </span>
          Compassed
        </div>

        <div className="card-head"><div className="card-title">Set a new password</div></div>

        <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
          <div className="field">
            <label htmlFor="reset-password">New password</label>
            {/* Single-purpose screen reached from an email link — the new
                password field is the only thing to do here. */}
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <input autoFocus
              id="reset-password"
              className="input"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="reset-confirm">Confirm new password</label>
            <input
              id="reset-confirm"
              className="input"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          {error && <p className="hint" style={{ color: 'var(--error-text)' }}>{error}</p>}

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Working…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
