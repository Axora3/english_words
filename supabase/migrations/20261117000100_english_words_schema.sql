-- English Words — cloud schema.
-- Safe to run in a Supabase project shared with other apps:
--   * every object is prefixed ew_ (no existing table, function or trigger is replaced);
--   * nothing is attached to auth.users (other apps' sign-up flows are untouched);
--   * account deletion only removes the login when no other app in this project uses it.
-- Design: learning progress is one validated JSON document per user (the same document as the local
-- JSON backup), synced with optimistic concurrency (revision). Static content (vocabulary, grammar
-- lessons) stays in the app bundle. Every table is user-owned and protected by RLS on auth.uid().
-- Non-destructive: creates objects only.

-- ---------------------------------------------------------------- helpers
create or replace function public.ew_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- ew_profiles
-- Created by the app on first save (upsert); no trigger on auth.users.
create table public.ew_profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  display_name       text check (display_name is null or char_length(display_name) between 1 and 80),
  preferred_language text not null default 'mn' check (preferred_language in ('mn', 'en')),
  timezone           text check (timezone is null or char_length(timezone) <= 64),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger ew_profiles_set_updated_at before update on public.ew_profiles
  for each row execute function public.ew_set_updated_at();

-- ---------------------------------------------------------------- ew_learning_states
-- One synced learning document per user. revision increases by one on every accepted write.
create table public.ew_learning_states (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  state          jsonb not null check (jsonb_typeof(state) = 'object'),
  schema_version smallint not null default 1 check (schema_version >= 1),
  revision       bigint not null default 1 check (revision >= 1),
  device_id      text check (device_id is null or char_length(device_id) <= 64),
  updated_at     timestamptz not null default now(),
  constraint ew_learning_states_state_size check (pg_column_size(state) <= 4194304)
);

-- ---------------------------------------------------------------- ew_cloud_backups
-- Immutable snapshots for manual backup/restore history (newest 30 per user are kept).
create table public.ew_cloud_backups (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label          text check (label is null or char_length(label) <= 120),
  reason         text not null default 'manual'
                 check (reason in ('manual', 'before-restore', 'before-replace', 'migration')),
  schema_version smallint not null default 1 check (schema_version >= 1),
  words_learned  integer not null default 0 check (words_learned >= 0),
  state          jsonb not null check (jsonb_typeof(state) = 'object'),
  created_at     timestamptz not null default now(),
  constraint ew_cloud_backups_state_size check (pg_column_size(state) <= 4194304)
);
create index ew_cloud_backups_user_created_idx on public.ew_cloud_backups (user_id, created_at desc);

create or replace function public.ew_trim_cloud_backups()
returns trigger language plpgsql set search_path = '' as $$
begin
  delete from public.ew_cloud_backups b
  where b.user_id = new.user_id
    and b.id in (select id from public.ew_cloud_backups
                 where user_id = new.user_id order by created_at desc offset 30);
  return null;
end $$;
create trigger ew_cloud_backups_trim after insert on public.ew_cloud_backups
  for each row execute function public.ew_trim_cloud_backups();

-- ---------------------------------------------------------------- Row Level Security
alter table public.ew_profiles        enable row level security;
alter table public.ew_learning_states enable row level security;
alter table public.ew_cloud_backups   enable row level security;

create policy "ew_profiles: read own"   on public.ew_profiles for select to authenticated using ((select auth.uid()) = id);
create policy "ew_profiles: insert own" on public.ew_profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "ew_profiles: update own" on public.ew_profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "ew_learning_states: read own"   on public.ew_learning_states for select to authenticated using ((select auth.uid()) = user_id);
create policy "ew_learning_states: insert own" on public.ew_learning_states for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ew_learning_states: update own" on public.ew_learning_states for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ew_learning_states: delete own" on public.ew_learning_states for delete to authenticated using ((select auth.uid()) = user_id);

create policy "ew_cloud_backups: read own"   on public.ew_cloud_backups for select to authenticated using ((select auth.uid()) = user_id);
create policy "ew_cloud_backups: insert own" on public.ew_cloud_backups for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ew_cloud_backups: delete own" on public.ew_cloud_backups for delete to authenticated using ((select auth.uid()) = user_id);
-- No update policy: backups are immutable.

-- Anonymous visitors get no access at all; signed-in users only what RLS allows.
revoke all on public.ew_profiles, public.ew_learning_states, public.ew_cloud_backups from anon;
revoke all on public.ew_profiles, public.ew_learning_states, public.ew_cloud_backups from authenticated;
grant select, insert, update          on public.ew_profiles        to authenticated;
grant select, insert, update, delete  on public.ew_learning_states to authenticated;
grant select, insert, delete          on public.ew_cloud_backups   to authenticated;

-- ---------------------------------------------------------------- sync RPC
-- Compare-and-swap write of the learning document. Runs as the caller (RLS applies) and always
-- uses auth.uid(), never a client-supplied user id.
--   p_base_revision = 0  → create the first document (returns 'conflict' if one exists)
--   p_base_revision = n  → replace only if the stored revision is still n
-- Returns {"status": "ok"|"conflict", "revision": n|null, "updated_at": ...}.
create or replace function public.ew_push_learning_state(p_state jsonb, p_base_revision bigint, p_device_id text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  rec public.ew_learning_states;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' or (p_state ->> 'version') is distinct from '1' then
    raise exception 'invalid learning state' using errcode = '22023';
  end if;
  if p_base_revision = 0 then
    insert into public.ew_learning_states as s (user_id, state, device_id)
    values (uid, p_state, p_device_id)
    on conflict (user_id) do nothing
    returning s.* into rec;
  else
    update public.ew_learning_states as s
       set state = p_state, revision = s.revision + 1, device_id = p_device_id, updated_at = now()
     where s.user_id = uid and s.revision = p_base_revision
    returning s.* into rec;
  end if;
  if rec.user_id is null then
    select s.* into rec from public.ew_learning_states s where s.user_id = uid;
    return jsonb_build_object('status', 'conflict', 'revision', rec.revision, 'updated_at', rec.updated_at);
  end if;
  return jsonb_build_object('status', 'ok', 'revision', rec.revision, 'updated_at', rec.updated_at);
end $$;
revoke all on function public.ew_push_learning_state(jsonb, bigint, text) from public, anon;
grant execute on function public.ew_push_learning_state(jsonb, bigint, text) to authenticated;

-- ---------------------------------------------------------------- account deletion
-- Deletes all English Words data of the caller. The login itself (auth.users) is deleted too,
-- unless another app in this project still uses it (currently: membership in public.admin_users).
-- Returns {"login_deleted": true|false}.
create or replace function public.ew_delete_my_account()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  used_elsewhere boolean := false;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from public.ew_cloud_backups   where user_id = uid;
  delete from public.ew_learning_states where user_id = uid;
  delete from public.ew_profiles        where id = uid;
  if to_regclass('public.admin_users') is not null then
    execute 'select exists (select 1 from public.admin_users where user_id = $1)' into used_elsewhere using uid;
  end if;
  if not used_elsewhere then
    delete from auth.users where id = uid;
  end if;
  return jsonb_build_object('login_deleted', not used_elsewhere);
end $$;
revoke all on function public.ew_delete_my_account() from public, anon;
grant execute on function public.ew_delete_my_account() to authenticated;
