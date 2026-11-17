-- Product-scoped membership. Does not alter shared-project Auth signup.
create table public.ew_product_settings(
 id int primary key check(id=1), price_mnt int not null default 5000 check(price_mnt between 1 and 10000000),
 coin_price int not null default 100000 check(coin_price between 1 and 1000000), welcome_coins int not null default 1000 check(welcome_coins between 0 and 100000),
 discount_percent int not null default 10 check(discount_percent between 0 and 90), streak_days int not null default 7 check(streak_days between 1 and 365),
 daily_coins int not null default 20 check(daily_coins between 0 and 10000), battle_win_coins int not null default 50 check(battle_win_coins between 0 and 10000),
 sales_enabled boolean not null default false, gate_enabled boolean not null default false,
 purchase_url text not null default '' check(purchase_url='' or purchase_url ~ '^https://'),
 payment_instructions text not null default '' check(length(payment_instructions)<=2000)
);
insert into public.ew_product_settings(id,payment_instructions) values(1,'Bogd Bank
Данс: 300038008093993939
Данс эзэмшигч: Batmanai
Гүйлгээний утгад захиалгын дугаараа бүтнээр бичнэ үү.');
create table public.ew_memberships(email text primary key check(email=lower(trim(email))),expires_at timestamptz not null,revoked boolean not null default false,unlimited boolean not null default false,banned boolean not null default false);
create table public.ew_orders(
 id uuid primary key default gen_random_uuid(), email text not null check(email=lower(trim(email)) and length(email)<=254),
 amount int not null check(amount>0), discount_percent int not null, status text not null default 'pending' check(status in('pending','paid','cancelled')),
 payment_reference text unique, created_at timestamptz not null default now(), paid_at timestamptz, paid_by uuid references auth.users(id),
 expires_at timestamptz not null default now()+interval '1 day'
);
create table public.ew_activity_days(user_id uuid references auth.users(id) on delete cascade, day date not null, primary key(user_id,day));
create table public.ew_membership_events(id uuid primary key default gen_random_uuid(),email text not null,kind text not null,reference text not null unique,expires_at timestamptz not null,created_at timestamptz not null default now());
alter table public.ew_product_settings enable row level security;
alter table public.ew_memberships enable row level security;
alter table public.ew_orders enable row level security;
alter table public.ew_activity_days enable row level security;
alter table public.ew_membership_events enable row level security;
revoke all on public.ew_product_settings,public.ew_memberships,public.ew_orders,public.ew_activity_days,public.ew_membership_events from public,anon,authenticated;
grant select on public.ew_product_settings to anon,authenticated;
create policy "ew_product: public settings" on public.ew_product_settings for select using(true);
create function public.ew_is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.admin_users where user_id=auth.uid())$$;
revoke all on function public.ew_is_admin() from public,anon;
grant execute on function public.ew_is_admin() to authenticated;
grant select,update on public.ew_product_settings to authenticated;
create policy "ew_product: admin update" on public.ew_product_settings for update to authenticated using(public.ew_is_admin()) with check(public.ew_is_admin());
grant select on public.ew_orders,public.ew_memberships,public.ew_membership_events to authenticated;
create policy "ew_orders: admin read" on public.ew_orders for select to authenticated using(public.ew_is_admin());
create policy "ew_memberships: admin read" on public.ew_memberships for select to authenticated using(public.ew_is_admin());
create policy "ew_events: admin read" on public.ew_membership_events for select to authenticated using(public.ew_is_admin());

create function public.ew_has_access() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and not exists(select 1 from auth.users u join public.ew_memberships m on m.email=lower(u.email) where u.id=auth.uid() and m.banned) and (not (select gate_enabled from public.ew_product_settings where id=1) or exists(
  select 1 from auth.users u join public.ew_memberships m on m.email=lower(u.email) where u.id=auth.uid() and u.email_confirmed_at is not null and not m.revoked and (m.unlimited or m.expires_at>now())))
