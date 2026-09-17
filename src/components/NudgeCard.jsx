import { colorVar, unitFor, formatAmount, unitWord, withUnit } from '../lib/model.js'
import { explainNudge, suggestedAction } from '../lib/nudge.js'
import { nextTask } from '../lib/stats.js'
import { relativeDays } from '../lib/date.js'
import { GoalIcon } from '../lib/goalIcons.jsx'
import { MousePointerClick, RotateCw, Sprout } from 'lucide-react'

export default function NudgeCard({
  pick, ranked, settings, onLog, onOpen, onCycle, cycled, tasks = [], onToggleTask,
}) {
  if (!pick) {
    return (
      <div className="nudge" style={{ '--goal-color': 'var(--good)' }}>
        <div className="nudge-inner">
          <div className="nudge-body">
            <div className="nudge-eyebrow">✓ All caught up</div>
            <h2 className="nudge-title">Everything's moving</h2>
            <p className="nudge-reason">
              Every goal has been touched recently and is tracking near its target. Nothing is
              being quietly forgotten. Check back tomorrow.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const { goal, stats, mode, revisit } = pick
  const unit = unitFor(goal)
  const { lead, detail } = explainNudge(pick, settings)
  const color = colorVar(goal.colorSlot)
  const others = ranked.filter((r) => r.goal.id !== goal.id).slice(0, 3)
  const practice = mode === 'revisit'
  /* If this goal has steps waiting, the smallest useful ask is already written
     down, offer that instead of asking someone to invent one. */
  const next = onToggleTask ? nextTask(tasks) : null
  const openSteps = tasks.filter((t) => !t.done).length

  return (
    <div className="nudge" style={{ '--goal-color': color }}>
      <div className="nudge-inner">
        <div className="nudge-body">
          <div className="nudge-eyebrow">
            <span className="eyebrow-icon" aria-hidden="true">
              {practice ? <RotateCw size={15} /> : pick.fresh ? <Sprout size={15} /> : <MousePointerClick size={15} />}
            </span>
            {practice
              ? 'Keep it from fading'
              : pick.fresh ? 'Start here' : cycled ? 'Also needs you' : 'Your nudge today'}
          </div>

          <h1 className="nudge-title">
            <GoalIcon id={goal.emoji} size={26} />
            {goal.name}
          </h1>

          <p className="nudge-reason">
            <strong style={{ fontWeight: 600 }}>{lead}</strong>{' '}
            {detail}.{goal.why ? ` You said: “${goal.why}”` : ''}
          </p>

          <div className="nudge-facts">
            <div className="nudge-fact">
              <div className="k">{practice ? 'Last practised' : 'Last logged'}</div>
              <div className="v">{relativeDays(stats.daysSince)}</div>
            </div>
            {practice && (
              <div className="nudge-fact">
                <div className="k">Revisit every</div>
                <div className="v">
                  {revisit.every}
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 550 }}> days</span>
                </div>
              </div>
            )}
            {!practice && stats.target > 0 && (
              <div className="nudge-fact">
                <div className="k">Last {stats.periodLength} days</div>
                <div className="v">
                  {formatAmount(stats.rolling, unit)}
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 550 }}>
                    {' '}/ {formatAmount(stats.target, unit)} {unit.abbr || unitWord(stats.target, unit)}
                  </span>
                </div>
              </div>
            )}
            <div className="nudge-fact">
              <div className="k">{practice ? 'Overdue by' : 'Streak'}</div>
              <div className="v">
                {practice
                  ? `${revisit.overdue} ${revisit.overdue === 1 ? 'day' : 'days'}`
                  : `${stats.streak} ${stats.streak === 1 ? 'day' : 'days'}`}
              </div>
            </div>
          </div>

          {next && (
            <div className="nudge-next">
              <button
                className="task-check"
                role="checkbox"
                aria-checked="false"
                onClick={() => onToggleTask(next.id)}
                aria-label={`Finish ${next.title}`}
              >
                <span aria-hidden="true">✓</span>
              </button>
              <span style={{ minWidth: 0 }}>
                <span className="k">
                  Next step{openSteps > 1 ? ` · ${openSteps - 1} more waiting` : ''}
                </span>
                <span className="v">{next.title}</span>
              </span>
              <span className="worth">
                {Number(next.amount) > 0 ? withUnit(next.amount, unit) : 'no amount'}
              </span>
            </div>
          )}

          <div className="nudge-actions">
            <button className="btn btn-primary" onClick={() => onLog(goal.id)}>
              {practice ? `Practise ${goal.name}` : `Log ${goal.name}`}
            </button>
            <button className="btn" onClick={() => onOpen(goal.id)}>See progress</button>
            {others.length > 0 && (
              <button className="btn btn-ghost" onClick={onCycle}>
                {cycled ? 'Back to top nudge' : 'Nudge me about something else'}
              </button>
            )}
          </div>

          <p className="hint" style={{ marginTop: 12 }}>
            {suggestedAction(goal, stats, mode)}.
          </p>
        </div>
      </div>
    </div>
  )
}
