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
 create role anon nologin; create role authenticated nologin;
 create schema auth; create table auth.users (id uuid primary key, email text);
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
 assert.deepEqual(created,['admin_users','ew_cloud_backups','ew_coin_ledger','ew_learning_states','ew_profiles','ew_public_stats']);
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
 assert.equal(rows.length,5);for(const r of rows)assert.equal(r.relrowsecurity,true,r.relname);
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
  assert.equal(first.coins,12*5+5+20,'coins are earned from progress');
  assert.equal(first.handle,'Bat');
  // Running it again changes nothing: the coin top-up is a difference, not a repeat payment.
  const again=await sync(null);
  assert.equal(again.coins,first.coins);assert.equal(again.handle,'Bat');
  assert.equal((await q(`select count(*)::int n from public.ew_coin_ledger where user_id=$1`,[C])).rows[0].n,1);
  // More progress tops the balance up by the difference only.
  const state=(await q('select revision from public.ew_learning_states where user_id=$1',[C])).rows[0];
  await push(progress(20,5,1),state.revision);
  const grown=await sync(null);
  assert.equal(grown.coins,20*5+5+20);
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