$$;
revoke all on function public.ew_has_access() from public,anon;
grant execute on function public.ew_has_access() to authenticated;
-- Restrictive policies compose with all existing ownership policies.
create policy "ew_access" on public.ew_learning_states as restrictive to authenticated using(public.ew_has_access()) with check(public.ew_has_access());
create policy "ew_access" on public.ew_cloud_backups as restrictive to authenticated using(public.ew_has_access()) with check(public.ew_has_access());
create policy "ew_access" on public.ew_public_stats as restrictive to authenticated using(public.ew_has_access());

create function public.ew_activity_streak(p_user uuid) returns int language plpgsql stable security definer set search_path='' as $$
declare d date:=(now() at time zone 'Asia/Ulaanbaatar')::date; n int:=0;
begin
 if not exists(select 1 from public.ew_activity_days where user_id=p_user and day=d) then d:=d-1; end if;
 while exists(select 1 from public.ew_activity_days where user_id=p_user and day=d) loop n:=n+1;d:=d-1;end loop;
 return n;
end $$;
revoke all on function public.ew_activity_streak(uuid) from public,anon,authenticated;

alter table public.ew_coin_ledger drop constraint ew_coin_ledger_reason_check;
alter table public.ew_coin_ledger add constraint ew_coin_ledger_reason_check check(reason in('progress','battle-stake','battle-win','battle-refund','bonus','membership'));

create function public.ew_membership_status() returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); em text; m public.ew_memberships; s public.ew_product_settings; coins int; n int;
begin
 if uid is null then raise exception 'Sign in required'; end if;
 select lower(email) into em from auth.users where id=uid and email_confirmed_at is not null;
 if em is null then raise exception 'Confirm your email first'; end if;
 select * into s from public.ew_product_settings where id=1;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if s.welcome_coins>0 then insert into public.ew_coin_ledger(user_id,amount,reason,ref) values(uid,s.welcome_coins,'bonus','welcome') on conflict do nothing;end if;
 select * into m from public.ew_memberships where email=em;
 select coalesce(sum(amount),0)::int into coins from public.ew_coin_ledger where user_id=uid;
 n:=public.ew_activity_streak(uid);
 return jsonb_build_object('purchase_url',s.purchase_url,'active',public.ew_has_access(),'gate_enabled',s.gate_enabled,'expires_at',m.expires_at,'unlimited',coalesce(m.unlimited,false),'banned',coalesce(m.banned,false),'revoked',coalesce(m.revoked,false),'coins',coins,'coin_price',s.coin_price,'price',s.price_mnt,'discount_percent',case when n>=s.streak_days then s.discount_percent else 0 end,'streak',n,'streak_days',s.streak_days,'sales_enabled',s.sales_enabled);
end $$;
revoke all on function public.ew_membership_status() from public,anon;
grant execute on function public.ew_membership_status() to authenticated;

-- Extends an existing membership from its expiry, or starts a new calendar month now.
create function public.ew_extend_membership(p_email text,p_kind text,p_ref text) returns timestamptz language plpgsql security definer set search_path='' as $$
declare expiry timestamptz;
begin
 perform pg_advisory_xact_lock(hashtextextended(lower(p_email),30));
 select expires_at into expiry from public.ew_membership_events where reference=p_ref;
 if found then return expiry;end if;
 insert into public.ew_memberships(email,expires_at) values(lower(p_email),now()+interval '1 month') on conflict(email) do update set expires_at=greatest(ew_memberships.expires_at,now())+interval '1 month',revoked=false returning expires_at into expiry;
 insert into public.ew_membership_events(email,kind,reference,expires_at) values(lower(p_email),p_kind,p_ref,expiry);
 return expiry;
end $$;
revoke all on function public.ew_extend_membership(text,text,text) from public,anon,authenticated;

