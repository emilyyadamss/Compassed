import { useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import logoUrl from '../assets/logo.png'
import logoLightUrl from '../assets/logo-light.png'

const MODES = {
  signin: { title: 'Sign in', cta: 'Sign in', switchTo: 'signup', switchLabel: "Don't have an account? Sign up" },
  signup: { title: 'Create an account', cta: 'Sign up', switchTo: 'signin', switchLabel: 'Already have an account? Sign in' },
  forgot: { title: 'Reset your password', cta: 'Send reset link', switchTo: 'signin', switchLabel: 'Remembered it? Sign in' },
}

export default function AuthScreen({ initialMode = 'signin', onBack }) {
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  const copy = MODES[mode]

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      if (mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({ email, password })
        if (err) throw err
        setMessage('Account created. Check your email to confirm it, then sign in.')
        setMode('signin')
      } else if (mode === 'forgot') {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (err) throw err
        setMessage('If an account exists for that email, a reset link is on its way.')
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function sendMagicLink() {
    if (!email || busy) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      })
      if (err) throw err
      setMessage('Check your email for a sign-in link.')
    } catch (err) {
      setError(err.message || 'Could not send the link.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="card auth-card">
        {onBack && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginBottom: 10 }}
            onClick={onBack}
          >
            ← Back
          </button>
        )}
        <div className="brand" style={{ marginBottom: 18 }}>
          <span className="brand-mark" aria-hidden="true">
            <img src={logoUrl} className="logo-for-light" alt="" />
            <img src={logoLightUrl} className="logo-for-dark" alt="" />
          </span>
          Compassed
        </div>

        <div className="card-head"><div className="card-title">{copy.title}</div></div>

        <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              className="input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {mode !== 'forgot' && (
            <div className="field">
              <label htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                className="input"
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {mode === 'signin' && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ alignSelf: 'flex-end' }}
                  onClick={() => { setMode('forgot'); setError(null); setMessage(null) }}
                >
                  Forgot password?
                </button>
              )}
            </div>
          )}

          {error && <p className="hint" style={{ color: 'var(--error-text)' }}>{error}</p>}
          {message && <p className="hint">{message}</p>}

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Working…' : copy.cta}
          </button>
        </form>

        {mode !== 'forgot' && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 10, width: '100%' }}
            disabled={busy || !email}
            onClick={sendMagicLink}
          >
            Email me a sign-in link instead
          </button>
        )}

        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 18, width: '100%' }}
          onClick={() => { setMode(copy.switchTo); setError(null); setMessage(null) }}
        >
          {copy.switchLabel}
        </button>
      </div>
    </div>
  )
}
