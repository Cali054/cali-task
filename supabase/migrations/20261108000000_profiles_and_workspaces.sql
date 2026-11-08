-- Cali: profiles and workspaces for Supabase Auth users (Google sign-in).
--
-- Run once in the Supabase SQL editor (or with `supabase db push`).
-- Safe to re-run: every statement is idempotent.
--
-- Security model
--   * Every row is keyed by the Supabase Auth user id (auth.users.id).
--   * Row Level Security is on for both tables; a signed-in user can only
--     read and change their own rows. Anonymous visitors can read nothing.
--   * Profiles are created and refreshed by triggers on auth.users, never by
--     the browser, so identity fields (email, Google id, verification status)
--     can't be forged from the client. The browser may only change its own
--     display_name, and record consent through record_consent().

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           text,
  full_name       text,
  display_name    text check (display_name is null or char_length(display_name) between 1 and 80),
  avatar_url      text,
  google_id       text,
  email_verified  boolean not null default false,
  consent_version text,
  consent_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.workspaces (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  -- Same 5 MB ceiling the app applies to backup imports.
  constraint workspaces_data_size check (pg_column_size(data) <= 5 * 1024 * 1024)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles   enable row level security;
alter table public.workspaces enable row level security;

drop policy if exists "Own profile: read"   on public.profiles;
drop policy if exists "Own profile: update" on public.profiles;
create policy "Own profile: read"   on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Own profile: update" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "Own workspace: read"   on public.workspaces;
drop policy if exists "Own workspace: insert" on public.workspaces;
drop policy if exists "Own workspace: update" on public.workspaces;
drop policy if exists "Own workspace: delete" on public.workspaces;
create policy "Own workspace: read"   on public.workspaces for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own workspace: insert" on public.workspaces for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Own workspace: update" on public.workspaces for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Own workspace: delete" on public.workspaces for delete to authenticated using ((select auth.uid()) = user_id);

-- Column privileges: the browser can read its profile and change only the
-- display name. Everything else is written by the triggers below.
revoke all on public.profiles   from anon, authenticated;
revoke all on public.workspaces from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.workspaces to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists workspaces_touch on public.workspaces;
create trigger workspaces_touch before update on public.workspaces
  for each row execute function public.touch_updated_at();

-- Create the profile when an auth user is created (first Google sign-in).
-- Supabase links a Google identity to an existing user with the same
-- verified email, so a returning user never gets a second profile; the
-- primary key on profiles.id is the final guard against duplicates.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  name text  := nullif(left(coalesce(meta ->> 'full_name', meta ->> 'name', ''), 80), '');
begin
  insert into public.profiles (id, email, full_name, display_name, avatar_url, google_id, email_verified)
  values (
    new.id,
    new.email,
    name,
    name,
    nullif(coalesce(meta ->> 'avatar_url', meta ->> 'picture'), ''),
    nullif(coalesce(meta ->> 'provider_id', meta ->> 'sub'), ''),
    coalesce((meta ->> 'email_verified')::boolean, new.email_confirmed_at is not null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep the profile in sync with Google on later sign-ins (new photo, name or
-- verification status). The user's own display_name is left alone.
create or replace function public.handle_user_updated()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  update public.profiles set
    email          = new.email,
    full_name      = coalesce(nullif(left(coalesce(meta ->> 'full_name', meta ->> 'name', ''), 80), ''), full_name),
    avatar_url     = coalesce(nullif(coalesce(meta ->> 'avatar_url', meta ->> 'picture'), ''), avatar_url),
    google_id      = coalesce(nullif(coalesce(meta ->> 'provider_id', meta ->> 'sub'), ''), google_id),
    email_verified = coalesce((meta ->> 'email_verified')::boolean, new.email_confirmed_at is not null)
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated after update of email, raw_user_meta_data, email_confirmed_at on auth.users
  for each row execute function public.handle_user_updated();

-- Records which Privacy Policy / Terms version the user accepted. The
-- timestamp comes from the database clock, not the browser.
create or replace function public.record_consent(p_version text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  update public.profiles
     set consent_version = left(p_version, 32), consent_at = now()
   where id = auth.uid()
     and consent_version is distinct from left(p_version, 32);
end;
$$;

revoke all on function public.record_consent(text) from public, anon;
grant execute on function public.record_consent(text) to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_user_updated() from public, anon, authenticated;
