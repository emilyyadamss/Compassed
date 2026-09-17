import { useMemo, useState } from 'react'
import Welcome from '../components/Welcome.jsx'
import NudgeCard from '../components/NudgeCard.jsx'
import GoalCard from '../components/GoalCard.jsx'
import RevisitCard from '../components/RevisitCard.jsx'
import BalanceBars from '../components/BalanceBars.jsx'
import Heatmap from '../components/Heatmap.jsx'
import { balanceScore, periodTotals } from '../lib/stats.js'
import { todayKey, addDays, startOfWeek } from '../lib/date.js'
import { categoryList, categoryLabel, groupByCategory, normaliseCategory } from '../lib/model.js'

const GOALS_UNIT = { one: 'goal', many: 'goals', abbr: '', precision: 0, step: 1 }

export default function Dashboard({
  goals, entries, byGoal, byTask, ranked, revisit = [], pool = ranked, pick, settings, cycled,
  onLog, onOpen, onCycle, onNewGoal, onComplete, onToggleTask, onLoadSample,
}) {
  const today = todayKey()
  const [category, setCategory] = useState(null)   // null = every category

  // Revisit goals are still on the board, so they get a say in the filter row.
  const boardGoals = useMemo(() => [...goals, ...revisit.map((r) => r.goal)], [goals, revisit])
  const categories = useMemo(() => categoryList(boardGoals), [boardGoals])
  const hasCategories = categories.length > 1 || (categories.length === 1 && categories[0] !== '')

  /* The nudge stays global on purpose — filtering the board must never be a way
     to hide a goal from it. Everything below the filter row is scoped. */
  const inCategory = (r) => category === null || normaliseCategory(r.goal.category) === category
  const scoped = useMemo(() => ranked.filter(inCategory), [ranked, category])
  const scopedRevisit = useMemo(() => revisit.filter(inCategory), [revisit, category])
  // Practice counts as attention, so revisit goals belong in the day-by-day view.
  const scopedIds = useMemo(
    () => new Set([...scoped, ...scopedRevisit].map((r) => r.goal.id)),
    [scoped, scopedRevisit],
  )
  const scopedGoals = useMemo(() => scoped.map((r) => r.goal), [scoped])

  /* Cross-goal heatmap: how many distinct goals you touched each day. It answers
     the spread question directly — a day with three goals reads darker than a
     day spent entirely on one. */
  const spreadDays = useMemo(() => {
    const m = new Map()
    for (const e of entries) {
      if (!scopedIds.has(e.goalId)) continue
      let set = m.get(e.date)
      if (!set) { set = new Set(); m.set(e.date, set) }
      set.add(e.goalId)
    }
    return new Map([...m].map(([k, v]) => [k, v.size]))
  }, [entries, scopedIds])

  const balance = useMemo(
    () => balanceScore(scopedGoals, byGoal, settings, today),
    [scopedGoals, byGoal, settings, today],
  )

  const trends = useMemo(() => {
    const out = new Map()
    for (const g of goals) {
      const from = g.cadence === 'month' ? addDays(today, -365) : addDays(today, -83)
      out.set(g.id, periodTotals(byGoal.get(g.id), from, today, g.cadence, settings.weekStart).slice(-12))
    }
    return out
  }, [goals, byGoal, settings.weekStart, today])

  const bestStreak = Math.max(0, ...scoped.map((r) => r.stats.streak))
  const weekStart = startOfWeek(today, settings.weekStart)
  const activeThisWeek = [...spreadDays.keys()].filter((d) => d >= weekStart && d <= today).length
  // "Needs attention" tracks the same score the nudge uses, so the tile and the
  // hero card never disagree about how much is actually slipping.
  const needsAttention = scoped.filter((r) => r.score >= 0.4).length

  const dueRevisit = useMemo(() => scopedRevisit.filter((r) => r.revisit.due), [scopedRevisit])
  const cardGroups = useMemo(() => groupByCategory(scoped, (r) => r.goal), [scoped])
  const showGroupHeads = cardGroups.length > 1

  const countIn = (c) =>
    [...ranked, ...revisit].filter((r) => normaliseCategory(r.goal.category) === c).length

  if (boardGoals.length === 0) {
    return <Welcome onNewGoal={onNewGoal} onLoadSample={onLoadSample} />
  }

  return (
    <>
      <NudgeCard
        pick={pick}
        ranked={pool}
        settings={settings}
        cycled={cycled}
        tasks={(pick && byTask?.get(pick.goal.id)) || []}
        onToggleTask={onToggleTask}
        onLog={onLog}
        onOpen={onOpen}
        onCycle={onCycle}
      />

      {hasCategories && (
        <div className="chip-row" style={{ marginBottom: 18 }}>
          <button
            className="chip-btn"
            aria-pressed={category === null}
            onClick={() => setCategory(null)}
          >
            All goals <span className="n">{ranked.length + revisit.length}</span>
          </button>
          {categories.map((c) => (
            <button
              key={c || '_none'}
              className="chip-btn"
              aria-pressed={category === c}
              onClick={() => setCategory(category === c ? null : c)}
            >
              {categoryLabel(c)} <span className="n">{countIn(c)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="kpi-row">
        <div className="stat">
          <div className="k">{category === null ? 'Goals in play' : `In ${categoryLabel(category)}`}</div>
          <div className="v">{scoped.length}</div>
          <div className="d">
            {needsAttention > 0 ? `${needsAttention} slipping` : 'none slipping'}
            {scopedRevisit.length > 0 ? ` · ${scopedRevisit.length} in revisit` : ''}
          </div>
        </div>
        <div className="stat">
          <div className="k">Attention balance</div>
          <div className="v">{balance == null ? '—' : `${balance}`}<small> / 100</small></div>
          <div className="d">
            {balance == null ? 'needs two goals' : balance >= 75 ? 'evenly spread' : balance >= 45 ? 'a bit lopsided' : 'one goal is eating everything'}
          </div>
        </div>
        <div className="stat">
          <div className="k">Best current streak</div>
          <div className="v">{bestStreak}<small> {bestStreak === 1 ? 'day' : 'days'}</small></div>
          <div className="d">consecutive days logged</div>
        </div>
        <div className="stat">
          <div className="k">Active days this week</div>
          <div className="v">{activeThisWeek}<small> / 7</small></div>
          <div className="d">days you logged anything</div>
        </div>
      </div>

      <div className="stack" style={{ marginBottom: 14 }}>
        <BalanceBars ranked={scoped} showTable={settings.showTables} />

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Everything, day by day</div>
              <div className="card-sub">
                How many different goals you touched each day
                {category !== null ? ` in ${categoryLabel(category)}` : ''}
              </div>
            </div>
          </div>
          <Heatmap
            days={spreadDays}
            color="var(--accent)"
            unit={GOALS_UNIT}
            weeks={settings.heatmapWeeks}
            weekStart={settings.weekStart}
            label="Goals touched"
            summary={({ activeDays, weeks }) =>
              `${activeDays} active ${activeDays === 1 ? 'day' : 'days'} in the last ${weeks} weeks`}
          />
        </div>
      </div>

      <div className="card-head" style={{ marginTop: 24 }}>
        <h2 className="card-title" style={{ fontSize: 15 }}>Your goals</h2>
        <button className="btn btn-sm" onClick={onNewGoal}>New goal</button>
      </div>

      {cardGroups.map(([cat, items]) => (
        <div key={cat || '_none'}>
          {showGroupHeads && (
            <div className="cat-head">
              <h3>{categoryLabel(cat)}</h3>
              <span className="count">{items.length}</span>
              <span className="rule" />
            </div>
          )}
          <div className="grid-cards">
            {items.map(({ goal, stats }) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                stats={stats}
                trend={trends.get(goal.id) || []}
                tasks={byTask?.get(goal.id) || []}
                onOpen={onOpen}
                onLog={onLog}
                onComplete={onComplete}
              />
            ))}
          </div>
        </div>
      ))}

      {scoped.length === 0 && scopedRevisit.length > 0 && (
        <p className="hint" style={{ marginTop: 4 }}>
          Nothing active here, everything in this view is finished and being kept warm below.
        </p>
      )}

      {scopedRevisit.length > 0 && (
        <>
          <div className="card-head" style={{ marginTop: 28 }}>
            <div>
              <h2 className="card-title" style={{ fontSize: 15 }}>Keeping it fresh</h2>
              <div className="card-sub">
                Finished goals on a practice interval. Nudged only when one comes round
                {dueRevisit.length > 0
                  ? `. ${dueRevisit.length} due now`
                  : '. None due yet'}
              </div>
            </div>
          </div>
          <div className="grid-cards">
            {scopedRevisit.map(({ goal, stats, revisit: r }) => (
              <RevisitCard
                key={goal.id}
                goal={goal}
                stats={stats}
                revisit={r}
                onOpen={onOpen}
                onLog={onLog}
              />
            ))}
          </div>
        </>
      )}
    </>
  )
}
