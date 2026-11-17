// Runs the real Supabase migration in an in-process PostgreSQL (PGlite) with Supabase-style roles
// and auth.uid(), in a database that already contains another app (like the production project),
// then verifies isolation, Row Level Security and the sync/account functions.
import test from 'node:test';import assert from 'node:assert/strict';import {readdir,readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {emptyState} from '../core.js';
import {xpForLevel} from '../community-ui.js';

const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const doc=JSON.stringify(emptyState());
let db;

// Minimal stand-in for Supabase plus a pre-existing "other app" in the same project.
const SUPABASE_STUB=`
 create role service_role nologin; create role anon nologin; create role authenticated nologin;
 create schema auth; create table auth.users (id uuid primary key, email text,email_confirmed_at timestamptz default now());
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
 grant usage on schema auth, public to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
 alter default privileges in schema public grant all on tables to anon, authenticated;
 alter default privileges in schema public grant execute on functions to anon, authenticated;
 -- other app already living in this project:
 create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at := now() - interval '1 second'; return new; end $$;
 create table public.admin_users (user_id uuid primary key references auth.users(id) on delete cascade);`;

async function as(user,fn){await db.exec(`set role ${user?'authenticated':'anon'}; select set_config('request.jwt.claim.sub','${user||''}',false);`);try{return await fn();}finally{await db.exec('reset role;');}}
const q=(sql,params)=>db.query(sql,params);
const push=(state,base)=>q('select public.ew_push_learning_state($1::jsonb,$2,$3) as r',[state,base,'test']).then(x=>x.rows[0].r);

test.before(async()=>{
 db=new PGlite();await db.exec(SUPABASE_STUB);
 await db.exec(`insert into auth.users (id,email) values ('${A}','a@example.test'),('${B}','b@example.test'); insert into public.admin_users values ('${A}');`);
 const dir=new URL('../supabase/migrations/',import.meta.url);
 for(const f of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(f,dir),'utf8'));
});
test.after(async()=>db?.close());

