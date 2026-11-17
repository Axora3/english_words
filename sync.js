// Cloud sync engine for one signed-in user. Local-first: the app keeps working on the local document;
// this engine reconciles it with the cloud copy using revisions (compare-and-swap) and a three-way merge.
// I/O is injected (api, storage, clock) so every path can be tested without a network.
import {emptyState} from './core.js';
import {mergeStates,stateSummary,hasLearningData} from './merge.js';

const META='english-words-sync',BASE='english-words-sync-base',PRESYNC='english-words-presync';
export const SYNC_KEYS={META,BASE,PRESYNC};
const clone=x=>JSON.parse(JSON.stringify(x));

export function createSyncEngine({api,getState,applyState,validate,storage=globalThis.localStorage,isOnline=()=>globalThis.navigator?.onLine!==false,now=()=>Date.now(),onChange=()=>{},schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id)}){
 const read=(k,fallback=null)=>{try{const v=storage.getItem(k);return v===null?fallback:JSON.parse(v);}catch{return fallback;}};
 const write=(k,v)=>{try{storage.setItem(k,JSON.stringify(v));}catch{}};
 const remove=k=>{try{storage.removeItem(k);}catch{}};
 let meta=read(META,{}),user=null,status=meta.userId?'idle':'signed-out',error='',plan=null,running=null,again=false,timer=null,retries=0,counter=0;
 const emit=()=>onChange(engine.snapshot());
 const set=(s,e='')=>{status=s;error=e;emit();};
 const saveMeta=patch=>{meta={...meta,...patch};write(META,meta);};
 const later=(ms,fn=()=>engine.syncNow())=>{if(timer)cancel(timer);timer=schedule(()=>{timer=null;fn();},ms);};

 async function push(state,base){const r=await api.pushState(state,base);return r?.status==='ok'?r:null;}
 function done(snapshot,revision,startCounter){write(BASE,snapshot);retries=0;saveMeta({userId:user.id,revision,syncedAt:now(),dirty:counter!==startCounter});set(counter!==startCounter?'pending':'synced');if(counter!==startCounter)later(2000);}

 async function cycle(){
  if(!user)return set('signed-out');
  if(!isOnline())return set(meta.dirty?'offline':'offline');
  if(meta.userId!==user.id)return prepare();
  set('syncing');
  for(let attempt=0;attempt<3;attempt++){
   const startCounter=counter,remote=await api.fetchState(),local=getState();
   if(!remote){const r=await push(local,0);if(r){done(clone(local),r.revision,startCounter);return;}continue;}
   if(!validate(remote.state))throw Object.assign(Error('The cloud copy failed validation and was not applied.'),{code:'invalid-remote'});
   if(remote.revision===meta.revision){
    if(!meta.dirty){done(read(BASE,clone(local)),remote.revision,startCounter);return;}
    const r=await push(local,remote.revision);if(r){done(clone(local),r.revision,startCounter);return;}continue;
   }
   if(!meta.dirty){applyState(clone(remote.state));done(clone(remote.state),remote.revision,startCounter);return;}
   const merged=mergeStates(read(BASE,null),local,remote.state);applyState(clone(merged));
   const r=await push(merged,remote.revision);if(r){done(clone(merged),r.revision,startCounter);return;}
  }
  throw Object.assign(Error('Another device kept changing the data; will retry.'),{code:'conflict'});
 }

 // First sync of this device with this account: decide automatically when nothing can be lost,
 // otherwise ask the user (status "needs-choice") and wait for choose().
 async function prepare(){
  set('syncing');
  const remote=await api.fetchState(),local=getState(),localHas=hasLearningData(local),remoteHas=remote&&hasLearningData(remote.state);
  if(remote&&!validate(remote.state))throw Object.assign(Error('The cloud copy failed validation and was not applied.'),{code:'invalid-remote'});
  const foreign=Boolean(meta.userId&&meta.userId!==user.id);
  if(!localHas&&!remoteHas){plan={kind:'empty',remote};return choose(remote?'use-cloud':'use-device');}
  if(!localHas){plan={kind:'download',remote};return choose('use-cloud');}
  plan={kind:remoteHas?'choose':'upload',foreign,remote,local:stateSummary(local),cloud:remote?stateSummary(remote.state):null,cloudUpdatedAt:remote?.updated_at||null};
  set('needs-choice');
 }

 async function choose(choice){
  if(!plan||!user)return;
  const p=plan,local=getState(),remote=p.remote;
  if(choice==='cancel'){plan=null;return set('needs-choice');}
  if(hasLearningData(local))write(PRESYNC,{at:now(),userId:user.id,state:clone(local)}); // kept until the user discards it
  set('syncing');let result;
  if(choice==='use-cloud'){applyState(clone(remote.state));result={state:remote.state,revision:remote.revision};}
  else{
   let next=choice==='merge'&&remote?mergeStates(null,local,remote.state):local;
   if(choice==='merge')applyState(clone(next));
   if(remote&&choice==='use-device'&&hasLearningData(remote.state))await api.createBackup(remote.state,'before-replace','Cloud data before replacement');
   const r=await push(next,remote?remote.revision:0);
   if(!r)throw Object.assign(Error('The cloud copy changed during setup. Please try again.'),{code:'conflict'});
   result={state:next,revision:r.revision};
  }
  plan=null;counter++;const start=counter;done(clone(result.state),result.revision,start);
  // Verify: the cloud now holds the revision we wrote and at least the same amount of progress.
  const check=await api.fetchState();
  const ok=Boolean(check)&&check.revision===meta.revision&&stateSummary(check.state).learned>=stateSummary(result.state).learned;
  saveMeta({verifiedAt:ok?now():null});if(!ok)set('error','Could not verify the cloud copy. Your data is still on this device.');
 }

 const engine={
  snapshot:()=>({status,error,user:user?{id:user.id,email:user.email}:null,lastSyncedAt:meta.userId===user?.id?meta.syncedAt||null:null,dirty:Boolean(meta.dirty),plan:plan&&{kind:plan.kind,foreign:plan.foreign,local:plan.local,cloud:plan.cloud,cloudUpdatedAt:plan.cloudUpdatedAt},verified:Boolean(meta.verifiedAt),presync:read(PRESYNC,null)?{at:read(PRESYNC).at}:null}),
  setUser(next){const changed=(next?.id||null)!==(user?.id||null);user=next||null;if(!user){plan=null;set('signed-out');return;}if(changed){set(meta.userId===user.id?'idle':'syncing');engine.syncNow();}},
  /** Call after every local save. quiet=true marks the change without triggering an immediate sync. */
  markDirty(quiet=false){counter++;if(!meta.dirty)saveMeta({dirty:true});if(!user||meta.userId!==user.id)return;if(status==='synced'||status==='idle')set('pending');if(!quiet)later(3000);},
  async syncNow(){
   if(running){again=true;return running;}
   running=(async()=>{try{await cycle();}catch(e){const message=e?.message||String(e);
    // The account is signed in on another device. Retrying cannot fix that — the person has to
    // take the account back (Players screen) or sign in again, so stop and say so.
    if(/device not active/i.test(message)){set('device');}
    else{const offline=!isOnline()||e?.name==='TypeError'||/fetch|network/i.test(message);set(offline?'offline':'error',offline?'':message);retries++;later(Math.min(600000,15000*2**Math.min(retries,5)));}
   }finally{running=null;if(again){again=false;later(500);}}})();
   return running;
  },
  choose:c=>choose(c).catch(e=>{set('error',e?.message||String(e));}),
  presyncState:()=>read(PRESYNC,null)?.state||null,
  discardPresync(){remove(PRESYNC);emit();},
  /** Forget the link between this device and the account (used on sign-out / account deletion). */
  forget(){remove(META);remove(BASE);meta={};plan=null;user=null;set('signed-out');},
  hasUnsynced:()=>Boolean(meta.dirty)&&meta.userId===user?.id,
 };
 return engine;
}
export const emptyLearningState=emptyState;
