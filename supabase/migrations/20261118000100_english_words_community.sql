-- English Words — community layer: a public profile with level and coins, the leaderboard, and the
-- one-active-device rule. Phase one of the multiplayer features; battles build on this.
--
-- Safe next to the first migration and next to other apps in the same project:
--   * creates objects and adds columns only, all prefixed ew_;
--   * nothing is attached to auth.users;
--   * every number a player can see about themselves or others is computed in the database from the
--     synced learning document, never sent up by the client. A client can only change the document
--     it already owns, so it cannot award itself a level or a coin.
--
-- What is public: handle, level, XP, words learned, reviews, lessons, coins and the last update.
-- What stays private: the learning document, backups, email, and which device is active.

-- ---------------------------------------------------------------- device binding (private)
alter table public.ew_profiles
  add column if not exists active_device_id    text,
  add column if not exists active_device_label text,
  add column if not exists device_claimed_at   timestamptz;

alter table public.ew_profiles
  drop constraint if exists ew_profiles_active_device_id_len,
  add  constraint ew_profiles_active_device_id_len
       check (active_device_id is null or char_length(active_device_id) between 1 and 64);
alter table public.ew_profiles
  drop constraint if exists ew_profiles_active_device_label_len,
  add  constraint ew_profiles_active_device_label_len
       check (active_device_label is null or char_length(active_device_label) <= 80);

-- ---------------------------------------------------------------- public stats (the leaderboard)
create table public.ew_public_stats (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  handle        text    not null check (char_length(handle) between 1 and 40 and handle !~ '[\n\r\t]'),
  level         integer not null default 1 check (level between 1 and 999),
  xp            integer not null default 0 check (xp >= 0),
  words_learned integer not null default 0 check (words_learned >= 0),
  reviews       integer not null default 0 check (reviews >= 0),
  lessons       integer not null default 0 check (lessons >= 0),
  coins         integer not null default 0 check (coins >= 0),
  updated_at    timestamptz not null default now()
);
create index ew_public_stats_rank_idx on public.ew_public_stats (xp desc, updated_at);

-- ---------------------------------------------------------------- coins
-- Coins are a ledger, not a column: progress tops the balance up, and a battle stake moves it. The
-- balance is the sum, so it can never be set directly. (user_id, reason, ref) is unique, which makes
-- every award idempotent — a retried request can never pay twice.
create table public.ew_coin_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  amount     integer not null check (amount <> 0 and abs(amount) <= 1000000),
  reason     text not null check (reason in ('progress', 'battle-stake', 'battle-win', 'battle-refund', 'bonus')),
  ref        text check (ref is null or char_length(ref) <= 64),
  created_at timestamptz not null default now()
);
create index ew_coin_ledger_user_idx on public.ew_coin_ledger (user_id, created_at desc);
create unique index ew_coin_ledger_once_idx on public.ew_coin_ledger (user_id, reason, ref) where ref is not null;

-- ---------------------------------------------------------------- Row Level Security
alter table public.ew_public_stats enable row level security;
alter table public.ew_coin_ledger  enable row level security;

-- Everyone signed in reads the leaderboard; nobody writes it directly (only ew_sync_profile does).
create policy "ew_public_stats: read all" on public.ew_public_stats for select to authenticated using (true);
create policy "ew_coin_ledger: read own" on public.ew_coin_ledger  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.ew_public_stats, public.ew_coin_ledger from anon;
revoke all on public.ew_public_stats, public.ew_coin_ledger from authenticated;
grant select on public.ew_public_stats to authenticated;
grant select on public.ew_coin_ledger  to authenticated;

-- ---------------------------------------------------------------- level and coin rules
-- Kept as functions so the app, the tests and any later battle logic all agree on one definition.
create or replace function public.ew_level_for_xp(p_xp integer)
returns integer language sql immutable set search_path = '' as $$
  select greatest(1, least(999, floor(sqrt(greatest(p_xp, 0)) / 10)::int + 1))
$$;

create or replace function public.ew_xp_for(p_words integer, p_reviews integer, p_lessons integer)
returns integer language sql immutable set search_path = '' as $$
  select greatest(p_words, 0) * 10 + greatest(p_reviews, 0) * 2 + greatest(p_lessons, 0) * 25
$$;

create or replace function public.ew_coins_for(p_words integer, p_reviews integer, p_lessons integer)
returns integer language sql immutable set search_path = '' as $$
  select greatest(p_words, 0) * 5 + greatest(p_reviews, 0) + greatest(p_lessons, 0) * 20
$$;

create or replace function public.ew_coin_balance(p_user uuid)
returns integer language sql stable security invoker set search_path = '' as $$
  select coalesce(sum(amount), 0)::int from public.ew_coin_ledger where user_id = p_user
$$;