create function public.ew_redeem_month(p_request uuid) returns timestamptz language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();em text;cost int;balance int;expiry timestamptz;ref text:='coin:'||uid::text||':'||p_request::text;
begin
 if uid is null or p_request is null then raise exception 'Sign in required';end if;
 select lower(email) into em from auth.users where id=uid and email_confirmed_at is not null;
 if em is null then raise exception 'Confirm your email';end if;
 if exists(select 1 from public.ew_memberships where email=em and (banned or unlimited)) then raise exception 'Membership cannot be redeemed for this account';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select expires_at into expiry from public.ew_membership_events where reference=ref;
 if found then return expiry;end if;
 select coin_price into cost from public.ew_product_settings where id=1;
 select coalesce(sum(amount),0) into balance from public.ew_coin_ledger where user_id=uid;
 if balance<cost then raise exception 'Not enough coins';end if;
 insert into public.ew_coin_ledger(user_id,amount,reason,ref) values(uid,-cost,'membership',p_request::text);
 expiry:=public.ew_extend_membership(em,'coins',ref);
 update public.ew_public_stats set coins=balance-cost where user_id=uid;
 return expiry;
end $$;
revoke all on function public.ew_redeem_month(uuid) from public,anon;
grant execute on function public.ew_redeem_month(uuid) to authenticated;