test('the migration does not touch objects of another app in the same project',async()=>{
 const src=(await q(`select prosrc from pg_proc where proname='set_updated_at'`)).rows[0].prosrc;assert.match(src,/interval '1 second'/,'existing set_updated_at is unchanged');
 assert.equal((await q(`select count(*)::int n from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal`)).rows[0].n,0,'no trigger on auth.users');
 const created=(await q(`select relname from pg_class where relnamespace='public'::regnamespace and relkind='r' order by 1`)).rows.map(r=>r.relname);
 assert.deepEqual(created,['admin_users','ew_activity_days','ew_challenge_attempts','ew_challenge_words','ew_challenges','ew_cloud_backups','ew_coin_ledger','ew_learning_states','ew_membership_events','ew_memberships','ew_orders','ew_product_settings','ew_profiles','ew_public_stats']);
});
test('profiles are created on first save and only their owner can change them',async()=>{
 await as(A,async()=>{await q(`insert into public.ew_profiles (id,display_name) values ($1,'Ana') on conflict (id) do update set display_name=excluded.display_name`,[A]);
  await q(`insert into public.ew_profiles (id,display_name) values ($1,'Ana B') on conflict (id) do update set display_name=excluded.display_name`,[A]);
  assert.equal((await q('select display_name from public.ew_profiles')).rows[0].display_name,'Ana B');
  await assert.rejects(q(`insert into public.ew_profiles (id) values ($1)`,[B]),/row-level security/);
  await assert.rejects(q(`update public.ew_profiles set display_name=$1 where id=$2`,['x'.repeat(81),A]),/check constraint/);});
 await as(B,async()=>{assert.equal((await q('select count(*)::int n from public.ew_profiles')).rows[0].n,0);assert.equal((await q(`update public.ew_profiles set display_name='x' where id=$1`,[A])).affectedRows,0);});
});
test('sync RPC enforces compare-and-swap revisions',async()=>{
 await as(A,async()=>{
  assert.deepEqual(await push(doc,0).then(r=>[r.status,r.revision]),['ok',1]);
  assert.deepEqual(await push(doc,0).then(r=>[r.status,r.revision]),['conflict',1],'second create is a conflict');
  assert.deepEqual(await push(doc,1).then(r=>[r.status,r.revision]),['ok',2]);
  assert.deepEqual(await push(doc,1).then(r=>[r.status,r.revision]),['conflict',2],'stale base revision is rejected');
  await assert.rejects(push(JSON.stringify({version:2}),2),/invalid learning state/);
 });
});
test('users cannot read, change or create another user\'s learning state',async()=>{
 await as(B,async()=>{
  assert.equal((await q('select count(*)::int n from public.ew_learning_states')).rows[0].n,0,'B cannot see A');
  assert.equal((await q(`update public.ew_learning_states set revision=99 where user_id=$1`,[A])).affectedRows,0);
  assert.equal((await q(`delete from public.ew_learning_states where user_id=$1`,[A])).affectedRows,0);
  await assert.rejects(q(`insert into public.ew_learning_states (user_id,state) values ($1,$2::jsonb)`,[A,doc]),/row-level security/);
  assert.equal((await push(doc,0)).status,'ok','B gets an own document');
 });
 assert.equal(Number((await q('select revision from public.ew_learning_states where user_id=$1',[A])).rows[0].revision),2,'A is untouched');
});
test('anonymous visitors have no access to any English Words table or function',async()=>{
 await as(null,async()=>{
  for(const t of ['ew_profiles','ew_learning_states','ew_cloud_backups'])await assert.rejects(q(`select * from public.${t}`),/permission denied/);
  await assert.rejects(push(doc,0),/permission denied/);
  await assert.rejects(q('select public.ew_delete_my_account()'),/permission denied/);
 });
});
test('cloud backups are private, immutable and capped at 30 per user',async()=>{
 await as(A,async()=>{
  for(let i=0;i<32;i++)await q(`insert into public.ew_cloud_backups (label,state,words_learned) values ($1,$2::jsonb,$3)`,['b'+i,doc,i]);
  assert.equal((await q('select count(*)::int n from public.ew_cloud_backups')).rows[0].n,30);
  await assert.rejects(q(`update public.ew_cloud_backups set label='x'`),/permission denied/);
  await assert.rejects(q(`insert into public.ew_cloud_backups (user_id,state) values ($1,$2::jsonb)`,[B,doc]),/row-level security/);
 });
 await as(B,async()=>{assert.equal((await q('select count(*)::int n from public.ew_cloud_backups')).rows[0].n,0);assert.equal((await q('delete from public.ew_cloud_backups')).affectedRows,0);});
});
test('account deletion removes English Words data; a login used by the other app is kept',async()=>{
 const n=async(t,col,id)=>(await q(`select count(*)::int n from public.${t} where ${col}=$1`,[id])).rows[0].n;
 const ra=await as(A,()=>q('select public.ew_delete_my_account() as r')).then(x=>x.rows[0].r);
 assert.equal(ra.login_deleted,false,'A is an admin of the other app');
 for(const [t,c] of [['ew_profiles','id'],['ew_learning_states','user_id'],['ew_cloud_backups','user_id']])assert.equal(await n(t,c,A),0,t);
 assert.equal((await q('select count(*)::int n from auth.users where id=$1',[A])).rows[0].n,1,'A can still sign in to the other app');
 const rb=await as(B,()=>q('select public.ew_delete_my_account() as r')).then(x=>x.rows[0].r);
 assert.equal(rb.login_deleted,true);assert.equal((await q('select count(*)::int n from auth.users where id=$1',[B])).rows[0].n,0);
 assert.equal(await n('admin_users','user_id',A),1,'other app data untouched');
});
test('every English Words table has RLS enabled',async()=>{
 const rows=(await q(`select relname, relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r' and relname like 'ew\\_%'`)).rows;
 assert.equal(rows.length,13);for(const r of rows)assert.equal(r.relrowsecurity,true,r.relname);
});

