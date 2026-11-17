import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountStorage} from '../account-storage.js';
import {createSyncEngine,SYNC_KEYS} from '../sync.js';
import {emptyState,markLearned} from '../core.js';
import {validBackup} from '../backup.js';
const copy=value=>JSON.parse(JSON.stringify(value));
const memory=()=>{const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};};
const A={id:'account-a',email:'a@example.test'},B={id:'account-b',email:'b@example.test'};
const learned=(id)=>{const state=emptyState();markLearned(state,id,1);return state;};
function harness(){
 const storage=memory(),accounts=createAccountStorage({storage,validate:validBackup}),rows=new Map(),calls=[];
 let state=accounts.select(null);
 const api={
  async fetchState(id){calls.push(['read',id]);return rows.has(id)?copy(rows.get(id)):null;},
  async pushState(next,revision,id){calls.push(['write',id]);const row=rows.get(id);if((row?.revision||0)!==revision)return {status:'conflict'};rows.set(id,{state:copy(next),revision:revision+1});return {status:'ok',revision:revision+1};},
  async createBackup(next,reason,label,id){calls.push(['backup',id,copy(next)]);}
 };
 const engine=createSyncEngine({api,getState:()=>state,applyState:next=>{state=next;accounts.save(state);},validate:validBackup,storage:accounts.syncStorage,schedule:()=>1,cancel:()=>{},isOnline:()=>true});
 return {storage,accounts,rows,api,engine,calls,get state(){return state;},
  select(user){engine.setUser(null);state=accounts.select(user?.id||null);engine.setUser(user);},
  learn(id){markLearned(state,id,1);accounts.save(state);engine.markDirty();}
 };
}
test('two accounts in the same browser keep learning, favorites and cloud rows separate across sign-out',async()=>{
 const d=harness();d.select(A);await d.engine.syncNow();d.learn('w1');d.state.favorites=['w1'];d.accounts.save(d.state);d.engine.markDirty();await d.engine.syncNow();
 d.select(null);assert.deepEqual(d.state.learned,{});assert.equal(d.engine.snapshot().user,null);
 d.select(B);await d.engine.syncNow();assert.deepEqual(d.state.learned,{});assert.deepEqual(d.state.favorites,[]);
 d.learn('w2');await d.engine.syncNow();assert.deepEqual(Object.keys(d.rows.get(B.id).state.learned),['w2']);
 assert.deepEqual(Object.keys(d.rows.get(A.id).state.learned),['w1']);
 d.select(A);await d.engine.syncNow();assert.deepEqual(Object.keys(d.state.learned),['w1']);assert.deepEqual(d.state.favorites,['w1']);
 d.select(B);await d.engine.syncNow();assert.deepEqual(Object.keys(d.state.learned),['w2']);
});
test('legacy progress with no owner is preserved but never attached to a new account',()=>{
 const storage=memory(),raw=JSON.stringify(learned('private-old-word'));storage.setItem('lexi-v1',raw);
 const accounts=createAccountStorage({storage,validate:validBackup});
 assert.deepEqual(accounts.select(B.id).learned,{});assert.deepEqual(accounts.select(null).learned,{});
 assert.equal(storage.getItem('lexi-v1'),raw);
});
test('legacy metadata can recover its own account without exposing it to a different account',()=>{
 const storage=memory();storage.setItem('lexi-v1',JSON.stringify(learned('w1')));storage.setItem(SYNC_KEYS.META,JSON.stringify({userId:A.id,revision:1,dirty:true}));
 const accounts=createAccountStorage({storage,validate:validBackup});
 assert.deepEqual(accounts.select(B.id).learned,{});assert.ok(accounts.select(A.id).learned.w1);
 assert.equal(JSON.parse(accounts.syncStorage.getItem(SYNC_KEYS.META)).userId,A.id);
 accounts.clear(A.id);
 const reopened=createAccountStorage({storage,validate:validBackup});
 assert.deepEqual(reopened.select(A.id).learned,{},'cleared data is not resurrected from legacy storage');
});
test('late cloud fetch from A cannot replace B state or trigger an A-to-B upload',async()=>{
 const d=harness();let resolveA;const original=d.api.fetchState;
 d.api.fetchState=id=>id===A.id?new Promise(resolve=>{resolveA=resolve;}):original(id);
 d.select(A);const old=d.engine.syncNow();
 d.select(B);await d.engine.syncNow();d.learn('w2');await d.engine.syncNow();
 resolveA({state:learned('w1'),revision:8});await old;
 assert.deepEqual(Object.keys(d.state.learned),['w2']);assert.deepEqual(Object.keys(d.rows.get(B.id).state.learned),['w2']);
 assert.equal(d.engine.snapshot().user.id,B.id);assert.equal(d.engine.snapshot().status,'synced');
 assert.equal(JSON.parse(d.accounts.syncStorage.getItem(SYNC_KEYS.META)).userId,B.id);
});
test('late push and verification from A cannot write B metadata or its base document',async()=>{
 const d=harness();d.select(A);await d.engine.syncNow();d.learn('w1');
 let resolvePush;const original=d.api.pushState;
 d.api.pushState=(next,revision,id)=>id===A.id?new Promise(resolve=>{resolvePush=()=>original(next,revision,id).then(resolve);}):original(next,revision,id);
 const old=d.engine.syncNow();await Promise.resolve();await Promise.resolve();
 d.select(B);await d.engine.syncNow();d.learn('w2');await d.engine.syncNow();
 await resolvePush();await old;
 assert.deepEqual(Object.keys(d.state.learned),['w2']);
 assert.equal(JSON.parse(d.accounts.syncStorage.getItem(SYNC_KEYS.META)).userId,B.id);
 assert.deepEqual(Object.keys(JSON.parse(d.accounts.syncStorage.getItem(SYNC_KEYS.BASE)).learned),['w2']);
 assert.deepEqual(Object.keys(d.rows.get(A.id).state.learned),['w1']);
});
test('clear local data removes only the named account and leaves another account untouched',()=>{
 const d=harness();d.accounts.select(A.id);d.accounts.save(learned('w1'));d.accounts.select(B.id);d.accounts.save(learned('w2'));
 d.accounts.clear(A.id);assert.deepEqual(Object.keys(d.accounts.select(B.id).learned),['w2']);assert.deepEqual(d.accounts.select(A.id).learned,{});
});