-- ---------------------------------------------------------------- publish my stats
-- Reads the caller's own synced learning document, works out words learned, reviews, lessons, XP and
-- level, tops the coin balance up to what that progress has earned, and republishes the public row.
-- p_handle renames the player; passing null keeps the current name.
-- Returns {handle, level, xp, words_learned, reviews, lessons, coins, rank, players}.
create or replace function public.ew_sync_profile(p_handle text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_doc jsonb;
  v_words int; v_reviews int; v_lessons int; v_xp int; v_level int;
  v_target int; v_earned int; v_coins int;
  v_handle text; v_rank int; v_players int;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  -- Serialize repeated requests so concurrent refreshes cannot award progress twice.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  if p_handle is not null and (char_length(btrim(p_handle)) = 0 or char_length(p_handle) > 40 or p_handle ~ '[
	]') then
    raise exception 'invalid handle' using errcode = '22023';
  end if;

  select state into v_doc from public.ew_learning_states where user_id = v_uid;
  v_words   := coalesce((select count(*) from jsonb_object_keys(coalesce(v_doc -> 'learned', '{}'::jsonb))), 0);
  v_reviews := coalesce(jsonb_array_length(coalesce(v_doc -> 'reviews', '[]'::jsonb)), 0);
  v_lessons := coalesce((select count(*) from jsonb_object_keys(coalesce(v_doc #> '{grammar,completed}', '{}'::jsonb))), 0);
  v_xp    := public.ew_xp_for(v_words, v_reviews, v_lessons);
  v_level := public.ew_level_for_xp(v_xp);

  -- Coins earned by progress are topped up, never recalculated: coins already spent stay spent.
  v_target := public.ew_coins_for(v_words, v_reviews, v_lessons);
  select coalesce(sum(amount), 0)::int into v_earned
    from public.ew_coin_ledger where user_id = v_uid and reason = 'progress';
  if v_target > v_earned then
    insert into public.ew_coin_ledger (user_id, amount, reason) values (v_uid, v_target - v_earned, 'progress');
  end if;
  v_coins := public.ew_coin_balance(v_uid);

  v_handle := coalesce(
    nullif(btrim(p_handle), ''),
    (select s.handle from public.ew_public_stats s where s.user_id = v_uid),
    nullif(btrim((select p.display_name from public.ew_profiles p where p.id = v_uid)), ''),
    'Learner ' || left(v_uid::text, 4));

  insert into public.ew_public_stats as s (user_id, handle, level, xp, words_learned, reviews, lessons, coins, updated_at)
  values (v_uid, v_handle, v_level, v_xp, v_words, v_reviews, v_lessons, v_coins, now())
  on conflict (user_id) do update
    set handle = excluded.handle, level = excluded.level, xp = excluded.xp,
        words_learned = excluded.words_learned, reviews = excluded.reviews, lessons = excluded.lessons,
        coins = excluded.coins, updated_at = now();

  select count(*)::int into v_players from public.ew_public_stats;
  select count(*)::int + 1 into v_rank from public.ew_public_stats t where t.xp > v_xp;

  return jsonb_build_object('handle', v_handle, 'level', v_level, 'xp', v_xp, 'words_learned', v_words,
    'reviews', v_reviews, 'lessons', v_lessons, 'coins', v_coins, 'rank', v_rank, 'players', v_players);
end $$;
revoke all on function public.ew_sync_profile(text) from public, anon;
grant execute on function public.ew_sync_profile(text) to authenticated;

-- ---------------------------------------------------------------- one active device
-- Signing in on a new device takes the account over: the previous device finds out the next time it
-- tries to push and is told to sign in again or take the account back.
-- Returns {device_id, replaced: true|false}.
create or replace function public.ew_claim_device(p_device_id text, p_label text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_previous text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_device_id is null or char_length(p_device_id) not between 1 and 64 then
    raise exception 'invalid device id' using errcode = '22023';
  end if;
  select active_device_id into v_previous from public.ew_profiles where id = v_uid;
  insert into public.ew_profiles as p (id, active_device_id, active_device_label, device_claimed_at)
  values (v_uid, p_device_id, left(p_label, 80), now())
  on conflict (id) do update
    set active_device_id = excluded.active_device_id,
        active_device_label = excluded.active_device_label,
        device_claimed_at = now();
  return jsonb_build_object('device_id', p_device_id, 'replaced', v_previous is not null and v_previous is distinct from p_device_id);
end $$;
revoke all on function public.ew_claim_device(text, text) from public, anon;
grant execute on function public.ew_claim_device(text, text) to authenticated;

-- Tells a device whether it is still the active one, without exposing the other device's id.
-- Returns {active: true|false, claimed: true|false, label, claimed_at}.
create or replace function public.ew_device_status(p_device_id text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.ew_profiles;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select * into v_profile from public.ew_profiles where id = v_uid;
  return jsonb_build_object(
    'claimed', v_profile.active_device_id is not null,
    'active', v_profile.active_device_id is null or v_profile.active_device_id = p_device_id,
    'label', v_profile.active_device_label,
    'claimed_at', v_profile.device_claimed_at);
end $$;
revoke all on function public.ew_device_status(text) from public, anon;
grant execute on function public.ew_device_status(text) to authenticated;

-- ---------------------------------------------------------------- sync RPC: device check added
-- Same contract as before ({"status": "ok"|"conflict", ...}); a push from a device that is no longer
-- the active one is refused outright, so two devices can never quietly fight over one account.
create or replace function public.ew_push_learning_state(p_state jsonb, p_base_revision bigint, p_device_id text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  rec public.ew_learning_states;
  active text;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' or (p_state ->> 'version') is distinct from '1' then
    raise exception 'invalid learning state' using errcode = '22023';
  end if;
  select active_device_id into active from public.ew_profiles where id = uid;
  if active is not null and active is distinct from p_device_id then
    raise exception 'device not active' using errcode = 'P0001';
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

-- ---------------------------------------------------------------- account deletion covers the new tables
create or replace function public.ew_delete_my_account()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  used_elsewhere boolean := false;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from public.ew_coin_ledger    where user_id = uid;
  delete from public.ew_public_stats   where user_id = uid;
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