// ---------------------------------------------------------------- community layer (phase one)
// Earlier tests delete the accounts above, so the community layer gets logins of its own.
const C='33333333-3333-4333-8333-333333333333',D='44444444-4444-4444-8444-444444444444';
test.before(async()=>{});
const progress=(words,reviews,lessons=0)=>JSON.stringify({...emptyState(),
 learned:Object.fromEntries(Array.from({length:words},(_,i)=>['w'+i,{learnedAt:1,dueAt:1,stage:0}])),
 reviews:Array.from({length:reviews},(_,i)=>({id:'w'+i,correct:true,at:1})),
 grammar:{startedOn:'2026-11-16',completed:Object.fromEntries(Array.from({length:lessons},(_,i)=>['l'+i,{at:1}])),attempts:{}}});
const sync=handle=>q('select public.ew_sync_profile($1) as r',[handle??null]).then(x=>x.rows[0].r);
const addLogin=id=>q(`insert into auth.users (id,email) values ($1::uuid,$2::text) on conflict do nothing`,[id,id+'@example.test']);

test('level, XP and coins are computed in the database from the synced document, never sent by the client',async()=>{
 await addLogin(C);await addLogin(D);
 await as(C,async()=>{
  await push(progress(12,5,1),0);
  const first=await sync('Bat');
  assert.equal(first.words_learned,12);assert.equal(first.reviews,5);assert.equal(first.lessons,1);
  assert.equal(first.xp,12*10+5*2+25,'xp follows the published formula');
  assert.equal(first.level,(await q('select public.ew_level_for_xp($1) n',[first.xp])).rows[0].n);
  assert.equal(first.coins,0,'client-editable progress cannot mint spendable coins');
  assert.equal(first.handle,'Bat');
  // Running it again changes nothing: the coin top-up is a difference, not a repeat payment.
  const again=await sync(null);
  assert.equal(again.coins,first.coins);assert.equal(again.handle,'Bat');
  assert.equal((await q(`select count(*)::int n from public.ew_coin_ledger where user_id=$1`,[C])).rows[0].n,0);
  // More progress tops the balance up by the difference only.
  const state=(await q('select revision from public.ew_learning_states where user_id=$1',[C])).rows[0];
  await push(progress(20,5,1),state.revision);
  const grown=await sync(null);
  assert.equal(grown.coins,0);
  assert.ok(grown.xp>first.xp&&grown.level>=first.level);
  await assert.rejects(sync('x'.repeat(41)),/invalid handle/);
  await assert.rejects(sync('bad\nname'),/invalid handle/);
 });
});

test('the level the app draws and the level the database awards are the same rule',async()=>{
 // community-ui.js draws the progress bar from xpForLevel(); ew_level_for_xp() decides the level
 // that is published. If these ever drift, a player sees a full bar and no new level.
 for(const level of [1,2,3,7,12,30]){
  const need=xpForLevel(level);
  const at=(await q('select public.ew_level_for_xp($1) n',[need])).rows[0].n;
  const below=(await q('select public.ew_level_for_xp($1) n',[Math.max(0,need-1)])).rows[0].n;
  assert.equal(at,level,`xp ${need} is level ${level}`);
  assert.equal(below,Math.max(1,level-1),`one XP short of ${need} is still the level below`);
 }
});
test('the leaderboard is readable by every player, and nothing else about them is',async()=>{
 await addLogin(C);await addLogin(D);
 await as(D,async()=>{await push(progress(3,0,0),0);await sync('Ana');});
 await as(C,async()=>{
  const rows=(await q('select handle,level,xp,coins from public.ew_public_stats order by xp desc')).rows;
  assert.deepEqual(rows.map(r=>r.handle),['Bat','Ana'],'both players are listed, strongest first');
  assert.equal((await q('select count(*)::int n from public.ew_learning_states where user_id=$1',[D])).rows[0].n,0,'their learning document stays private');
  assert.equal((await q('select count(*)::int n from public.ew_coin_ledger where user_id=$1',[D])).rows[0].n,0,'their coin history stays private');
  assert.equal((await q('select public.ew_coin_balance($1) n',[D])).rows[0].n,0,'balance helper obeys the same owner policy');
  // The leaderboard is read-only to every client: only ew_sync_profile, which runs as the database
  // owner and derives the numbers itself, may write it.
  await assert.rejects(q(`update public.ew_public_stats set xp=999999, level=99 where user_id=$1`,[C]),/permission denied/,'a player cannot write their own row');
  await assert.rejects(q(`update public.ew_public_stats set xp=0 where user_id=$1`,[D]),/permission denied/,'nor anyone else’s');
  await assert.rejects(q(`insert into public.ew_coin_ledger (user_id,amount,reason) values ($1,1000,'bonus')`,[C]),/permission denied/,'coins cannot be minted from the client');
  const mine=await sync(null);
  assert.equal(mine.players,2);assert.equal(mine.rank,1);
 });
 await as(D,async()=>{assert.equal((await sync(null)).rank,2);});
});

