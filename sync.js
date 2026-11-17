// Sync work is bound to an account and a generation. A response from a previous login is discarded.
import {emptyState} from './core.js';
import {mergeStates,stateSummary,hasLearningData} from './merge.js';
const META='english-words-sync',BASE='english-words-sync-base',PRESYNC='english-words-presync';
export const SYNC_KEYS={META,BASE,PRESYNC};
const clone=x=>JSON.parse(JSON.stringify(x));
export function createSyncEngine({api,getState,applyState,validate,storage=globalThis.localStorage,isOnline=()=>globalThis.navigator?.onLine!==false,now=()=>Date.now(),onChange=()=>{},schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id)}){
 const read=(k,fallback=null)=>{try{const v=storage.getItem(k);return v===null?fallback:JSON.parse(v);}catch{return fallback;}};
 const write=(k,v)=>{try{storage.setItem(k,JSON.stringify(v));}catch{}};
 const remove=k=>{try{storage.removeItem(k);}catch{}};
 let meta=read(META,{}),user=null,status='signed-out',error='',plan=null,running=null,again=false,timer=null,retries=0,counter=0,generation=0;
 const emit=()=>onChange(engine.snapshot());
 const set=(s,e='')=>{status=s;error=e;emit();};
 const saveMeta=patch=>{meta={...meta,...patch};write(META,meta);};
 const context=()=>({id:user?.id,generation});
 const current=ctx=>Boolean(user)&&ctx.id===user.id&&ctx.generation===generation;
 const guard=ctx=>{if(!current(ctx))throw Object.assign(Error('Account changed'),{code:'stale-account'});};
 const later=(ms,ctx=context())=>{if(timer)cancel(timer);timer=schedule(()=>{timer=null;if(current(ctx))engine.syncNow();},ms);};
 async function fetch(ctx){guard(ctx);const remote=await api.fetchState(ctx.id);guard(ctx);return remote;}
 async function push(state,base,ctx){guard(ctx);const r=await api.pushState(state,base,ctx.id);guard(ctx);return r?.status==='ok'?r:null;}
 function done(snapshot,revision,startCounter,ctx){guard(ctx);write(BASE,snapshot);retries=0;saveMeta({userId:ctx.id,revision,syncedAt:now(),dirty:counter!==startCounter});set(counter!==startCounter?'pending':'synced');if(counter!==startCounter)later(2000,ctx);}
 async function cycle(ctx){
  guard(ctx);if(!isOnline())return set('offline');
  if(meta.userId!==ctx.id)return prepare(ctx);
  set('syncing');
  for(let attempt=0;attempt<3;attempt++){
   const startCounter=counter,remote=await fetch(ctx),local=clone(getState());
   if(!remote){const r=await push(local,0,ctx);if(r){done(local,r.revision,startCounter,ctx);return;}continue;}
   if(!validate(remote.state))throw Object.assign(Error('The cloud copy failed validation and was not applied.'),{code:'invalid-remote'});
   if(remote.revision===meta.revision){
    if(!meta.dirty){done(read(BASE,local),remote.revision,startCounter,ctx);return;}
    const r=await push(local,remote.revision,ctx);if(r){done(local,r.revision,startCounter,ctx);return;}continue;
   }
   if(!meta.dirty){applyState(clone(remote.state));done(clone(remote.state),remote.revision,startCounter,ctx);return;}
   const merged=mergeStates(read(BASE,null),local,remote.state);guard(ctx);applyState(clone(merged));
   const r=await push(merged,remote.revision,ctx);if(r){done(clone(merged),r.revision,startCounter,ctx);return;}
  }
  throw Object.assign(Error('Another device kept changing the data; will retry.'),{code:'conflict'});
 }
 async function prepare(ctx){
  guard(ctx);
  if(meta.userId&&meta.userId!==ctx.id)throw Error('Account storage does not match this login.');
  set('syncing');const remote=await fetch(ctx),local=clone(getState()),localHas=hasLearningData(local),remoteHas=remote&&hasLearningData(remote.state);
  if(remote&&!validate(remote.state))throw Object.assign(Error('The cloud copy failed validation and was not applied.'),{code:'invalid-remote'});
  if(!localHas&&!remoteHas){plan={kind:'empty',remote,ctx};return choose(remote?'use-cloud':'use-device',ctx);}
  if(!localHas){plan={kind:'download',remote,ctx};return choose('use-cloud',ctx);}
  plan={kind:remoteHas?'choose':'upload',foreign:false,remote,ctx,local:stateSummary(local),cloud:remote?stateSummary(remote.state):null,cloudUpdatedAt:remote?.updated_at||null};set('needs-choice');
 }
 async function choose(choice,ctx=context()){
  if(!plan||!current(ctx))return;const p=plan;guard(p.ctx);
  const local=clone(getState()),remote=p.remote;
  if(choice==='cancel')return set('needs-choice');
  if(!['use-cloud','use-device','merge'].includes(choice))throw Error('Invalid sync choice');
  if(hasLearningData(local))write(PRESYNC,{at:now(),userId:ctx.id,state:local});
  set('syncing');let result;
  if(choice==='use-cloud'){
   if(!remote)throw Error('No cloud copy');
   guard(ctx);applyState(clone(remote.state));result={state:remote.state,revision:remote.revision};
  }else{
   const next=choice==='merge'&&remote?mergeStates(null,local,remote.state):local;
   if(choice==='merge'){guard(ctx);applyState(clone(next));}
   if(remote&&choice==='use-device'&&hasLearningData(remote.state)){guard(ctx);await api.createBackup(remote.state,'before-replace','Cloud data before replacement',ctx.id);guard(ctx);}
   const r=await push(next,remote?remote.revision:0,ctx);
   if(!r)throw Object.assign(Error('The cloud copy changed during setup. Please try again.'),{code:'conflict'});
   result={state:next,revision:r.revision};
  }
  guard(ctx);plan=null;counter++;done(clone(result.state),result.revision,counter,ctx);
  const check=await fetch(ctx),ok=Boolean(check)&&check.revision===meta.revision&&stateSummary(check.state).learned>=stateSummary(result.state).learned;
  saveMeta({verifiedAt:ok?now():null});if(!ok)set('error','Could not verify the cloud copy. Your data is still on this device.');
 }
 const engine={
  snapshot:()=>({status,error,user:user?{id:user.id,email:user.email,user_metadata:clone(user.user_metadata||{})}:null,lastSyncedAt:meta.userId===user?.id?meta.syncedAt||null:null,dirty:Boolean(meta.dirty),plan:plan&&{kind:plan.kind,foreign:plan.foreign,local:plan.local,cloud:plan.cloud,cloudUpdatedAt:plan.cloudUpdatedAt},verified:Boolean(meta.verifiedAt),presync:read(PRESYNC,null)?.userId===user?.id&&user?{at:read(PRESYNC).at}:null}),
  setUser(next){
   const changed=(next?.id||null)!==(user?.id||null);user=next||null;
   if(!changed)return;
   generation++;if(timer)cancel(timer);timer=null;running=null;again=false;plan=null;counter=0;retries=0;meta=read(META,{});
   if(!user){set('signed-out');return;}
   set(meta.userId===user.id?'idle':'syncing');engine.syncNow();
  },
  markDirty(quiet=false){counter++;if(!meta.dirty)saveMeta({dirty:true});if(!user||meta.userId!==user.id)return;if(status==='synced'||status==='idle')set('pending');if(!quiet)later(3000);},
  async syncNow(){
   if(!user){set('signed-out');return;}
   if(running){again=true;return running;}
   const ctx=context();
   const task=(async()=>{
    try{await cycle(ctx);}catch(e){
     if(!current(ctx)||e?.code==='stale-account')return;
     const message=e?.message||String(e);
     if(/device not active/i.test(message))set('device');
     else{const offline=!isOnline()||e?.name==='TypeError'||/fetch|network/i.test(message);set(offline?'offline':'error',offline?'':message);retries++;later(Math.min(600000,15000*2**Math.min(retries,5)),ctx);}
    }finally{if(current(ctx)){running=null;if(again){again=false;later(500,ctx);}}}
   })();running=task;return task;
  },
  choose:c=>{const ctx=context();return choose(c,ctx).catch(e=>{if(current(ctx))set('error',e?.message||String(e));});},
  presyncState:()=>user&&read(PRESYNC,null)?.userId===user.id?read(PRESYNC).state:null,
  discardPresync(){if(user&&read(PRESYNC,null)?.userId===user.id)remove(PRESYNC);emit();},
  // Account data stays in its namespace; sign-out must not turn it into guest data.
  forget(){engine.setUser(null);},
  hasUnsynced:()=>Boolean(meta.dirty)&&meta.userId===user?.id,
 };
 return engine;
}
export const emptyLearningState=emptyState;
