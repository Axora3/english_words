// Runs the real Supabase migration in an in-process PostgreSQL (PGlite) with Supabase-style roles
// and auth.uid(), in a database that already contains another app (like the production project),
// then verifies isolation, Row Level Security and the sync/account functions.
import test from 'node:test';import assert from 'node:assert/strict';import {readdir,readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {emptyState} from '../core.js';

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
 assert.deepEqual(created,['admin_users','ew_cloud_backups','ew_learning_states','ew_profiles']);
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
 assert.equal(rows.length,3);for(const r of rows)assert.equal(r.relrowsecurity,true,r.relname);
});