test('one active device: a new device takes over and the old one can no longer push',async()=>{
 await addLogin(C);await addLogin(D);
 const claim=(id,label)=>q('select public.ew_claim_device($1,$2) as r',[id,label]).then(x=>x.rows[0].r);
 const status=id=>q('select public.ew_device_status($1) as r',[id]).then(x=>x.rows[0].r);
 const pushFrom=(device,state,base)=>q('select public.ew_push_learning_state($1::jsonb,$2,$3) as r',[state,base,device]).then(x=>x.rows[0].r);
 await as(D,async()=>{
  assert.equal((await status('phone')).claimed,false,'an account with no claim accepts any device');
  assert.deepEqual(await claim('phone','Phone'),{device_id:'phone',replaced:false});
  assert.equal((await status('phone')).active,true);
  const revision=(await q('select revision from public.ew_learning_states where user_id=$1',[D])).rows[0].revision;
  assert.equal((await pushFrom('phone',progress(4,0,0),revision)).status,'ok');
  // The same person signs in on a laptop.
  assert.deepEqual(await claim('laptop','Laptop'),{device_id:'laptop',replaced:true});
  const now=(await q('select revision from public.ew_learning_states where user_id=$1',[D])).rows[0].revision;
  await assert.rejects(pushFrom('phone',progress(5,0,0),now),/device not active/,'the phone is locked out');
  await assert.rejects(pushFrom(null,progress(5,0,0),now),/device not active/,'omitting the device cannot bypass the lock');
  assert.equal((await status('phone')).active,false);
  assert.equal((await status('laptop')).active,true);
  assert.equal((await pushFrom('laptop',progress(5,0,0),now)).status,'ok');
  await assert.rejects(claim('','x'),/invalid device id/);
 });
 await as(C,async()=>{assert.equal((await status('phone')).claimed,false,'another account is unaffected');});
});

test('deleting the account removes the public row, the coins and the device claim',async()=>{
 await as(C,async()=>{
  assert.equal((await q('select public.ew_delete_my_account() as r')).rows[0].r.login_deleted,true);
 });
 assert.equal((await q('select count(*)::int n from public.ew_public_stats where user_id=$1',[C])).rows[0].n,0);
 assert.equal((await q('select count(*)::int n from public.ew_coin_ledger where user_id=$1',[C])).rows[0].n,0);
 assert.equal((await q('select count(*)::int n from public.ew_profiles where id=$1',[C])).rows[0].n,0);
});

test('extended profiles and photos remain private and reject oversized or active-content images',async()=>{
 const E='55555555-5555-4555-8555-555555555555',F='66666666-6666-4666-8666-666666666666';
 await addLogin(E);await addLogin(F);
 await as(E,async()=>{
  await q(`insert into public.ew_profiles(id,first_name,last_name,nickname,avatar_data) values ($1,'Бат','Болд','Бат_123','data:image/jpeg;base64,YQ==')`,[E]);
  assert.equal((await q('select first_name,nickname,avatar_data from public.ew_profiles where id=$1',[E])).rows[0].nickname,'Бат_123');
  await assert.rejects(q(`update public.ew_profiles set avatar_data='data:image/svg+xml;base64,YQ==' where id=$1`,[E]),/check constraint/);
  await assert.rejects(q(`update public.ew_profiles set nickname='bad nickname' where id=$1`,[E]),/check constraint/);
  await assert.rejects(q(`update public.ew_profiles set avatar_data=$1 where id=$2`,['data:image/png;base64,'+'A'.repeat(120001),E]),/check constraint/);
 });
 await as(F,async()=>{
  assert.equal((await q('select * from public.ew_profiles where id=$1',[E])).rows.length,0);
  assert.equal((await q(`update public.ew_profiles set first_name='Other' where id=$1`,[E])).affectedRows,0);
 });
});

