# Compassed

A goal tracker built around one problem: you fall into one goal and forget the
others. NudgeNow watches which goals go quiet, and each day points you at the one
that's slipping — with a heatmap and progress chart per goal so you can see it,
not just be told it.

```bash
npm install
cp .env.example .env   # then fill in your Supabase project URL + anon key
npm run dev
```

Your goals live in your own Supabase account and follow you across devices —
sign up with email or a magic link, and everything you log is scoped to you
alone via row level security. Settings → **Export backup** writes a JSON file
you can re-import later, and **Sign out** is in Settings → Account.

See [`supabase/schema.sql`](supabase/schema.sql) for the tables/policies to run
in your Supabase project's SQL editor before first use. It's safe to re-run, and
re-running it is how an existing project picks up tables added later — the
savings pots below, for instance.

First run is empty. Settings → **Load sample data** fills it with five plausible
goals, six months of history, and a few starter steps if you'd rather see the
charts before typing anything in.

## How the compassed decides

Two independent signals per goal, blended by a slider in Settings:

| Signal | What it measures |
|---|---|
| **Recency** | Days since you last logged, on a saturating curve — so "12 days" and "40 days" both read as very stale without one ancient goal permanently owning the nudge. The curve's midpoint is the *"starts feeling neglected after N days"* setting. |
| **Deficit** | How far under target you are across a rolling window the length of the goal's own cadence. Unit-free (a fraction of target), so hours, projects, and pages compete fairly. |

```
score = w · recency  +  (1 − w) · deficit
```

`w` is the Settings slider — all the way left is pure "furthest behind target",
all the way right is pure "longest neglected", and the middle means a goal has to
be *both* quiet and behind to reach the top. The Settings page shows the live
ranking with your current weights, so you can see the effect as you drag.

A rolling window is used rather than the calendar week on purpose: a calendar
week resets to zero every Monday and would claim you're 100% behind on Monday
morning.

When every goal is fresh and near target, the nudge card says so instead of
manufacturing something to worry about.

## What each goal tracks

Goals are measured in **your** unit — hours, projects, pages, km, reps, lessons,
or a custom one you name — with a target per week or per month. Language learning
in hours and coding in projects sit side by side and are still comparable, because
the cross-goal view indexes each to its own target.

Per goal you get:

- **Progress chart** — weekly/monthly totals against your target line, or a
  cumulative view, over 3M / 6M / 1Y.
- **Consistency heatmap** — up to a year of days, darker for bigger days.
  Click any square to log against that date.
- **Next steps** — the to-do list for that goal (see below).
- Streak, all-time total, pace against this period's target, and an editable
  entry log.

And across all goals, on **Today**:

- The nudge card, with the reason it picked that goal and a bite-sized ask.
- **Balance across goals** — every goal on one axis as a share of its own target,
  lowest first. This is the direct answer to "which one am I neglecting?"
