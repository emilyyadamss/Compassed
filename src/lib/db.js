/* Supabase persistence. Each goal/entry/task is stored as its existing
   camelCase object in a jsonb `data` column, keyed by the same id the app
   already gives it — so model.js stays the single source of truth for shape,
   and this file only worries about which rows belong to which user. */

import { supabase } from './supabaseClient.js'
import { DEFAULT_SETTINGS, migrateGoal, migrateTask } from './model.js'
import { migratePot, migrateDeposit } from './savings.js'

function orThrow(res) {
  if (res.error) throw res.error
  return res
}

export async function fetchState(userId) {
  const [goalsRes, entriesRes, tasksRes, potsRes, depositsRes, settingsRes] = await Promise.all([
    supabase.from('goals').select('data').eq('user_id', userId),
    supabase.from('entries').select('data').eq('user_id', userId),
    supabase.from('tasks').select('data').eq('user_id', userId),
    supabase.from('savings_pots').select('data').eq('user_id', userId),
    supabase.from('deposits').select('data').eq('user_id', userId),
    supabase.from('settings').select('data').eq('user_id', userId).maybeSingle(),
  ])
  ;[goalsRes, entriesRes, tasksRes, settingsRes].forEach(orThrow)
  // The savings tables arrived after the first release. An account whose
  // database has not had schema.sql re-run yet should still load everything
  // else rather than showing an error page, so these two are allowed to fail.
  if (potsRes.error || depositsRes.error) {
    console.warn('Savings tables unavailable — run supabase/schema.sql', potsRes.error || depositsRes.error)
  }

  return {
    goals: (goalsRes.data || []).map((r) => migrateGoal(r.data)),
    entries: (entriesRes.data || []).map((r) => r.data),
    tasks: (tasksRes.data || []).map((r) => migrateTask(r.data)),
    pots: (potsRes.data || []).map((r) => migratePot(r.data)),
    deposits: (depositsRes.data || []).map((r) => migrateDeposit(r.data)),
    settings: { ...DEFAULT_SETTINGS, ...(settingsRes.data?.data || {}) },
  }
}

export const putGoal = (userId, goal) =>
  supabase.from('goals').upsert({ id: goal.id, user_id: userId, data: goal }).then(orThrow)

export const removeGoal = (id) =>
  supabase.from('goals').delete().eq('id', id).then(orThrow)

export const putEntry = (userId, entry) =>
  supabase.from('entries')
    .upsert({ id: entry.id, user_id: userId, goal_id: entry.goalId, data: entry })
    .then(orThrow)

export const removeEntry = (id) =>
  supabase.from('entries').delete().eq('id', id).then(orThrow)

export const putTask = (userId, task) =>
  supabase.from('tasks')
    .upsert({ id: task.id, user_id: userId, goal_id: task.goalId, data: task })
    .then(orThrow)

export const removeTask = (id) =>
  supabase.from('tasks').delete().eq('id', id).then(orThrow)

export const putPot = (userId, pot) =>
  supabase.from('savings_pots').upsert({ id: pot.id, user_id: userId, data: pot }).then(orThrow)

export const removePot = (id) =>
  supabase.from('savings_pots').delete().eq('id', id).then(orThrow)

export const putDeposit = (userId, deposit) =>
  supabase.from('deposits')
    .upsert({ id: deposit.id, user_id: userId, pot_id: deposit.potId, data: deposit })
    .then(orThrow)

export const removeDeposit = (id) =>
  supabase.from('deposits').delete().eq('id', id).then(orThrow)

export const putSettings = (userId, settings) =>
  supabase.from('settings').upsert({ user_id: userId, data: settings }).then(orThrow)

/** Wholesale swap of the account's data — used by "load sample", "clear all"
    and a backup restore. Anything left out is not touched: "load sample"
    passes goals/entries/tasks only, and savings pots survive it untouched. */
export async function replaceData(userId, { goals, entries, tasks, pots, deposits }) {
  ;[
    orThrow(await supabase.from('entries').delete().eq('user_id', userId)),
    orThrow(await supabase.from('tasks').delete().eq('user_id', userId)),
    orThrow(await supabase.from('goals').delete().eq('user_id', userId)),
  ]
  if (deposits) orThrow(await supabase.from('deposits').delete().eq('user_id', userId))
  if (pots) orThrow(await supabase.from('savings_pots').delete().eq('user_id', userId))

  const inserts = []
  if (goals.length) {
    inserts.push(supabase.from('goals').insert(goals.map((g) => ({ id: g.id, user_id: userId, data: g }))))
  }
  if (entries.length) {
    inserts.push(supabase.from('entries').insert(
      entries.map((e) => ({ id: e.id, user_id: userId, goal_id: e.goalId, data: e })),
    ))
  }
  if (tasks.length) {
    inserts.push(supabase.from('tasks').insert(
      tasks.map((t) => ({ id: t.id, user_id: userId, goal_id: t.goalId, data: t })),
    ))
  }
  if (pots?.length) {
    inserts.push(supabase.from('savings_pots').insert(
      pots.map((p) => ({ id: p.id, user_id: userId, data: p })),
    ))
  }
  if (deposits?.length) {
    inserts.push(supabase.from('deposits').insert(
      deposits.map((d) => ({ id: d.id, user_id: userId, pot_id: d.potId, data: d })),
    ))
  }
  ;(await Promise.all(inserts)).forEach(orThrow)
}

/** Full backup restore — also replaces settings. */
export async function replaceAll(userId, { goals, entries, tasks, pots, deposits, settings }) {
  await replaceData(userId, { goals, entries, tasks, pots: pots || [], deposits: deposits || [] })
  await putSettings(userId, settings)
}
