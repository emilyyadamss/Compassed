import { useState } from 'react'
import { colorVar, formatAmount, unitFor, unitWord } from '../lib/model.js'
import { useMeasure, barPath } from '../lib/chart.js'
import ChartTooltip from './ChartTooltip.jsx'
import { GoalIcon } from '../lib/goalIcons.jsx'

/* Every goal on ONE axis: progress as a share of its own target. Different
   units (hours, pages, km) become comparable by indexing to a common base,
   which is what makes "which one is lagging" answerable at a glance.
   Each goal keeps its own hue and is direct-labelled, so identity never
   depends on colour alone. */

const ROW = 34
const PAD_R = 54
const PAD_T = 16
const PAD_B = 22
const BAR_H = 16
const CAP = 1.25 // draw up to 125% — beyond that the bar just reads as "done"

export default function BalanceBars({ ranked, showTable }) {
  const [ref, width] = useMeasure()
  const [hover, setHover] = useState(null)

  const rows = ranked
    .map(({ goal, stats }) => {
      const unit = unitFor(goal)
      const pct = stats.target > 0 ? stats.rolling / stats.target : stats.rolling > 0 ? 1 : 0
      return { goal, stats, unit, pct }
    })
    .sort((a, b) => a.pct - b.pct)

  if (rows.length === 0) return null

  const height = PAD_T + rows.length * ROW + PAD_B
  // The name gutter gives way on narrow screens so the bars keep useful length.
  const PAD_L = Math.max(76, Math.min(132, width * 0.34))
  const nameChars = Math.max(6, Math.floor((PAD_L - 34) / 7))
  const plotW = Math.max(80, width - PAD_L - PAD_R)
  const x = (p) => PAD_L + (Math.min(p, CAP) / CAP) * plotW

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Balance across goals</div>
          <div className="card-sub">
            Progress against each goal's own target over its last cycle. Lowest first
          </div>
        </div>
      </div>

      <div className="viz" ref={ref}>
        {width > 0 && (
          <svg height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Progress against target per goal">
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <g key={t}>
                <line
                  className={t === 1 ? 'axis-line' : 'grid-line'}
                  x1={x(t)} x2={x(t)} y1={PAD_T - 4} y2={PAD_T + rows.length * ROW}
                />
                <text className="axis-text" x={x(t)} y={height - 6} textAnchor="middle">
                  {t === 1 ? 'target' : `${t * 100}%`}
                </text>
              </g>
            ))}

            {rows.map((r, i) => {
              const y = PAD_T + i * ROW + (ROW - BAR_H) / 2
              const met = r.pct >= 1
              const color = met ? 'var(--good)' : colorVar(r.goal.colorSlot)
              const w = x(r.pct) - PAD_L
              const dim = hover && hover.goal.id !== r.goal.id
              return (
                <g key={r.goal.id} opacity={dim ? 0.45 : 1} style={{ transition: 'opacity 140ms ease' }}>
                  <rect
                    x={0} y={PAD_T + i * ROW} width={width} height={ROW} fill="transparent"
                    onMouseEnter={() => setHover({ ...r, x: Math.max(x(r.pct), PAD_L + 40), y })}
                    onMouseLeave={() => setHover(null)}
                  />
                  <text
                    className="chart-label"
                    x={PAD_L - 12} y={y + BAR_H / 2 + 4}
                    textAnchor="end"
                    pointerEvents="none"
                  >
                    {r.goal.name.length > nameChars ? `${r.goal.name.slice(0, nameChars - 1)}…` : r.goal.name}
                  </text>
                  {/* track: a lighter step of the bar's own hue */}
                  <rect
                    x={PAD_L} y={y} width={plotW} height={BAR_H} rx={4}
                    fill={`color-mix(in oklab, ${color} 12%, var(--surface-sunken))`}
                    pointerEvents="none"
                  />
                  <path d={barPath(PAD_L, y, w, BAR_H)} fill={color} pointerEvents="none" />
                  {met && w > 70 && (
                    <text
                      className="chart-label-oncomplete"
                      x={x(r.pct) - 8} y={y + BAR_H / 2 + 4}
                      textAnchor="end"
                      pointerEvents="none"
                    >
                      ✓ complete
                    </text>
                  )}
                  <text
                    className="chart-label"
                    x={x(r.pct) + 9} y={y + BAR_H / 2 + 4}
                    pointerEvents="none"
                  >
                    {Math.round(r.pct * 100)}%
                  </text>
                </g>
              )
            })}
          </svg>
        )}

        {hover && (
          <ChartTooltip x={hover.x} y={hover.y} containerWidth={width}>
            <div className="tt-date">{hover.goal.name}</div>
            <div className="tt-row">
              <span className="tt-key">
                <span className="swatch" style={{ background: colorVar(hover.goal.colorSlot) }} />
                Last {hover.stats.periodLength} days
              </span>
              <span className="tt-val">{formatAmount(hover.stats.rolling, hover.unit)}</span>
            </div>
            <div className="tt-row">
              <span className="tt-key">Target</span>
              <span className="tt-val">
                {formatAmount(hover.stats.target, hover.unit)} {hover.unit.abbr || unitWord(hover.stats.target, hover.unit)}
              </span>
            </div>
          </ChartTooltip>
        )}
      </div>

      {showTable && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Goal</th>
                <th>Recent</th>
                <th>Target</th>
                <th>% of target</th>
                <th>Last logged</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.goal.id}>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <GoalIcon id={r.goal.emoji} size={14} /> {r.goal.name}
                    </span>
                  </td>
                  <td className="num">{formatAmount(r.stats.rolling, r.unit)} {r.unit.abbr}</td>
                  <td className="num">{formatAmount(r.stats.target, r.unit)} {r.unit.abbr}</td>
                  <td className="num">{Math.round(r.pct * 100)}%</td>
                  <td className="num">{r.stats.daysSince == null ? 'never' : `${r.stats.daysSince}d ago`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
