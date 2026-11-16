// Runs the real Supabase migrations in an in-process PostgreSQL (PGlite) with Supabase-style roles
// and auth.uid(), then verifies Row Level Security isolation and the sync/account functions.
import test from 'node:test';import assert from 'node:assert/strict';import {readdir,readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {emptyState} from '../core.js';

const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const doc=JSON.stringify(emptyState());
let db;

// Minimal stand-in for the parts of Supabase the migration relies on.
const SUPABASE_STUB=`
 create role anon nologin; create role authenticated nologin;
 create schema auth; create table auth.users (id uuid primary key, email text);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
 grant usage on schema auth, public to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
 alter default privileges in schema public grant all on tables to anon, authenticated;
 alter default privileges in schema public grant execute on functions to anon, authenticated;`;

async function as(user,fn){await db.exec(`set role ${user?'authenticated':'anon'}; select set_config('request.jwt.claim.sub','${user||''}',false);`);try{return await fn();}finally{await db.exec('reset role;');}}
const q=(sql,params)=>db.query(sql,params);
const push=(state,base)=>q('select public.push_learning_state($1::jsonb,$2,$3) as r',[state,base,'test']).then(x=>x.rows[0].r);

test.before(async()=>{
 db=new PGlite();await db.exec(SUPABASE_STUB);
 const dir=new URL('../supabase/migrations/',import.meta.url);
 for(const f of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(f,dir),'utf8'));
 await db.exec(`insert into auth.users (id,email) values ('${A}','a@example.test'),('${B}','b@example.test');`);
});
test.after(async()=>db?.close());

test('a profile is created for every new account and only its owner can change it',async()=>{
 assert.equal((await q('select count(*)::int n from public.profiles')).rows[0].n,2);
 await as(A,async()=>{await q(`update public.profiles set display_name='Ana' where id=$1`,[A]);assert.equal((await q('select count(*)::int n from public.profiles')).rows[0].n,1,'A sees only own profile');
  const r=await q(`update public.profiles set display_name='hacked' where id=$1`,[B]);assert.equal(r.affectedRows,0);
  await assert.rejects(q(`update public.profiles set display_name=$1 where id=$2`,['x'.repeat(81),A]),/check constraint/);});
 assert.equal((await q('select display_name from public.profiles where id=$1',[B])).rows[0].display_name,null);
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
  assert.equal((await q('select count(*)::int n from public.learning_states')).rows[0].n,0,'B cannot see A');
  assert.equal((await q(`update public.learning_states set revision=99 where user_id=$1`,[A])).affectedRows,0);
  assert.equal((await q(`delete from public.learning_states where user_id=$1`,[A])).affectedRows,0);
  await assert.rejects(q(`insert into public.learning_states (user_id,state) values ($1,$2::jsonb)`,[A,doc]),/row-level security/);
  assert.equal((await push(doc,0)).status,'ok','B gets an own document');
 });
 assert.equal(Number((await q('select revision from public.learning_states where user_id=$1',[A])).rows[0].revision),2,'A is untouched');
});
test('anonymous visitors have no access to any table or function',async()=>{
 await as(null,async()=>{
  for(const t of ['profiles','learning_states','cloud_backups'])await assert.rejects(q(`select * from public.${t}`),/permission denied/);
  await assert.rejects(push(doc,0),/permission denied/);
  await assert.rejects(q('select public.delete_my_account()'),/permission denied/);
 });
});
test('cloud backups are private, immutable and capped at 30 per user',async()=>{
 await as(A,async()=>{
  for(let i=0;i<32;i++)await q(`insert into public.cloud_backups (label,state,words_learned) values ($1,$2::jsonb,$3)`,['b'+i,doc,i]);
  const rows=(await q('select label from public.cloud_backups order by created_at desc, words_learned desc')).rows;assert.equal(rows.length,30);
  await assert.rejects(q(`update public.cloud_backups set label='x'`),/permission denied/);
  await assert.rejects(q(`insert into public.cloud_backups (user_id,state) values ($1,$2::jsonb)`,[B,doc]),/row-level security/);
 });
 await as(B,async()=>{assert.equal((await q('select count(*)::int n from public.cloud_backups')).rows[0].n,0);assert.equal((await q('delete from public.cloud_backups')).affectedRows,0);});
});
test('deleting an account removes only that user\'s data',async()=>{
 await as(A,()=>q('select public.delete_my_account()'));
 const left=async t=>(await q(`select count(*)::int n from public.${t} where ${t==='profiles'?'id':'user_id'}=$1`,[A])).rows[0].n;
 for(const t of ['profiles','learning_states','cloud_backups'])assert.equal(await left(t),0,t);
 assert.equal((await q('select count(*)::int n from auth.users where id=$1',[B])).rows[0].n,1);
 assert.equal((await q('select count(*)::int n from public.learning_states where user_id=$1',[B])).rows[0].n,1);
});
test('every user-owned table has RLS enabled',async()=>{
 const rows=(await q(`select relname, relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r'`)).rows;
 assert.ok(rows.length>=3);for(const r of rows)assert.equal(r.relrowsecurity,true,r.relname);
});