-- Orders are created by Axora's server after rate limiting, never with browser-supplied prices.
create function public.ew_create_order(p_email text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.ew_product_settings;em text:=lower(trim(p_email));d int:=0;uid uuid;o public.ew_orders;
begin
 if em is null or length(em)>254 or em!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email';end if;
 select * into s from public.ew_product_settings where id=1;
 if exists(select 1 from public.ew_memberships where email=em and (banned or unlimited)) then raise exception 'Contact support about this account';end if;
 if not s.sales_enabled or trim(s.payment_instructions)='' then raise exception 'Sales are not open';end if;
 perform pg_advisory_xact_lock(hashtextextended(em,31));
 if (select count(*) from public.ew_orders where email=em and created_at>now()-interval '1 day')>=3 then raise exception 'Please use your existing order';end if;
 select id into uid from auth.users where lower(email)=em and email_confirmed_at is not null limit 1;
 if public.ew_activity_streak(uid)>=s.streak_days then d:=s.discount_percent;end if;
 insert into public.ew_orders(email,amount,discount_percent) values(em,greatest(1,round(s.price_mnt*(100-d)/100.0)::int),d) returning * into o;
 return jsonb_build_object('id',o.id,'amount',o.amount,'discount_percent',d,'expires_at',o.expires_at,'instructions',s.payment_instructions);
end $$;
revoke all on function public.ew_create_order(text) from public,anon,authenticated;
-- Supabase has this role; local tests create it explicitly.
grant execute on function public.ew_create_order(text) to service_role;

create function public.ew_manage_order(p_id uuid,p_action text,p_reference text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.ew_orders;expiry timestamptz;
begin
 if not public.ew_is_admin() then raise exception 'Admin required';end if;
 select * into o from public.ew_orders where id=p_id for update;
 if o.id is null then raise exception 'Order not found';end if;
 if p_action='confirm' then
  if o.status='paid' then return jsonb_build_object('status','paid');end if;
  if o.status<>'pending' or o.expires_at<now() then raise exception 'Order expired or cancelled';end if;
  if p_reference is null or length(trim(p_reference)) not between 4 and 100 then raise exception 'Verified bank transaction reference required';end if;
  update public.ew_orders set status='paid',payment_reference=trim(p_reference),paid_at=now(),paid_by=auth.uid() where id=o.id;
  expiry:=public.ew_extend_membership(o.email,'payment','order:'||o.id::text);
 elsif p_action='cancel' then
  if o.status<>'pending' then raise exception 'Only pending orders can be cancelled';end if;
  update public.ew_orders set status='cancelled' where id=o.id;
 elsif p_action='revoke' then
  if o.status<>'paid' then raise exception 'Paid order required';end if;
  update public.ew_memberships set revoked=true where email=o.email;
 else raise exception 'Unknown action';end if;
 return jsonb_build_object('status',p_action,'expires_at',expiry);
end $$;
revoke all on function public.ew_manage_order(uuid,text,text) from public,anon;
grant execute on function public.ew_manage_order(uuid,text,text) to authenticated;

-- One daily award per server-observed activity day. Imported backdated history earns no streak.
create function public.ew_record_activity(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare today date:=(now() at time zone 'Asia/Ulaanbaatar')::date; reward int;
begin
 insert into public.ew_activity_days values(p_user,today) on conflict do nothing;
 select daily_coins into reward from public.ew_product_settings where id=1;
 if reward>0 then insert into public.ew_coin_ledger(user_id,amount,reason,ref) values(p_user,reward,'bonus','daily:'||today::text) on conflict do nothing;end if;
end $$;
revoke all on function public.ew_record_activity(uuid) from public,anon,authenticated;
create function public.ew_challenge_rewards() returns trigger language plpgsql security definer set search_path='' as $$
declare other public.ew_challenge_attempts;winner uuid;reward int;
begin
 if new.finished_at is null or old.finished_at is not null then return new;end if;
 if jsonb_array_length(new.answers)=10 and new.score>=6 then perform public.ew_record_activity(new.user_id);end if;
 select * into other from public.ew_challenge_attempts where challenge_id=new.challenge_id and user_id<>new.user_id and finished_at is not null;
 if other.user_id is not null and other.score<>new.score then
  winner:=case when new.score>other.score then new.user_id else other.user_id end;
  select battle_win_coins into reward from public.ew_product_settings where id=1;
  if reward>0 then insert into public.ew_coin_ledger(user_id,amount,reason,ref) values(winner,reward,'battle-win',new.challenge_id::text) on conflict do nothing;end if;
 end if;
 return new;
end $$;
create trigger ew_challenge_reward after update on public.ew_challenge_attempts for each row execute function public.ew_challenge_rewards();
-- SECURITY DEFINER community RPCs must check the same membership as RLS.
alter function public.ew_challenge(text,uuid,uuid,text,int,text) rename to ew_challenge_internal;
revoke all on function public.ew_challenge_internal(text,uuid,uuid,text,int,text) from public,anon,authenticated;
create function public.ew_challenge(p_action text,p_id uuid default null,p_opponent uuid default null,p_answer text default null,p_index int default null,p_device text default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.ew_has_access() then raise exception 'Membership required';end if;
 return public.ew_challenge_internal(p_action,p_id,p_opponent,p_answer,p_index,p_device);
end $$;
revoke all on function public.ew_challenge(text,uuid,uuid,text,int,text) from public,anon;
grant execute on function public.ew_challenge(text,uuid,uuid,text,int,text) to authenticated;

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
  if not public.ew_has_access() then raise exception 'Membership required';end if;
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

  -- Learning documents are client-editable; they cannot mint spendable coins.
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


-- Owner entitlement is keyed to the verified Auth email, never display names or metadata.
insert into public.ew_memberships(email,expires_at,unlimited) values('batmanlaibattsooj25@gmail.com',now(),true) on conflict(email) do update set unlimited=true,revoked=false,banned=false;
create function public.ew_admin_member(p_email text,p_action text,p_months int default 1) returns void language plpgsql security definer set search_path='' as $$
declare em text:=lower(trim(p_email));
begin
 if not public.ew_is_admin() then raise exception 'Admin required';end if;
 if em is null or length(em)>254 or em!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email';end if;
 if p_action not in('grant','unlimited','ban','unban','revoke') then raise exception 'Unknown action';end if;
 if p_months is null or p_months not between 1 and 120 then raise exception 'Invalid months';end if;
 perform pg_advisory_xact_lock(hashtextextended(em,30));
 insert into public.ew_memberships(email,expires_at) values(em,now()) on conflict do nothing;
 if p_action='grant' then update public.ew_memberships set expires_at=greatest(expires_at,now())+make_interval(months=>p_months),revoked=false where email=em;
 elsif p_action='unlimited' then update public.ew_memberships set unlimited=true,revoked=false where email=em;
 elsif p_action='ban' then update public.ew_memberships set banned=true where email=em;
 elsif p_action='unban' then update public.ew_memberships set banned=false where email=em;
 elsif p_action='revoke' then update public.ew_memberships set revoked=true,unlimited=false where email=em;end if;
 insert into public.ew_membership_events(email,kind,reference,expires_at) select em,'admin:'||p_action,auth.uid()::text||':'||gen_random_uuid()::text,expires_at from public.ew_memberships where email=em;
end $$;
revoke all on function public.ew_admin_member(text,text,int) from public,anon;
grant execute on function public.ew_admin_member(text,text,int) to authenticated;
