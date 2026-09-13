import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, PiggyBank } from 'lucide-react'
import Dashboard from './views/Dashboard.jsx'
import GoalDetail from './views/GoalDetail.jsx'
import SettingsView from './views/SettingsView.jsx'
import ArchiveView from './views/ArchiveView.jsx'
import ActivityView from './views/ActivityView.jsx'
import SavingsView from './views/SavingsView.jsx'
import SavingsDetail from './views/SavingsDetail.jsx'
import GoalEditor from './components/GoalEditor.jsx'
import SavingsEditor from './components/SavingsEditor.jsx'
import DepositModal from './components/DepositModal.jsx'
import MobileNav from './components/MobileNav.jsx'
import LogModal from './components/LogModal.jsx'
import CompleteModal from './components/CompleteModal.jsx'
import AuthScreen from './components/AuthScreen.jsx'
import LandingScreen from './components/LandingScreen.jsx'
import Loader from './components/Loader.jsx'
import { supabase } from './lib/supabaseClient.js'
import {
  fetchState, putGoal, removeGoal, putEntry, removeEntry, putTask, removeTask,
  putPot, removePot, putDeposit, removeDeposit,
  putSettings, replaceData, replaceAll,
} from './lib/db.js'
import { buildSample } from './lib/sample.js'
import {
  colorVar, newGoal, newEntry, newTask, indexTasks, reopenTask, unitFor, formatAmount, unitWord,
  DEFAULT_SETTINGS, groupByCategory, categoryLabel, STATUS, isActive, isRevisit, isDone,
  inPlay, statusOf, withStatus, revisitLabel, withUnit,
} from './lib/model.js'
import {
  SAVINGS_STATUS, formatMoney, hasCurrency, indexDeposits, isSaving,
  newDeposit, newPot, potStats, withPotStatus,
} from './lib/savings.js'
import { goalStats } from './lib/stats.js'
import { indexEntries } from './lib/stats.js'
import { scoreGoals, pickNudge } from './lib/nudge.js'
import { todayKey } from './lib/date.js'
import logoUrl from './assets/logo.png'
import logoLightUrl from './assets/logo-light.png'
import homeIcon from './assets/home.png'
import homeIconLight from './assets/home-light.png'
import settingsIcon from './assets/settings.png'
import settingsIconLight from './assets/settings-light.png'

const EMPTY_STATE = {
  goals: [], entries: [], tasks: [], pots: [], deposits: [], settings: { ...DEFAULT_SETTINGS },
}

