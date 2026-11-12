-- Cali — AI keys for the "AI Write Text" automation step
--
-- Stores each user's own Gemini / OpenAI API key, encrypted by the app server
-- (AES-256-GCM with the server-only AI_KEYS_SECRET) before it reaches the
-- database. The plain key is never stored and never sent back to the browser.
-- Run after 20261112000000_automation.sql. Safe to re-run.

create table if not exists public.ai_keys (
  user_id    uuid not null references auth.users (id) on delete cascade,
  provider   text not null check (provider in ('gemini', 'openai')),
  ciphertext text not null check (char_length(ciphertext) <= 2000),
  last4      text not null check (char_length(last4) <= 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

-- One row per AI request, used for the hourly limit.
create table if not exists public.ai_usage (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  provider   text not null check (provider in ('gemini', 'openai')),
  model      text not null check (char_length(model) <= 100),
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_idx on public.ai_usage (user_id, created_at desc);

drop trigger if exists ai_keys_touch on public.ai_keys;
create trigger ai_keys_touch before update on public.ai_keys
  for each row execute function public.touch_updated_at();

alter table public.ai_keys  enable row level security;
alter table public.ai_usage enable row level security;

drop policy if exists "Own rows: read"   on public.ai_keys;
drop policy if exists "Own rows: insert" on public.ai_keys;
drop policy if exists "Own rows: update" on public.ai_keys;
drop policy if exists "Own rows: delete" on public.ai_keys;
create policy "Own rows: read"   on public.ai_keys for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own rows: insert" on public.ai_keys for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Own rows: update" on public.ai_keys for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own rows: delete" on public.ai_keys for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Own rows: read"   on public.ai_usage;
drop policy if exists "Own rows: insert" on public.ai_usage;
create policy "Own rows: read"   on public.ai_usage for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own rows: insert" on public.ai_usage for insert to authenticated with check ((select auth.uid()) = user_id);

revoke all on public.ai_keys  from anon, authenticated;
revoke all on public.ai_usage from anon, authenticated;
grant select, insert, update, delete on public.ai_keys to authenticated;
-- Usage rows can't be deleted from the app, so the limit can't be reset.
grant select, insert on public.ai_usage to authenticated;

-- Allow the new step type in saved workflows.
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
    'utility.delay','utility.format_date','utility.text','utility.merge','utility.calculate','utility.filter',
    'utility.ai_text'
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