const G='77777777-7777-4777-8777-777777777777',H='88888888-8888-4888-8888-888888888888',I='99999999-9999-4999-8999-999999999999';
const rpc=async(action,id=null,opponent=null,answer=null,index=null,device='challenge-test')=>(await q('select public.ew_challenge($1,$2,$3,$4,$5,$6) r',[action,id,opponent,answer,index,device])).rows[0].r;
const membershipStatus=async()=>(await q('select public.ew_membership_status() r')).rows[0].r;
test('challenges keep answer keys private, require both players, reject replay and score on the server',async()=>{
 for(const id of [G,H,I]){await addLogin(id);await as(id,async()=>{await q('select public.ew_claim_device($1,$2)',['challenge-test','Test']);await sync(null);});}
 const challenge=await as(G,()=>rpc('invite',null,H));
 await as(G,async()=>{await assert.rejects(rpc('start',challenge.id),/Both players/);await assert.rejects(q('select * from public.ew_challenges'),/permission denied/);await assert.rejects(rpc('invite',null,H),/already exists/);});
 await as(I,()=>assert.rejects(rpc('accept',challenge.id),/not found/));
 await as(H,()=>rpc('accept',challenge.id));
 const round=await as(G,()=>rpc('start',challenge.id));assert.equal(round.index,0);assert.equal(round.question.answer,undefined);assert.equal(round.question.options.length,4);
 const keys=(await q('select questions from public.ew_challenges where id=$1',[challenge.id])).rows[0].questions;
 await as(G,async()=>{
  await assert.rejects(rpc('answer',challenge.id,null,'fake',0),/Invalid answer/);
  for(let i=0;i<10;i++){const r=await rpc('answer',challenge.id,null,keys[i].answer,i);if(i===9){assert.equal(r.score,10);assert.equal(r.finished,true);}}
  const again=await rpc('start',challenge.id);assert.equal(again.score,10);
 });
 await as(H,async()=>{await rpc('start',challenge.id);for(let i=0;i<10;i++)await rpc('answer',challenge.id,null,keys[i].options.find(o=>o.id!==keys[i].answer).id,i);});
 assert.equal((await q("select count(*)::int n from public.ew_coin_ledger where user_id=$1 and reason='battle-win'",[G])).rows[0].n,1);
 const list=await as(G,()=>rpc('list'));assert.equal(list[0].other_score,0);assert.equal(list[0].mine,10);
 await as(G,()=>assert.rejects(rpc('start',challenge.id,null,null,null,'other-device'),/active device/));
});
test('daily practice resumes the same attempt, times out and cannot grant repeat daily rewards',async()=>{
 const a=await as(G,()=>rpc('practice')),b=await as(G,()=>rpc('practice'));assert.equal(a.id,b.id);
 await as(G,()=>rpc('start',a.id));
 await q("update public.ew_challenge_attempts set started_at=now()-interval '4 minutes' where challenge_id=$1",[a.id]);
 const done=await as(G,()=>rpc('answer',a.id,null,'anything',0));assert.equal(done.finished,true);assert.equal(done.score,0);
 assert.equal((await q("select count(*)::int n from public.ew_coin_ledger where user_id=$1 and ref like 'daily:%'",[G])).rows[0].n,1);
 await as(G,()=>assert.rejects(q('select public.ew_record_activity($1)',[G]),/permission denied/));
});
test('welcome gift is once only; coin renewal is atomic, extends expiry and is idempotent',async()=>{
 const first=await as(H,membershipStatus),again=await as(H,membershipStatus);assert.equal(first.coins,1000);assert.equal(again.coins,1000);
 const request='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 await as(H,()=>assert.rejects(q('select public.ew_redeem_month($1)',[request]),/Not enough coins/));
 await q("insert into public.ew_coin_ledger(user_id,amount,reason,ref) values($1,199000,'bonus','test-funding')",[H]);
 const expiry=(await as(H,()=>q('select public.ew_redeem_month($1) expiry',[request]))).rows[0].expiry;
 const retry=(await as(H,()=>q('select public.ew_redeem_month($1) expiry',[request]))).rows[0].expiry;assert.equal(+expiry,+retry);
 assert.equal((await as(H,membershipStatus)).coins,100000);
 const next=(await as(H,()=>q('select public.ew_redeem_month($1) expiry',['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']))).rows[0].expiry;assert.ok(+next>+expiry);
 assert.equal((await as(H,membershipStatus)).coins,0);
});
test('membership protects learning RPCs, admin grants and bans override renewals; ordinary users cannot change settings',async()=>{
 await q('update public.ew_product_settings set gate_enabled=true where id=1');
 try{
  assert.equal((await as(G,membershipStatus)).active,false);assert.equal((await as(H,membershipStatus)).active,true);
  await as(G,()=>assert.rejects(sync(null),/Membership required/));
  await as(G,()=>assert.rejects(rpc('list'),/Membership required/));
  await as(G,()=>assert.rejects(q("select public.ew_admin_member($1,'unlimited',1)",[G+'@example.test']),/Admin required/));
  await as(G,async()=>{assert.equal((await q('update public.ew_product_settings set price_mnt=1')).affectedRows,0);assert.equal((await q('select * from public.ew_orders')).rows.length,0);});
  await as(A,()=>q("select public.ew_admin_member($1,'grant',1)",[G+'@example.test']));assert.equal((await as(G,membershipStatus)).active,true);
  await as(A,()=>q("select public.ew_admin_member($1,'ban',1)",[G+'@example.test']));assert.equal((await as(G,membershipStatus)).active,false);
  await as(G,()=>assert.rejects(q('select public.ew_redeem_month($1)',['cccccccc-cccc-4ccc-8ccc-cccccccccccc']),/cannot be redeemed/));
  await as(A,()=>q("select public.ew_admin_member($1,'unban',1)",[G+'@example.test']));assert.equal((await as(G,membershipStatus)).active,true);
  await as(A,()=>q("select public.ew_admin_member($1,'unlimited',1)",[G+'@example.test']));assert.equal((await as(G,membershipStatus)).unlimited,true);
 }finally{await q('update public.ew_product_settings set gate_enabled=false where id=1');}
});
test('payment price comes from settings and confirmation is admin-only, idempotent and duplicate-proof',async()=>{
 await q('update public.ew_product_settings set sales_enabled=true where id=1');
 let order;
 try{
  await as(G,()=>assert.rejects(q('select public.ew_create_order($1)',['buyer@example.test']),/permission denied/));
  await db.exec('set role service_role');try{order=(await q('select public.ew_create_order($1) r',['Buyer@example.test'])).rows[0].r;}finally{await db.exec('reset role');}
  assert.equal(order.amount,5000);
  await as(H,()=>assert.rejects(q("select public.ew_manage_order($1,'confirm','BANK123')",[order.id]),/Admin required/));
  await as(A,()=>q("select public.ew_manage_order($1,'confirm','BANK123')",[order.id]));
  const before=(await q("select expires_at from public.ew_memberships where email='buyer@example.test'")).rows[0].expires_at;
  await as(A,()=>q("select public.ew_manage_order($1,'confirm','BANK123')",[order.id]));
  const after=(await q("select expires_at from public.ew_memberships where email='buyer@example.test'")).rows[0].expires_at;assert.equal(+before,+after);
 }finally{await q('update public.ew_product_settings set sales_enabled=false where id=1');}
});
