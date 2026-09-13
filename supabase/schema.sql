-- Compassed schema.
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query). It is
-- safe to re-run: every statement is idempotent, so applying it again is how an
-- existing project picks up tables added later (savings pots, for instance).
--
-- Each row keeps the app's existing camelCase object as-is in `data` (jsonb),
-- so the client's model.js shapes don't need a parallel SQL schema to stay in
-- sync with. `user_id` + row level security is what makes each account's data
-- private; `goal_id` on entries/tasks exists so deleting a goal cascades.

create table if not exists public.goals (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

-- Savings pots and the money put into them. A pot is not a goal: it carries a
-- price rather than a target per week, so it lives in its own pair of tables
-- and never reaches the nudge. Deleting a pot cascades to its deposits.
create table if not exists public.savings_pots (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.deposits (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  pot_id uuid not null references public.savings_pots(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb
);

create index if not exists goals_user_id_idx on public.goals(user_id);
create index if not exists entries_user_id_idx on public.entries(user_id);
create index if not exists entries_goal_id_idx on public.entries(goal_id);
create index if not exists tasks_user_id_idx on public.tasks(user_id);
create index if not exists tasks_goal_id_idx on public.tasks(goal_id);
create index if not exists savings_pots_user_id_idx on public.savings_pots(user_id);
create index if not exists deposits_user_id_idx on public.deposits(user_id);
create index if not exists deposits_pot_id_idx on public.deposits(pot_id);

alter table public.goals enable row level security;
alter table public.entries enable row level security;
alter table public.tasks enable row level security;
alter table public.savings_pots enable row level security;
alter table public.deposits enable row level security;
alter table public.settings enable row level security;

-- `create policy` has no `if not exists`, so every policy is dropped first —
-- that makes this whole file safe to re-run when new tables are added to it.
drop policy if exists "own goals" on public.goals;
create policy "own goals" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own entries" on public.entries;
create policy "own entries" on public.entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own tasks" on public.tasks;
create policy "own tasks" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own savings pots" on public.savings_pots;
create policy "own savings pots" on public.savings_pots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own deposits" on public.deposits;
create policy "own deposits" on public.deposits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own settings" on public.settings;
create policy "own settings" on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
