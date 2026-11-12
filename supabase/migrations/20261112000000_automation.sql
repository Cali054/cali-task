-- Cali — Automation Center
--
-- Workflows, their executions (with one row per executed step), schedules,
-- notifications and an audit log. Every table is private to its owner via
-- Row Level Security. Run this in the Supabase SQL editor after
-- 20261108000000_profiles_and_workspaces.sql. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Server-side validation of workflow definitions
-- ---------------------------------------------------------------------------
-- Only known step types are accepted, sizes are capped, and every step's
-- settings must be a JSON object. Nothing in a definition is ever executed
-- as code or SQL.
create or replace function public.validate_workflow_definition(def jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  n jsonb;
  allowed text[] := array[
    'trigger.task_created','trigger.task_updated','trigger.task_status_changed','trigger.task_assigned',
    'trigger.task_completed','trigger.task_deadline_approaching','trigger.task_overdue','trigger.sprint_created',
    'trigger.sprint_started','trigger.sprint_completed','trigger.schedule','trigger.manual',
    'condition.if_else','condition.status_equals','condition.priority_equals','condition.assignee_equals',
    'condition.deadline','condition.sprint_progress','condition.field_compare','condition.and_or',
    'action.create_task','action.update_task','action.change_status','action.assign_user','action.set_priority',
    'action.update_deadline','action.add_comment','action.notify','action.email','action.sprint_report',
    'action.create_sprint','action.update_sprint_progress',
    'utility.delay','utility.format_date','utility.text','utility.merge','utility.calculate','utility.filter'
  ];
  triggers int := 0;
begin
  if jsonb_typeof(def) is distinct from 'object'
     or jsonb_typeof(def->'nodes') is distinct from 'array'
     or jsonb_typeof(def->'edges') is distinct from 'array' then
    return false;
  end if;
  if jsonb_array_length(def->'nodes') > 60 or jsonb_array_length(def->'edges') > 150 then
    return false;
  end if;
  for n in select value from jsonb_array_elements(def->'nodes') loop
    if not coalesce((n->>'type') = any(allowed), false) then return false; end if;
    if jsonb_typeof(n->'config') is distinct from 'object' then return false; end if;
    if (n->>'type') like 'trigger.%' then triggers := triggers + 1; end if;
  end loop;
  return triggers <= 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.workflows (
  id                  uuid primary key,
  user_id             uuid not null references auth.users (id) on delete cascade,
  name                text not null check (char_length(name) between 1 and 120),
  description         text not null default '' check (char_length(description) <= 1000),
  status              text not null default 'draft' check (status in ('draft', 'active', 'inactive')),
  workflow_definition jsonb not null
                      check (pg_column_size(workflow_definition) < 262144
                             and public.validate_workflow_definition(workflow_definition)),
  settings            jsonb not null default '{}'::jsonb,
  template_id         text,
  created_by          uuid not null references auth.users (id) on delete cascade,
  activated_at        timestamptz,
  last_run_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists workflows_user_idx on public.workflows (user_id, updated_at desc);

create table if not exists public.workflow_executions (
  id               uuid primary key,
  workflow_id      uuid not null references public.workflows (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  trigger_event_id text check (char_length(trigger_event_id) <= 300),
  trigger_type     text not null,
  source           text not null check (source in ('event', 'schedule', 'manual', 'test')),
  status           text not null check (status in ('success', 'failed', 'running', 'waiting', 'cancelled')),
  dry_run          boolean not null default false,
  depth            smallint not null default 0 check (depth between 0 and 10),
  input_data       jsonb,
  output_data      jsonb,
  resume_state     jsonb check (resume_state is null or pg_column_size(resume_state) < 524288),
  error_message    text check (char_length(error_message) <= 2000),
  started_at       timestamptz not null default now(),
  completed_at     timestamptz
);
create index if not exists workflow_executions_user_idx on public.workflow_executions (user_id, started_at desc);
create index if not exists workflow_executions_workflow_idx on public.workflow_executions (workflow_id, started_at desc);
-- One run per workflow per event: duplicate deliveries (two tabs, two devices) are rejected.
create unique index if not exists workflow_executions_event_uniq
  on public.workflow_executions (workflow_id, trigger_event_id) where trigger_event_id is not null;

create table if not exists public.workflow_node_executions (
  id            uuid primary key,
  execution_id  uuid not null references public.workflow_executions (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  node_id       text not null,
  node_type     text not null,
  label         text not null default '',
  status        text not null check (status in ('success', 'failed', 'skipped', 'running', 'waiting')),
  input_data    jsonb check (input_data is null or pg_column_size(input_data) < 131072),
  output_data   jsonb check (output_data is null or pg_column_size(output_data) < 131072),
  branch        jsonb,
  attempts      smallint not null default 1,
  duration_ms   integer not null default 0,
  error_message text check (char_length(error_message) <= 2000),
  started_at    timestamptz not null,
  completed_at  timestamptz
);
create index if not exists workflow_node_executions_exec_idx on public.workflow_node_executions (execution_id, started_at);

create table if not exists public.workflow_schedules (
  id                     uuid primary key,
  workflow_id            uuid not null unique references public.workflows (id) on delete cascade,
  user_id                uuid not null references auth.users (id) on delete cascade,
  schedule_type          text not null check (schedule_type in ('daily', 'weekly', 'monthly', 'interval')),
  schedule_configuration jsonb not null,
  next_execution_at      timestamptz,
  is_active              boolean not null default true
);
create index if not exists workflow_schedules_due_idx on public.workflow_schedules (user_id, is_active, next_execution_at);

create table if not exists public.workflow_notifications (
  id                uuid primary key,
  workflow_id       uuid references public.workflows (id) on delete set null,
  execution_id      uuid references public.workflow_executions (id) on delete set null,
  user_id           uuid not null references auth.users (id) on delete cascade,
  recipient_id      uuid not null references auth.users (id) on delete cascade,
  notification_type text not null check (notification_type in ('in_app', 'email')),
  title             text not null check (char_length(title) <= 200),
  message           text not null default '' check (char_length(message) <= 2000),
  task_id           text,
  created_at        timestamptz not null default now(),
  read_at           timestamptz
);
create index if not exists workflow_notifications_recipient_idx on public.workflow_notifications (recipient_id, created_at desc);

create table if not exists public.workflow_audit_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  workflow_id uuid references public.workflows (id) on delete set null,
  action      text not null check (char_length(action) <= 60),
  detail      text not null default '' check (char_length(detail) <= 1000),
  created_at  timestamptz not null default now()
);
create index if not exists workflow_audit_log_user_idx on public.workflow_audit_log (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers: timestamps and execution limits
-- ---------------------------------------------------------------------------
drop trigger if exists workflows_touch on public.workflows;
create trigger workflows_touch before update on public.workflows
  for each row execute function public.touch_updated_at();

-- At most 500 workflow runs per user per hour, enforced by the database.
create or replace function public.enforce_execution_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.workflow_executions e
      where e.user_id = new.user_id and e.started_at > now() - interval '1 hour') >= 500 then
    raise exception 'Automation limit reached: 500 runs per hour.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists workflow_executions_limit on public.workflow_executions;
create trigger workflow_executions_limit before insert on public.workflow_executions
  for each row execute function public.enforce_execution_limit();
revoke all on function public.enforce_execution_limit() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security: everyone sees and changes only their own rows
-- ---------------------------------------------------------------------------
alter table public.workflows                enable row level security;
alter table public.workflow_executions      enable row level security;
alter table public.workflow_node_executions enable row level security;
alter table public.workflow_schedules       enable row level security;
alter table public.workflow_notifications   enable row level security;
alter table public.workflow_audit_log       enable row level security;

do $$
declare t text;
begin
  foreach t in array array['workflows', 'workflow_executions', 'workflow_node_executions', 'workflow_schedules', 'workflow_notifications', 'workflow_audit_log'] loop
    execute format('drop policy if exists "Own rows: read" on public.%I', t);
    execute format('drop policy if exists "Own rows: insert" on public.%I', t);
    execute format('drop policy if exists "Own rows: update" on public.%I', t);
    execute format('drop policy if exists "Own rows: delete" on public.%I', t);
    execute format('create policy "Own rows: read" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "Own rows: insert" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "Own rows: update" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "Own rows: delete" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end;
$$;

-- Notifications go to yourself only.
drop policy if exists "Own rows: insert" on public.workflow_notifications;
create policy "Own rows: insert" on public.workflow_notifications for insert to authenticated
  with check ((select auth.uid()) = user_id and recipient_id = user_id);

-- Workflows: full control. Schedules: claimed by updating next_execution_at.
grant select, insert, update, delete on public.workflows to authenticated;
grant select, insert, update, delete on public.workflow_schedules to authenticated;
-- Execution history: written once, then only its status/result may change.
grant select, insert, delete on public.workflow_executions to authenticated;
grant update (status, output_data, resume_state, error_message, completed_at) on public.workflow_executions to authenticated;
grant select, insert, delete on public.workflow_node_executions to authenticated;
-- Notifications: only the read marker can change.
grant select, insert, delete on public.workflow_notifications to authenticated;
grant update (read_at) on public.workflow_notifications to authenticated;
-- Audit log: append-only for the app.
grant select, insert on public.workflow_audit_log to authenticated;