export default function App() {
  // undefined = auth not checked yet, null = signed out, object = signed in.
  const [session, setSession] = useState(undefined)
  // Pre-auth screen: 'landing' shows the marketing page, 'signin'/'signup' show the auth form.
  const [authView, setAuthView] = useState('landing')
  const [state, setState] = useState(EMPTY_STATE)
  const [dataLoading, setDataLoading] = useState(false)
  const [view, setView] = useState({ name: 'dashboard' })
  const [editing, setEditing] = useState(null)     // { goal, isNew }
  const [logging, setLogging] = useState(null)     // { goalId, date }
  const [editingPot, setEditingPot] = useState(null) // { pot, isNew }
  const [depositing, setDepositing] = useState(null) // { potId }
  const [finishing, setFinishing] = useState(null) // { goal, intent }
  const [cycle, setCycle] = useState(0)
  const [toasts, setToasts] = useState([])
  const toastId = useRef(0)
  const [collapsedCategories, setCollapsedCategories] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('collapsedCategories')) || {}
    } catch {
      return {}
    }
  })

  useEffect(() => {
    localStorage.setItem('collapsedCategories', JSON.stringify(collapsedCategories))
  }, [collapsedCategories])

  const { goals, entries, settings } = state
  // Older saves (and backups written before task lists or savings existed)
  // simply have none.
  const tasks = state.tasks || []
  const pots = state.pots || []
  const deposits = state.deposits || []
  // Null until the first savings goal asks for one. Nothing downstream guesses.
  const currency = hasCurrency(settings.currency) ? settings.currency : null
  const userId = session?.user?.id ?? null

  /* ------------------------------------------------------------------ auth */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess))
    return () => sub.subscription.unsubscribe()
  }, [])

  /* ---------------------------------------------------------------- toasts */
  const toast = useCallback((message) => {
    const id = ++toastId.current
    setToasts((t) => [...t, { id, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600)
  }, [])

  /* --------------------------------------------------------- load from db */
  useEffect(() => {
    if (!userId) { setState(EMPTY_STATE); return }
    let cancelled = false
    setDataLoading(true)
    fetchState(userId)
      .then((next) => { if (!cancelled) setState(next) })
      .catch(() => { if (!cancelled) toast('Could not load your data') })
      .finally(() => { if (!cancelled) setDataLoading(false) })
    return () => { cancelled = true }
  }, [userId, toast])

  /* ----------------------------------------------------------------- theme */
  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  /* ------------------------------------------------------------- derived */
  const byGoal = useMemo(() => indexEntries(entries), [entries])
  const byTask = useMemo(() => indexTasks(tasks), [tasks])
  const byPot = useMemo(() => indexDeposits(deposits), [deposits])
  // Only pots still being filled can take money; the bought ones are history.
  const fillable = useMemo(() => pots.filter(isSaving), [pots])
  const activeGoals = useMemo(() => goals.filter(isActive), [goals])
  const revisitGoals = useMemo(() => goals.filter(isRevisit), [goals])
  const archived = useMemo(() => goals.filter(isDone), [goals])
  // Anything you can still log against: active goals and goals in revisit.
  const loggable = useMemo(() => goals.filter(inPlay), [goals])
  const ranked = useMemo(
    () => scoreGoals(goals, byGoal, settings, todayKey()),
    [goals, byGoal, settings],
  )
  const rankedActive = useMemo(() => ranked.filter((r) => r.mode === 'active'), [ranked])
  const rankedRevisit = useMemo(() => ranked.filter((r) => r.mode === 'revisit'), [ranked])
  const dueRevisit = useMemo(() => rankedRevisit.filter((r) => r.revisit.due), [rankedRevisit])
  const top = useMemo(() => pickNudge(ranked), [ranked])
  // Sidebar groups by category; within each group the neediest goal stays first,
  // since `ranked` is already score-ordered. Revisit goals get their own group.
  const navGroups = useMemo(() => groupByCategory(rankedActive, (r) => r.goal), [rankedActive])
  const pick = cycle > 0 && ranked.length > 0 ? ranked[cycle % ranked.length] : top

  /* ------------------------------------------------------------- mutations */
  const syncFail = useCallback((message) => (err) => {
    console.error(err)
    toast(message)
  }, [toast])

  const setSettings = useCallback((patch) => {
    setState((s) => {
      const next = { ...s.settings, ...patch }
      putSettings(userId, next).catch(syncFail('Could not save settings'))
      return { ...s, settings: next }
    })
  }, [userId, syncFail])

  const saveGoal = useCallback((goal) => {
    setState((s) => {
      const exists = s.goals.some((g) => g.id === goal.id)
      return { ...s, goals: exists ? s.goals.map((g) => (g.id === goal.id ? goal : g)) : [...s.goals, goal] }
    })
    putGoal(userId, goal).catch(syncFail('Could not save that goal'))
    setEditing(null)
    toast(`Saved ${goal.name}`)
  }, [userId, syncFail, toast])

  const deleteGoal = useCallback((id) => {
    setState((s) => ({
      ...s,
      goals: s.goals.filter((g) => g.id !== id),
      entries: s.entries.filter((e) => e.goalId !== id),
      tasks: (s.tasks || []).filter((t) => t.goalId !== id),
    }))
    // The goals row cascades to its entries and tasks in the database.
    removeGoal(id).catch(syncFail('Could not delete that goal'))
    setEditing(null)
    setView({ name: 'dashboard' })
    toast('Goal deleted')
  }, [syncFail, toast])

  /* Completing a goal is one decision with two endings: file it away, or keep
     it in revisit so it still gets tapped on a long interval. Either way the
     goal and its entries stay exactly as they were. */
  const finishGoal = useCallback((id, { status, revisitEvery }) => {
    let name = ''
    let updated = null
    setState((s) => ({
      ...s,
      goals: s.goals.map((g) => {
        if (g.id !== id) return g
        name = g.name
        updated = withStatus(g, status, { revisitEvery })
        return updated
      }),
    }))
    if (updated) putGoal(userId, updated).catch(syncFail('Could not save that change'))
    setFinishing(null)
    toast(status === STATUS.REVISIT
      ? `${name} moved to revisit, ${revisitLabel(revisitEvery).toLowerCase()}`
      : `${name} archived`)
  }, [userId, syncFail, toast])

  const reactivateGoal = useCallback((id) => {
    let name = ''
    let updated = null
    setState((s) => ({
      ...s,
      goals: s.goals.map((g) => {
        if (g.id !== id) return g
        name = g.name
        updated = withStatus(g, STATUS.ACTIVE)
        return updated
      }),
    }))
    if (updated) putGoal(userId, updated).catch(syncFail('Could not save that change'))
    toast(`${name} is active again`)
  }, [userId, syncFail, toast])

  const addEntry = useCallback(({ goalId, date, amount, note }) => {
    const entry = newEntry(goalId, date, amount, note)
    setState((s) => ({ ...s, entries: [...s.entries, entry] }))
    putEntry(userId, entry).catch(syncFail('Could not save that entry'))
    setLogging(null)
    setCycle(0)
    const g = goals.find((x) => x.id === goalId)
    if (g) {
      const u = unitFor(g)
      toast(`Logged ${formatAmount(amount, u)} ${unitWord(amount, u)} of ${g.name}`)
    }
  }, [goals, userId, syncFail, toast])

  /* Deleting an entry that came from a ticked-off step reopens that step —
     otherwise the checkbox would claim credit for progress no longer there. */
  const deleteEntry = useCallback((id) => {
    let reopened = null
    setState((s) => {
      const entry = s.entries.find((e) => e.id === id)
      reopened = entry?.taskId ? reopenTask((s.tasks || []).find((t) => t.id === entry.taskId)) : null
      return {
        ...s,
        entries: s.entries.filter((e) => e.id !== id),
        tasks: entry?.taskId
          ? (s.tasks || []).map((t) => (t.id === entry.taskId ? reopenTask(t) : t))
          : s.tasks || [],
      }
    })
    removeEntry(id).catch(syncFail('Could not remove that entry'))
    if (reopened) putTask(userId, reopened).catch(syncFail('Could not update that step'))
    toast('Entry removed')
  }, [userId, syncFail, toast])

  /* ----------------------------------------------------------------- tasks */

  const addTask = useCallback(({ goalId, title, amount }) => {
    setState((s) => {
      const list = s.tasks || []
      const order = list.filter((t) => t.goalId === goalId).length
      const task = newTask(goalId, title, amount, order)
      putTask(userId, task).catch(syncFail('Could not save that step'))
      return { ...s, tasks: [...list, task] }
    })
  }, [userId, syncFail])

  /* Ticking a step off is just logging: it writes an ordinary entry for today,
     stamped with the step that produced it. Unticking deletes exactly that
     entry and nothing else, so the goal's totals stay honest in both
     directions. A step worth 0 is checked off without touching the numbers. */
  const toggleTask = useCallback((id) => {
    let message = ''
    setState((s) => {
      const task = (s.tasks || []).find((t) => t.id === id)
      if (!task) return s
      if (task.done) {
        message = `“${task.title}” is open again`
        const reopened = reopenTask(task)
        putTask(userId, reopened).catch(syncFail('Could not update that step'))
        if (task.entryId) removeEntry(task.entryId).catch(syncFail('Could not remove that entry'))
        return {
          ...s,
          entries: task.entryId ? s.entries.filter((e) => e.id !== task.entryId) : s.entries,
          tasks: s.tasks.map((t) => (t.id === id ? reopened : t)),
        }
      }
      const goal = s.goals.find((g) => g.id === task.goalId)
      const worth = Math.max(0, Number(task.amount) || 0)
      const entry = worth > 0 ? newEntry(task.goalId, todayKey(), worth, task.title, task.id) : null
      const updatedTask = {
        ...task, done: true, entryId: entry?.id || null, completedAt: new Date().toISOString(),
      }
      message = entry && goal
        ? `“${task.title}” done, ${withUnit(worth, unitFor(goal))} on ${goal.name}`
        : `“${task.title}” done`
      if (entry) putEntry(userId, entry).catch(syncFail('Could not save that entry'))
      putTask(userId, updatedTask).catch(syncFail('Could not update that step'))
      return {
        ...s,
        entries: entry ? [...s.entries, entry] : s.entries,
        tasks: s.tasks.map((t) => (t.id === id ? updatedTask : t)),
      }
    })
    setCycle(0)
    if (message) toast(message)
  }, [userId, syncFail, toast])

  /* Deleting a finished step keeps the entry it logged. The work happened;
     only the to-do item goes. */
  const deleteTask = useCallback((id) => {
    let logged = false
    setState((s) => {
      const task = (s.tasks || []).find((t) => t.id === id)
      logged = !!task?.entryId
      if (task?.entryId) {
        const entry = s.entries.find((e) => e.id === task.entryId)
        if (entry) putEntry(userId, { ...entry, taskId: null }).catch(syncFail('Could not update that entry'))
      }
      return {
        ...s,
        tasks: (s.tasks || []).filter((t) => t.id !== id),
        entries: task?.entryId
          ? s.entries.map((e) => (e.id === task.entryId ? { ...e, taskId: null } : e))
          : s.entries,
      }
    })
    removeTask(id).catch(syncFail('Could not remove that step'))
    toast(logged ? 'Step removed. The progress it logged stays' : 'Step removed')
  }, [userId, syncFail, toast])

  const openNewGoal = useCallback(() => {
    setEditing({ goal: newGoal(goals.length), isNew: true })
  }, [goals.length])

  const loadSample = useCallback(() => {
    const { goals: g, entries: e, tasks: t } = buildSample()
    setState((s) => ({ ...s, goals: g, entries: e, tasks: t }))
    replaceData(userId, { goals: g, entries: e, tasks: t }).catch(syncFail('Could not save sample data'))
    setView({ name: 'dashboard' })
    toast('Sample data loaded')
  }, [userId, syncFail, toast])

  const openLog = useCallback((goalId, date) => {
    if (loggable.length === 0) { openNewGoal(); return }
    const target = goalId && loggable.some((g) => g.id === goalId) ? goalId : loggable[0].id
    setLogging({ goalId: target, date })
  }, [loggable, openNewGoal])

  /* --------------------------------------------------------------- savings */

  /* The editor hands back the currency along with the pot: it is an app-wide
     setting, but the moment you are asked for a price is the moment it makes
     sense to be asked what the price is in. */
  const savePot = useCallback((pot, pickedCurrency) => {
    setState((s) => {
      const list = s.pots || []
      const exists = list.some((p) => p.id === pot.id)
      const next = {
        ...s,
        pots: exists ? list.map((p) => (p.id === pot.id ? pot : p)) : [...list, pot],
      }
      if (pickedCurrency && pickedCurrency !== s.settings.currency) {
        next.settings = { ...s.settings, currency: pickedCurrency }
        putSettings(userId, next.settings).catch(syncFail('Could not save your currency'))
      }
      return next
    })
    putPot(userId, pot).catch(syncFail('Could not save that savings goal'))
    setEditingPot(null)
    toast(`Saved ${pot.name}`)
  }, [userId, syncFail, toast])

  const deletePot = useCallback((id) => {
    setState((s) => ({
      ...s,
      pots: (s.pots || []).filter((p) => p.id !== id),
      deposits: (s.deposits || []).filter((d) => d.potId !== id),
    }))
    // The savings_pots row cascades to its deposits in the database.
    removePot(id).catch(syncFail('Could not delete that savings goal'))
    setEditingPot(null)
    setView({ name: 'savings' })
    toast('Savings goal deleted')
  }, [syncFail, toast])

  /* Bought, or back on the list. The money that went in stays either way —
     what changes is only whether the pot still counts towards what you need. */
  const setPotStatus = useCallback((id, status) => {
    let name = ''
    let updated = null
    setState((s) => ({
      ...s,
      pots: (s.pots || []).map((p) => {
        if (p.id !== id) return p
        name = p.name
        updated = withPotStatus(p, status)
        return updated
      }),
    }))
    if (updated) putPot(userId, updated).catch(syncFail('Could not save that change'))
    toast(status === SAVINGS_STATUS.BOUGHT ? `${name} — bought!` : `${name} is back on the list`)
  }, [userId, syncFail, toast])

  const addDeposit = useCallback(({ potId, date, amount, note }) => {
    const deposit = newDeposit(potId, date, amount, note)
    setState((s) => ({ ...s, deposits: [...(s.deposits || []), deposit] }))
    putDeposit(userId, deposit).catch(syncFail('Could not save that payment'))
    setDepositing(null)

    const pot = pots.find((p) => p.id === potId)
    if (!pot) return
    const before = potStats(pot, byPot.get(potId) || [])
    const after = potStats(pot, [...(byPot.get(potId) || []), deposit])
    const money = formatMoney(Math.abs(amount), currency)
    toast(amount < 0
      ? `Took ${money} back out of ${pot.name}`
      : after.funded && !before.funded
        ? `${pot.name} is fully saved for!`
        : after.target > 0
          ? `${money} into ${pot.name} · ${formatMoney(after.remaining, currency)} to go`
          : `${money} into ${pot.name}`)
  }, [pots, byPot, currency, userId, syncFail, toast])

  const deleteDeposit = useCallback((id) => {
    setState((s) => ({ ...s, deposits: (s.deposits || []).filter((d) => d.id !== id) }))
    removeDeposit(id).catch(syncFail('Could not remove that payment'))
    toast('Payment removed')
  }, [syncFail, toast])

  const openNewPot = useCallback(() => {
    setEditingPot({ pot: newPot(pots.length), isNew: true })
  }, [pots.length])

  const openDeposit = useCallback((potId) => {
    if (fillable.length === 0) { openNewPot(); return }
    const target = potId && fillable.some((p) => p.id === potId) ? potId : fillable[0].id
    setDepositing({ potId: target })
  }, [fillable, openNewPot])

  /* ------------------------------------------------------------- shortcuts */
  useEffect(() => {
    const onKey = (e) => {
      if (editing || logging || finishing || editingPot || depositing) return
      const t = e.target
      if (t instanceof HTMLElement && /input|textarea|select/i.test(t.tagName)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'n') { e.preventDefault(); openNewGoal() }
      if (e.key === 'l') { e.preventDefault(); openLog(view.name === 'goal' ? view.goalId : undefined) }
      if (e.key === 'g') { e.preventDefault(); setView({ name: 'dashboard' }) }
      if (e.key === 'a') { e.preventDefault(); setView({ name: 'activity' }) }
      if (e.key === 's') { e.preventDefault(); setView({ name: 'savings' }) }
      if (e.key === ',') { e.preventDefault(); setView({ name: 'settings' }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, logging, finishing, editingPot, depositing, view, openNewGoal, openLog, openDeposit])

  const currentGoal = view.name === 'goal' ? goals.find((g) => g.id === view.goalId) : null
  const currentPot = view.name === 'pot' ? pots.find((p) => p.id === view.potId) : null

  if (session === undefined) {
    return <div className="auth-screen"><Loader /></div>
  }
  if (!session) {
    if (authView === 'landing') {
      return (
        <LandingScreen
          onSignUp={() => setAuthView('signup')}
          onSignIn={() => setAuthView('signin')}
        />
      )
    }
    return (
      <AuthScreen
        initialMode={authView}
        onBack={() => setAuthView('landing')}
      />
    )
  }
  if (dataLoading) {
    return <div className="auth-screen"><Loader label="Loading your goals…" /></div>
  }

  return (
    <div className="app">
      <div className="mobile-topbar brand">
        <span className="brand-mark" aria-hidden="true">
          <img src={logoUrl} className="logo-for-light" alt="" />
          <img src={logoLightUrl} className="logo-for-dark" alt="" />
        </span>
        Compassed
      </div>

      <MobileNav
        view={view}
        setView={setView}
        archivedCount={archived.length}
        onNewGoal={openNewGoal}
        onAddMoney={pots.length > 0 ? openDeposit : null}
      />

      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <img src={logoUrl} className="logo-for-light" alt="" />
            <img src={logoLightUrl} className="logo-for-dark" alt="" />
          </span>
          Compassed
        </div>

        <button
          className="nav-item"
          aria-current={view.name === 'dashboard'}
          onClick={() => setView({ name: 'dashboard' })}
        >
          <span className="nav-icon" aria-hidden="true">
            <img src={homeIcon} className="icon-for-light" alt="" />
            <img src={homeIconLight} className="icon-for-dark" alt="" />
          </span>
          <span className="nav-name">Today</span>
        </button>

        <button
          className="nav-item"
          aria-current={view.name === 'activity'}
          onClick={() => setView({ name: 'activity' })}
        >
          <span aria-hidden="true">☰</span>
          <span className="nav-name">Activity</span>
          <span className="nav-meta">A</span>
        </button>

        <button
          className="nav-item"
          aria-current={view.name === 'savings'}
          onClick={() => setView({ name: 'savings' })}
        >
          <span className="nav-icon" aria-hidden="true" style={{ display: 'flex' }}>
            <PiggyBank size={16} />
          </span>
          <span className="nav-name">Savings</span>
          <span className="nav-meta">S</span>
        </button>

        {navGroups.map(([category, items]) => {
          const key = category || '_none'
          const collapsed = !!collapsedCategories[key]
          return (
            <div key={key} style={{ display: 'contents' }}>
              <div className="nav-label">
                {navGroups.length === 1 && !category ? 'Goals' : categoryLabel(category)}
                <button
                  className="dropdown-btn"
                  aria-expanded={!collapsed}
                  aria-label={collapsed ? 'Expand category' : 'Collapse category'}
                  onClick={() => setCollapsedCategories((prev) => ({ ...prev, [key]: !prev[key] }))}
                >
                  <ChevronDown size={16} style={{ transform: collapsed ? 'rotate(-90deg)' : 'none' }} />
                </button>
              </div>
              {!collapsed && items.map(({ goal, stats }) => (
                <button
                  key={goal.id}
                  className="nav-item"
                  style={{ '--goal-color': colorVar(goal.colorSlot) }}
                  aria-current={view.name === 'goal' && view.goalId === goal.id}
                  onClick={() => setView({ name: 'goal', goalId: goal.id })}
                >
                  <span className="dot" />
                  <span className="nav-name">{goal.name}</span>
                  <span className="nav-meta">
                    {stats.daysSince == null ? '—' : stats.daysSince === 0 ? 'today' : `${stats.daysSince}d`}
                  </span>
                </button>
              ))}
            </div>
          )
        })}

        {rankedRevisit.length > 0 && (
          <>
            <div className="nav-label">Revisit</div>
            {rankedRevisit.map(({ goal, revisit }) => (
              <button
                key={goal.id}
                className="nav-item"
                style={{ '--goal-color': colorVar(goal.colorSlot) }}
                aria-current={view.name === 'goal' && view.goalId === goal.id}
                onClick={() => setView({ name: 'goal', goalId: goal.id })}
              >
                <span className="dot" />
                <span className="nav-name">{goal.name}</span>
                <span className="nav-meta">{revisit.due ? 'due' : `${revisit.dueIn}d`}</span>
              </button>
            ))}
          </>
        )}

        {fillable.length > 0 && (
          <>
            <div className="nav-label">Saving for</div>
            {fillable.map((pot) => {
              const stats = potStats(pot, byPot.get(pot.id) || [])
              return (
                <button
                  key={pot.id}
                  className="nav-item"
                  style={{ '--goal-color': colorVar(pot.colorSlot) }}
                  aria-current={view.name === 'pot' && view.potId === pot.id}
                  onClick={() => setView({ name: 'pot', potId: pot.id })}
                >
                  <span className="dot" />
                  <span className="nav-name">{pot.name}</span>
                  <span className="nav-meta">
                    {stats.pct == null ? '—' : `${Math.min(100, Math.round(stats.pct))}%`}
                  </span>
                </button>
              )
            })}
          </>
        )}

        {archived.length > 0 && (
          <>
            <div className="nav-label">Archive</div>
            <button
              className="nav-item"
              aria-current={view.name === 'archive'}
              onClick={() => setView({ name: 'archive' })}
            >
              <span aria-hidden="true">📦</span>
              <span className="nav-name">Completed</span>
              <span className="nav-meta">{archived.length}</span>
            </button>
          </>
        )}

        <div className="nav-footer">
          <button className="nav-item" onClick={openNewGoal}>
            <span aria-hidden="true">＋</span>
            <span className="nav-name">New goal</span>
            <span className="nav-meta">N</span>
          </button>
          <button
            className="nav-item"
            aria-current={view.name === 'settings'}
            onClick={() => setView({ name: 'settings' })}
          >
            <span className="nav-icon" aria-hidden="true">
              <img src={settingsIcon} className="icon-for-light" alt="" />
              <img src={settingsIconLight} className="icon-for-dark" alt="" />
            </span>
            <span className="nav-name">Settings</span>
            <span className="nav-meta">,</span>
          </button>
        </div>
      </aside>

      <main className="main" key={view.name + (view.goalId || view.potId || '')}>
        {view.name === 'dashboard' && (
          <>
            {goals.length > 0 && (
              <div className="page-head">
                <div>
                  <h1 className="page-title">Today</h1>
                  <p className="page-sub">
                    {loggable.length === 0
                      ? 'Everything here is archived! Nothing left to compass to.'
                      : dueRevisit.length > 0
                        ? `One goal gets your attention. ${dueRevisit.length} finished ${dueRevisit.length === 1 ? 'goal is' : 'goals are'} due for practice.`
                        : 'One goal gets your attention. The rest keep their place.'}
                  </p>
                </div>
                {loggable.length > 0 && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" onClick={openNewGoal}>New goal</button>
                    <button className="btn btn-primary" onClick={() => openLog()}>Log progress</button>
                  </div>
                )}
              </div>
            )}
            <Dashboard
              goals={activeGoals}
              entries={entries}
              byGoal={byGoal}
              byTask={byTask}
              ranked={rankedActive}
              revisit={rankedRevisit}
              pool={ranked}
              pick={pick}
              cycled={cycle > 0}
              settings={settings}
              onLog={openLog}
              onOpen={(id) => setView({ name: 'goal', goalId: id })}
              onCycle={() => setCycle((c) => (c > 0 ? 0 : 1))}
              onNewGoal={openNewGoal}
              onComplete={(goal) => setFinishing({ goal, intent: 'complete' })}
              onToggleTask={toggleTask}
              onLoadSample={loadSample}
            />
          </>
        )}

        {view.name === 'goal' && currentGoal && (
          <GoalDetail
            goal={currentGoal}
            entries={entries}
            days={byGoal.get(currentGoal.id)}
            tasks={byTask.get(currentGoal.id)}
            settings={settings}
            onEdit={(g) => setEditing({ goal: g, isNew: false })}
            onLog={openLog}
            onDeleteEntry={deleteEntry}
            onBack={() => setView({ name: statusOf(currentGoal) === STATUS.DONE ? 'archive' : 'dashboard' })}
            onComplete={(g) => setFinishing({ goal: g, intent: 'complete' })}
            onRevisit={(g) => setFinishing({ goal: g, intent: 'revisit' })}
            onReactivate={reactivateGoal}
            onAddTask={addTask}
            onToggleTask={toggleTask}
            onDeleteTask={deleteTask}
          />
        )}

        {view.name === 'activity' && (
          <>
            <div className="page-head">
              <div>
                <h1 className="page-title">Activity</h1>
                <p className="page-sub">
                  Everything you&rsquo;ve logged, newest first. Logged something twice, or against
                  the wrong goal? Take it back out here.
                </p>
              </div>
              {loggable.length > 0 && (
                <button className="btn btn-primary" onClick={() => openLog()}>Log progress</button>
              )}
            </div>
            <ActivityView
              goals={goals}
              entries={entries}
              onDelete={deleteEntry}
              onOpen={(id) => setView({ name: 'goal', goalId: id })}
              onLog={openLog}
            />
          </>
        )}

        {view.name === 'savings' && (
          <>
            {pots.length > 0 && (
              <div className="page-head">
                <div>
                  <h1 className="page-title">Savings</h1>
                  <p className="page-sub">
                    What you&rsquo;re saving up for, and how close each one is. Nothing here is
                    nudged &mdash; it fills up when you put money in, and waits when you don&rsquo;t.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" onClick={openNewPot}>New savings goal</button>
                  {fillable.length > 0 && (
                    <button className="btn btn-primary" onClick={() => openDeposit()}>Add money</button>
                  )}
                </div>
              </div>
            )}
            <SavingsView
              pots={pots}
              byPot={byPot}
              currency={currency}
              onOpen={(id) => setView({ name: 'pot', potId: id })}
              onDeposit={openDeposit}
              onNewPot={openNewPot}
              onBought={(pot) => setPotStatus(pot.id, SAVINGS_STATUS.BOUGHT)}
            />
          </>
        )}

        {view.name === 'pot' && currentPot && (
          <SavingsDetail
            pot={currentPot}
            deposits={byPot.get(currentPot.id) || []}
            currency={currency}
            onEdit={(pot) => setEditingPot({ pot, isNew: false })}
            onDeposit={openDeposit}
            onDeleteDeposit={deleteDeposit}
            onSetStatus={setPotStatus}
            onBack={() => setView({ name: 'savings' })}
          />
        )}

        {view.name === 'pot' && !currentPot && (
          <div className="empty">
            <h3>That savings goal is gone</h3>
            <button className="btn" onClick={() => setView({ name: 'savings' })}>Back to savings</button>
          </div>
        )}

        {view.name === 'archive' && (
          <>
            <div className="page-head">
              <div>
                <h1 className="page-title">Archive</h1>
                <p className="page-sub">
                  {archived.length} finished {archived.length === 1 ? 'goal' : 'goals'} · nothing here is
                  nudged, and nothing is lost
                </p>
              </div>
              <button className="btn" onClick={() => setView({ name: 'dashboard' })}>← Today</button>
            </div>
            <ArchiveView
              goals={archived}
              byGoal={byGoal}
              settings={settings}
              onOpen={(id) => setView({ name: 'goal', goalId: id })}
              onReactivate={reactivateGoal}
              onRevisit={(g) => setFinishing({ goal: g, intent: 'revisit' })}
              onBack={() => setView({ name: 'dashboard' })}
            />
          </>
        )}

        {view.name === 'goal' && !currentGoal && (
          <div className="empty">
            <h3>That goal is gone</h3>
            <button className="btn" onClick={() => setView({ name: 'dashboard' })}>Back to today</button>
          </div>
        )}

        {view.name === 'settings' && (
          <SettingsView
            settings={settings}
            setSettings={setSettings}
            state={state}
            ranked={ranked}
            toast={toast}
            email={session.user.email}
            onSignOut={() => supabase.auth.signOut()}
            onDeleteAccount={async () => {
              const { error } = await supabase.functions.invoke('delete-account')
              if (error) throw error
              await supabase.auth.signOut()
            }}
            onImport={(next) => {
              setState(next)
              replaceAll(userId, next).catch(syncFail('Restored locally, but the cloud sync failed'))
              toast('Backup restored')
              setView({ name: 'dashboard' })
            }}
            onLoadSample={loadSample}
            onClearAll={() => {
              const next = {
                goals: [], entries: [], tasks: [], pots: [], deposits: [],
                settings: { ...DEFAULT_SETTINGS, theme: settings.theme, currency },
              }
              setState(next)
              replaceData(userId, { goals: [], entries: [], tasks: [], pots: [], deposits: [] })
                .catch(syncFail('Could not clear cloud data'))
              putSettings(userId, next.settings).catch(syncFail('Could not clear cloud data'))
              setView({ name: 'dashboard' })
              toast('All data cleared')
            }}
          />
        )}
      </main>

      {editing && (
        <GoalEditor
          goal={editing.goal}
          isNew={editing.isNew}
          allGoals={goals}
          onSave={saveGoal}
          onDelete={deleteGoal}
          onClose={() => setEditing(null)}
        />
      )}

      {editingPot && (
        <SavingsEditor
          pot={editingPot.pot}
          isNew={editingPot.isNew}
          currency={currency}
          saved={potStats(editingPot.pot, byPot.get(editingPot.pot.id) || []).saved}
          onSave={savePot}
          onDelete={deletePot}
          onClose={() => setEditingPot(null)}
        />
      )}

      {depositing && (
        <DepositModal
          pots={fillable}
          byPot={byPot}
          potId={depositing.potId}
          currency={currency}
          onSave={addDeposit}
          onClose={() => setDepositing(null)}
        />
      )}

      {finishing && (
        <CompleteModal
          goal={finishing.goal}
          stats={goalStats(finishing.goal, byGoal.get(finishing.goal.id), settings, todayKey())}
          intent={finishing.intent}
          onConfirm={(choice) => finishGoal(finishing.goal.id, choice)}
          onClose={() => setFinishing(null)}
        />
      )}

      {logging && (
        <LogModal
          goals={loggable}
          goalId={logging.goalId}
          date={logging.date}
          onSave={addEntry}
          onClose={() => setLogging(null)}
        />
      )}

      <div className="toasts">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>{t.message}</div>
        ))}
      </div>
    </div>
  )
}
