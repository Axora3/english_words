import test from 'node:test';import assert from 'node:assert/strict';
import {emptyState,markLearned} from '../core.js';
import {migrateAdvanced} from '../advanced-state.js';
import {validBackup} from '../backup.js';
import {createSyncEngine,SYNC_KEYS} from '../sync.js';

const at=new Date(2026,10,17,9).getTime(),copy=x=>JSON.parse(JSON.stringify(x));
const fresh=()=>{const s=emptyState();migrateAdvanced(s);return s;};
const memoryStorage=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),m};};

/** In-memory stand-in for Supabase with the same compare-and-swap semantics as push_learning_state. */
function fakeServer(){const s={row:null,backups:[],fail:false,calls:0};
 s.api={async fetchState(){s.calls++;if(s.fail)throw new TypeError('Failed to fetch');return s.row&&copy(s.row);},
  async pushState(state,base){s.calls++;if(s.fail)throw new TypeError('Failed to fetch');if(base===0){if(s.row)return {status:'conflict',revision:s.row.revision};s.row={state:copy(state),revision:1,updated_at:new Date(at).toISOString()};return {status:'ok',revision:1};}
   if(!s.row||s.row.revision!==base)return {status:'conflict',revision:s.row?.revision??null};s.row={state:copy(state),revision:base+1,updated_at:new Date(at).toISOString()};return {status:'ok',revision:s.row.revision};},
  async createBackup(state,reason){s.backups.push({state:copy(state),reason});}};
 return s;}
function device(server,initial=fresh(),opts={}){const d={state:copy(initial),storage:memoryStorage(),online:true,timers:[]};
 d.engine=createSyncEngine({api:server.api,getState:()=>d.state,applyState:x=>{d.state=x;},validate:validBackup,storage:d.storage,isOnline:()=>d.online,now:()=>at,schedule:(fn)=>{d.timers.push(fn);return d.timers.length;},cancel:()=>{},...opts});
 d.status=()=>d.engine.snapshot().status;d.change=fn=>{fn(d.state);d.engine.markDirty();};return d;}
const user={id:'u1',email:'a@example.test'};
const settle=()=>new Promise(r=>setTimeout(r,0));

