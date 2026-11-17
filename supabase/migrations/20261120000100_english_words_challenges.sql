-- Friendly asynchronous challenges. No stakes or client-supplied scores.
create table public.ew_challenge_words(id text primary key, word text not null, meaning text not null, level text not null);
create table public.ew_challenges(
 id uuid primary key default gen_random_uuid(), challenger uuid not null references auth.users(id) on delete cascade,
 opponent uuid not null references auth.users(id) on delete cascade, status text not null default 'pending' check(status in ('pending','accepted','declined')),
 questions jsonb not null, created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '7 days',
 check(challenger is not null)
);
create table public.ew_challenge_attempts(
 challenge_id uuid references public.ew_challenges(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade,
 started_at timestamptz not null default now(), answers jsonb not null default '[]', score int not null default 0,
 finished_at timestamptz, primary key(challenge_id,user_id)
);
alter table public.ew_challenge_words enable row level security;
alter table public.ew_challenges enable row level security;
alter table public.ew_challenge_attempts enable row level security;
revoke all on public.ew_challenge_words,public.ew_challenges,public.ew_challenge_attempts from public,anon,authenticated;

create function public.ew_challenge(p_action text,p_id uuid default null,p_opponent uuid default null,p_answer text default null,p_index int default null,p_device text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); c public.ew_challenges; a public.ew_challenge_attempts; qs jsonb; question jsonb; idx int; result jsonb; mine int; theirs int;
begin
 if uid is null then raise exception 'Sign in required'; end if;
 if not exists(select 1 from public.ew_profiles where id=uid and active_device_id=p_device) then raise exception 'Use your active device'; end if;
 if p_action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'challenger',x.challenger,'opponent',x.opponent,'status',x.status,'expires_at',x.expires_at,
   'name',coalesce(s.handle,'Player'),'mine',ma.score,'finished',ma.finished_at is not null,'started_at',ma.started_at,
   'other_score',case when ma.finished_at is not null and oa.finished_at is not null then oa.score end,'other_finished',oa.finished_at is not null) order by x.created_at desc),'[]') into result
  from (select * from public.ew_challenges where uid in(challenger,opponent) order by created_at desc limit 50)x
  left join public.ew_public_stats s on s.user_id=case when x.challenger=uid then x.opponent else x.challenger end
  left join public.ew_challenge_attempts ma on ma.challenge_id=x.id and ma.user_id=uid
  left join public.ew_challenge_attempts oa on oa.challenge_id=x.id and oa.user_id<>uid;
  return result;
 end if;
 if p_action='practice' then
  perform pg_advisory_xact_lock(hashtextextended(uid::text,26));
  select id into p_id from public.ew_challenges where challenger=uid and opponent=uid and (created_at at time zone 'Asia/Ulaanbaatar')::date=(now() at time zone 'Asia/Ulaanbaatar')::date order by created_at desc limit 1;
  if p_id is not null then return jsonb_build_object('id',p_id);end if;
 end if;
 if p_action in('invite','practice') then
  perform pg_advisory_xact_lock(hashtextextended(uid::text,25));
  if p_action='practice' then p_opponent:=uid;end if;
  if p_opponent is null or (p_opponent=uid and p_action<>'practice') then raise exception 'Choose another player'; end if;
  select level into mine from public.ew_public_stats where user_id=uid;
  select level into theirs from public.ew_public_stats where user_id=p_opponent;
  if p_action<>'practice' and (mine is null or theirs is null or abs(mine-theirs)>10) then raise exception 'Choose a player within 10 levels'; end if;
  if (select count(*) from public.ew_challenges where challenger=uid and created_at>now()-interval '1 day')>=10 then raise exception 'Daily invitation limit reached'; end if;
  if p_action<>'practice' and exists(select 1 from public.ew_challenges where challenger=uid and opponent=p_opponent and status in ('pending','accepted') and expires_at>now() and not exists(select 1 from public.ew_challenge_attempts where challenge_id=ew_challenges.id and user_id=uid and finished_at is not null)) then raise exception 'An active challenge already exists'; end if;
  select jsonb_agg(jsonb_build_object('word',w.word,'answer',w.id,'options',(select jsonb_agg(jsonb_build_object('id',o.id,'text',o.meaning) order by random()) from (select w.id,w.meaning union all select id,meaning from (select id,meaning from public.ew_challenge_words where id<>w.id and meaning<>w.meaning order by random() limit 3)d)o))) into qs from (select * from public.ew_challenge_words order by random() limit 10)w;
  if coalesce(jsonb_array_length(qs),0)<>10 then raise exception 'Question bank not ready'; end if;
  insert into public.ew_challenges(challenger,opponent,questions,status) values(uid,p_opponent,qs,case when p_action='practice' then 'accepted' else 'pending' end) returning * into c;
  return jsonb_build_object('id',c.id);
 end if;
 select * into c from public.ew_challenges where id=p_id for update;
 if c.id is null or uid not in(c.challenger,c.opponent) then raise exception 'Challenge not found'; end if;
 if c.expires_at<=now() then raise exception 'Challenge expired'; end if;
 if p_action in('accept','decline') then
  if uid<>c.opponent or c.status<>'pending' then raise exception 'Invitation unavailable'; end if;
  update public.ew_challenges set status=case when p_action='accept' then 'accepted' else 'declined' end where id=c.id;
  return '{}'::jsonb;
 end if;
 if c.status<>'accepted' then raise exception 'Both players must accept'; end if;
 if p_action not in('start','answer') then raise exception 'Unknown action'; end if;
 insert into public.ew_challenge_attempts(challenge_id,user_id) values(c.id,uid) on conflict do nothing;
 select * into a from public.ew_challenge_attempts where challenge_id=c.id and user_id=uid for update;
 idx:=jsonb_array_length(a.answers);
 if a.finished_at is null and now()>a.started_at+interval '3 minutes' then
  update public.ew_challenge_attempts set finished_at=now() where challenge_id=c.id and user_id=uid returning * into a;
 end if;
 if a.finished_at is not null then return jsonb_build_object('finished',true,'score',a.score,'total',10); end if;
 if p_action='answer' then
  if p_index is distinct from idx then raise exception 'Question already answered; resume challenge'; end if;
  question:=c.questions->idx;
  if not exists(select 1 from jsonb_array_elements(question->'options')o where o->>'id'=p_answer) then raise exception 'Invalid answer'; end if;
  update public.ew_challenge_attempts set answers=answers||jsonb_build_array(p_answer),score=score+case when p_answer=question->>'answer' then 1 else 0 end,
   finished_at=case when idx=9 then now() end where challenge_id=c.id and user_id=uid returning * into a;
  idx:=idx+1;
 end if;
 if a.finished_at is not null then return jsonb_build_object('finished',true,'score',a.score,'total',10); end if;
 return jsonb_build_object('id',c.id,'index',idx,'total',10,'deadline',a.started_at+interval '3 minutes','question',(c.questions->idx)-'answer');
end $$;
revoke all on function public.ew_challenge(text,uuid,uuid,text,int,text) from public,anon;
grant execute on function public.ew_challenge(text,uuid,uuid,text,int,text) to authenticated;