- A **category filter row**, scoping the board to Learning, Health, Creative, or
  whatever you name — see [Categories](#categories) below.
- **Attention balance** (0–100) — normalised entropy of how your effort is spread.
  100 means perfectly even; low means one goal is eating everything.
- A cross-goal heatmap of how many different goals you touched each day.

## Steps: to-dos that move the goal

A target on its own doesn't tell you what to actually do this afternoon. Each goal
has a **Next steps** list — the concrete things you mean to do — and each step
carries the amount it is worth in the goal's own unit:

| Step | Worth |
|---|---|
| Finish Genki chapter 4 | 1.5 hours |
| Shadow three podcast episodes | 1 hour |
| Book a tutor session | 1 hour |

Tick one off and that amount is logged against the goal, dated today. The bar
moves, the streak counts it, the heatmap fills in — because ticking a step doesn't
create a special kind of progress, it writes an ordinary entry, which you'll see in
the entry log with the step's name on it.

That link runs both ways, so the numbers can't drift from the list:

- **Untick a step** and exactly the entry it created is removed. Nothing else.
- **Delete that entry** from the log and the step goes back to open — a checkbox
  never claims credit for progress that isn't there.
- **Delete a finished step** and the progress it logged stays. The work happened;
  only the to-do goes.

A step worth **0** is allowed, for things with no measurable size ("get the piano
tuned"). It ticks off without touching the goal's numbers.

Above the list, the open steps are totalled against what this period still needs —
*"3 open steps · 45 minutes planned · 32% of what's left"* — so you can see at a
glance whether what you've written down is actually enough to hit the target, or
whether you need to plan more.

The first open step also appears on the **nudge card** on Today, with its own
checkbox. When a goal is nudged, the smallest useful ask is usually already written
down, so you can tick it there instead of inventing one.

Archived goals keep their list, read-only, as a record of what the goal was built
from.

## Finishing a goal

A goal that's done shouldn't just be deleted, and it shouldn't keep nagging
either. Marking one complete asks a single question:

| Ending | What happens |
|---|---|
| **Archive** | Filed away with its full history. Never nudged, left out of every count, and one click from coming back. Lives under *Archive → Completed*. |
| **Revisit** | Finished, but kept warm. It leaves the target treadmill and is nudged only when its interval elapses — weekly through twice-yearly, or any number of days you type. |

Revisit exists for the things you *learned* rather than the things you're
grinding: a skill you worked for will quietly rust if nothing ever asks you to
touch it again. A revisit goal scores **zero** until its interval has passed, so
it never competes for daily attention; once due it enters just above the nudge
threshold and climbs from there, so something badly overdue eventually outranks
a merely quiet goal. Logging against it resets the clock.

Revisit goals get their own *Keeping it fresh* section on Today and their own
sidebar group showing the days until each is due. They sit out the attention
balance score — they're deliberately low-volume, and counting them would read as
lopsided when it's the intended shape.

Anything archived can be moved into revisit later, and anything in revisit can go
back to being fully active.

## Savings: things you're saving up for

Goals are practices. **Savings** is the other half: the things you're saving up
*for* — a car, a laptop, a trip — each with what it costs and a bar showing how
close you are to buying it.

- Add an item with its price. A rough price is fine, and 0 is allowed if you
  don't know it yet — the pot still totals what you put in, it just has nothing
  to fill.
- **Add money** whenever you put something aside. Every payment is a dated
  record with an optional note, listed on the item's page.
- Needed some of it back? Switch the dialog to **Take out** — a withdrawal is
  just a negative payment, so the balance is always the plain sum of a list you
  can see and correct. Nothing is stored as a total that can drift.
- Once a week of history exists, the item estimates how far off it is at the
  pace you're actually saving — a fortnight of putting nothing in slows the
  estimate down, which is the part worth knowing.
- When it's fully funded, mark it **Bought**. It keeps every payment, moves to
  the bottom of the page, and stops counting towards what you still need.

Savings sit outside the nudge entirely. A pot measures a balance against a
price, not a practice going quiet, so it's never scored, never ranked, and never
the thing Compassed points you at. Set the currency in Settings → Appearance.

## Categories

Goals can carry a category — free text, with `Learning` / `Health` / `Creative` /
`Career` / `Personal` offered as starting suggestions. Type a new one in the goal
editor and it exists; every category already in use shows up as a one-tap chip.

Categories group the sidebar and the goal list, and add a filter row above the
board that scopes the stat tiles, the balance chart, and the cross-goal heatmap.

**The nudge deliberately stays global.** Scoring never looks at categories, and
the nudge card sits *above* the filter row — so narrowing the board to one
category can't hide a slipping goal from another. That would reintroduce exactly
the problem the app exists to solve.

Goals with no category collect under *Uncategorised*, always sorted last.

## Customisation

- Name, icon, colour, unit, target, and cadence per goal — all editable after the fact.
- Categories, created on the fly — see above.
- Custom units with your own singular/plural and decimal precision.
- Nudge weighting and the staleness threshold.
- Light / dark / system theme, week starting Monday or Sunday, heatmap length.
- Complete a goal into the archive, or into revisit on your own interval — see above.
- Data tables under every chart (Settings → *Show data tables*).

## Keyboard

| Key | Action |
|---|---|
| `N` | New goal |
| `L` | Log progress |
| `A` | Activity |
| `S` | Savings |
| `↵` | Add the step you're typing, from the Next steps field |
| `G` | Back to Today |
| `,` | Settings |
| `⌘↵` | Save, from inside the log dialog |
| `Esc` | Close a dialog |

## Layout

```
src/
  lib/
    date.js            local-date helpers, week/month bucketing
    model.js            goal, entry & task shapes, lifecycle, unit presets, colour slots
    savings.js          savings pot & deposit shapes, money formatting, pot stats
    stats.js            streaks, rolling totals, per-period series, balance, task totals
    nudge.js            the scoring engine
    chart.js            axis ticks, mark paths, resize hook
    supabaseClient.js   the Supabase client, built from VITE_SUPABASE_URL / _ANON_KEY
    db.js               per-user reads/writes against Supabase
    storage.js          JSON backup export/import
    sample.js           the demo dataset
  components/    Heatmap, ProgressChart, BalanceBars, Sparkline, TaskList, AuthScreen, cards, modals
  views/         Dashboard, GoalDetail, ArchiveView, SavingsView, SavingsDetail, SettingsView

supabase/
  schema.sql     tables + row level security policies — idempotent, re-run to update
```

Charts are hand-drawn SVG — no charting dependency. The eight goal colours are a
colourblind-validated categorical set with separately-chosen dark-mode steps; every
chart also has a table view, and goals are direct-labelled so identity never rests
on colour alone.