test('first sign-in with local progress and an empty cloud asks before uploading, then verifies',async()=>{
 const server=fakeServer(),local=fresh();markLearned(local,'1',at);const d=device(server,local);
 d.engine.setUser(user);await d.engine.syncNow();
 assert.equal(d.status(),'needs-choice');assert.equal(d.engine.snapshot().plan.kind,'upload');assert.equal(server.row,null,'nothing uploaded without consent');
 await d.engine.choose('use-device');
 assert.equal(d.status(),'synced');assert.ok(server.row.state.learned['1']);assert.equal(d.engine.snapshot().verified,true);
 assert.ok(d.engine.presyncState().learned['1'],'a local copy is kept until discarded');
});
test('a new device with no progress adopts the cloud data automatically',async()=>{
 const server=fakeServer(),cloud=fresh();markLearned(cloud,'2',at);server.row={state:cloud,revision:4,updated_at:''};
 const d=device(server);d.engine.setUser(user);await d.engine.syncNow();
 assert.equal(d.status(),'synced');assert.ok(d.state.learned['2']);assert.equal(d.engine.presyncState(),null);
});
test('when both have progress the user chooses; merge keeps both and replacing the cloud backs it up first',async()=>{
 const cloud=fresh();markLearned(cloud,'2',at);const local=fresh();markLearned(local,'1',at);
 let server=fakeServer();server.row={state:copy(cloud),revision:1,updated_at:''};let d=device(server,local);
 d.engine.setUser(user);await d.engine.syncNow();assert.equal(d.engine.snapshot().plan.kind,'choose');
 await d.engine.choose('merge');assert.deepEqual(Object.keys(server.row.state.learned).sort(),['1','2']);assert.deepEqual(Object.keys(d.state.learned).sort(),['1','2']);
 server=fakeServer();server.row={state:copy(cloud),revision:1,updated_at:''};d=device(server,local);d.engine.setUser(user);await d.engine.syncNow();
 await d.engine.choose('use-device');assert.deepEqual(Object.keys(server.row.state.learned),['1']);assert.equal(server.backups[0].reason,'before-replace');assert.ok(server.backups[0].state.learned['2']);
});
test('concurrent edits on two devices are merged without losing either change',async()=>{
 const server=fakeServer();const a=device(server),b=device(server);
 a.engine.setUser(user);await a.engine.syncNow();b.engine.setUser(user);await b.engine.syncNow();
 a.change(s=>markLearned(s,'1',at));b.change(s=>{markLearned(s,'2',at);s.favorites.push('2');});
 await a.engine.syncNow();await b.engine.syncNow();await a.engine.syncNow();
 for(const s of [server.row.state,a.state,b.state]){assert.deepEqual(Object.keys(s.learned).sort(),['1','2']);assert.deepEqual(s.favorites,['2']);}
 assert.equal(a.status(),'synced');assert.equal(b.status(),'synced');
});
test('offline changes stay local and are pushed when the connection returns',async()=>{
 const server=fakeServer(),d=device(server);d.engine.setUser(user);await d.engine.syncNow();const rev=server.row.revision;
 d.online=false;d.change(s=>markLearned(s,'3',at));await d.engine.syncNow();
 assert.equal(d.status(),'offline');assert.equal(server.row.revision,rev);assert.equal(d.engine.snapshot().dirty,true);
 d.online=true;await d.engine.syncNow();assert.equal(d.status(),'synced');assert.ok(server.row.state.learned['3']);assert.equal(d.engine.snapshot().dirty,false);
});
test('network failures are reported and retried with backoff, never dropping changes',async()=>{
 const server=fakeServer(),d=device(server);d.engine.setUser(user);await d.engine.syncNow();
 server.fail=true;d.change(s=>markLearned(s,'4',at));await d.engine.syncNow();
 assert.equal(d.status(),'offline');assert.ok(d.timers.length>0,'a retry is scheduled');assert.equal(d.engine.snapshot().dirty,true);
 server.fail=false;await d.timers.at(-1)();await settle();assert.ok(server.row.state.learned['4']);
});
test('an invalid cloud document is never applied to the device',async()=>{
 const server=fakeServer(),d=device(server);d.engine.setUser(user);await d.engine.syncNow();
 server.row={state:{version:1,learned:{'no-such':{}}},revision:9,updated_at:''};const before=copy(d.state);
 await d.engine.syncNow();assert.equal(d.status(),'error');assert.deepEqual(d.state,before);
});
test('sign-out preserves the owner metadata so learning data never becomes unowned guest data',async()=>{
 const server=fakeServer(),local=fresh();markLearned(local,'1',at);const d=device(server,local);d.engine.setUser(user);await d.engine.syncNow();await d.engine.choose('use-device');
 d.engine.forget();assert.equal(d.status(),'signed-out');assert.equal(JSON.parse(d.storage.getItem(SYNC_KEYS.META)).userId,user.id);assert.equal(d.engine.presyncState(),null);assert.ok(d.state.learned['1']);
});

test('an account taken over by another device stops syncing and says why',async()=>{
 const server=fakeServer(),d=device(server);
 d.engine.setUser(user);await settle();await d.engine.syncNow();await settle();
 assert.equal(d.status(),'synced');
 // The same account signs in somewhere else; the database refuses this device's next push.
 server.api.pushState=async()=>{throw Error('device not active');};
 markLearned(d.state,'1',at);d.engine.markDirty();
 const before=d.timers.length;
 await d.engine.syncNow();await settle();
 assert.equal(d.status(),'device','the person has to choose, so the status says so');
 assert.equal(d.timers.length,before,'no retry is scheduled: retrying cannot win the account back');
 assert.equal(d.engine.snapshot().dirty,true,'the unsent change is still waiting on this device');
 // Taking the account back here makes the next sync go through, with nothing lost.
 server.api.pushState=fakeServer().api.pushState.bind(null);
 server.api.pushState=async(state,base)=>{server.row={state:copy(state),revision:(server.row?.revision??0)+1};return {status:'ok',revision:server.row.revision};};
 await d.engine.syncNow();await settle();
 assert.equal(d.status(),'synced');
 assert.ok(server.row.state.learned['1'],'the change made while locked out is uploaded');
});
