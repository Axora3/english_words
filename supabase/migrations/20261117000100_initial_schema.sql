-- English Words — initial cloud schema.
-- Design: the app's learning progress is one validated JSON document per user (the same document as
-- the local JSON backup), synced with optimistic concurrency (revision). Static content (vocabulary,
-- grammar lessons) stays in the app bundle and is not stored here. Every table is user-owned and
-- protected by Row Level Security keyed on auth.uid(). Non-destructive: creates objects only.

-- ---------------------------------------------------------------- helpers
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  display_name       text check (display_name is null or char_length(display_name) between 1 and 80),
  preferred_language text not null default 'mn' check (preferred_language in ('mn', 'en')),
  timezone           text check (timezone is null or char_length(timezone) <= 64),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- A profile row is created for every new account.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- learning_states
-- One synced learning document per user. revision increases by one on every accepted write.
create table public.learning_states (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  state          jsonb not null check (jsonb_typeof(state) = 'object'),
  schema_version smallint not null default 1 check (schema_version >= 1),
  revision       bigint not null default 1 check (revision >= 1),
  device_id      text check (device_id is null or char_length(device_id) <= 64),
  updated_at     timestamptz not null default now(),
  constraint learning_states_state_size check (pg_column_size(state) <= 4194304)
);

-- ---------------------------------------------------------------- cloud_backups
-- Immutable snapshots for manual backup/restore history (newest 30 per user are kept).
create table public.cloud_backups (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label          text check (label is null or char_length(label) <= 120),
  reason         text not null default 'manual'
                 check (reason in ('manual', 'before-restore', 'before-replace', 'migration')),
  schema_version smallint not null default 1 check (schema_version >= 1),
  words_learned  integer not null default 0 check (words_learned >= 0),
  state          jsonb not null check (jsonb_typeof(state) = 'object'),
  created_at     timestamptz not null default now(),
  constraint cloud_backups_state_size check (pg_column_size(state) <= 4194304)
);
create index cloud_backups_user_created_idx on public.cloud_backups (user_id, created_at desc);

create or replace function public.trim_cloud_backups()
returns trigger language plpgsql set search_path = '' as $$
begin
  delete from public.cloud_backups b
  where b.user_id = new.user_id
    and b.id in (select id from public.cloud_backups
                 where user_id = new.user_id order by created_at desc offset 30);
  return null;
end $$;
create trigger cloud_backups_trim after insert on public.cloud_backups
  for each row execute function public.trim_cloud_backups();

-- ---------------------------------------------------------------- Row Level Security
alter table public.profiles        enable row level security;
alter table public.learning_states enable row level security;
alter table public.cloud_backups   enable row level security;

create policy "profiles: read own"   on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: insert own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles: update own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "learning_states: read own"   on public.learning_states for select to authenticated using ((select auth.uid()) = user_id);
create policy "learning_states: insert own" on public.learning_states for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "learning_states: update own" on public.learning_states for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "learning_states: delete own" on public.learning_states for delete to authenticated using ((select auth.uid()) = user_id);

create policy "cloud_backups: read own"   on public.cloud_backups for select to authenticated using ((select auth.uid()) = user_id);
create policy "cloud_backups: insert own" on public.cloud_backups for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "cloud_backups: delete own" on public.cloud_backups for delete to authenticated using ((select auth.uid()) = user_id);
-- No update policy: backups are immutable.

-- Anonymous visitors get no table access at all; signed-in users only what RLS allows.
revoke all on public.profiles, public.learning_states, public.cloud_backups from anon;
revoke all on public.profiles, public.learning_states, public.cloud_backups from authenticated;
grant select, insert, update          on public.profiles        to authenticated;
grant select, insert, update, delete  on public.learning_states to authenticated;
grant select, insert, delete          on public.cloud_backups   to authenticated;

-- ---------------------------------------------------------------- sync RPC
-- Compare-and-swap write of the learning document. Runs as the caller (RLS applies) and always
-- uses auth.uid(), never a client-supplied user id.
--   p_base_revision = 0  → create the first document (fails with 'conflict' if one exists)
--   p_base_revision = n  → replace only if the stored revision is still n
-- Returns {"status": "ok"|"conflict", "revision": n|null, "updated_at": ...}.
create or replace function public.push_learning_state(p_state jsonb, p_base_revision bigint, p_device_id text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  rec public.learning_states;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' or (p_state ->> 'version') is distinct from '1' then
    raise exception 'invalid learning state' using errcode = '22023';
  end if;
  if p_base_revision = 0 then
    insert into public.learning_states as s (user_id, state, device_id)
    values (uid, p_state, p_device_id)
    on conflict (user_id) do nothing
    returning s.* into rec;
  else
    update public.learning_states as s
       set state = p_state, revision = s.revision + 1, device_id = p_device_id, updated_at = now()
     where s.user_id = uid and s.revision = p_base_revision
    returning s.* into rec;
  end if;
  if rec.user_id is null then
    select s.* into rec from public.learning_states s where s.user_id = uid;
    return jsonb_build_object('status', 'conflict', 'revision', rec.revision, 'updated_at', rec.updated_at);
  end if;
  return jsonb_build_object('status', 'ok', 'revision', rec.revision, 'updated_at', rec.updated_at);
end $$;
revoke all on function public.push_learning_state(jsonb, bigint, text) from public, anon;
grant execute on function public.push_learning_state(jsonb, bigint, text) to authenticated;

-- ---------------------------------------------------------------- account deletion
-- Lets a signed-in user delete their own account. Cascades remove profile, learning state and backups.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from auth.users where id = uid;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
