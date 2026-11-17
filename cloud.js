// Supabase access layer. Loaded lazily; does nothing when the build has no cloud configuration.
// Uses only the public anon/publishable key; every table is protected by Row Level Security.
// Auth uses the PKCE flow so email links return with ?code=… and never collide with #hash routes.
import {validateProfile,pendingAvatar,clearPendingAvatar} from './profile.js';
let client=null,loading=null,config;

export async function cloudConfig(){
 if(config!==undefined)return config;
 try{const {cloudConfig:c}=await import('./config.js');config=c?.url&&c?.anonKey?c:null;}catch{config=null;}
 return config;
}
function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=true;s.onload=resolve;s.onerror=()=>reject(Object.assign(Error('The cloud client could not be loaded.'),{code:'client-unavailable'}));document.head.append(s);});}

export async function getClient(){
 if(client)return client;
 if(loading)return loading;
 loading=(async()=>{const c=await cloudConfig();if(!c)return null;
  if(!globalThis.supabase?.createClient)await loadScript('./vendor/supabase.js');
  client=globalThis.supabase.createClient(c.url,c.anonKey,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'english-words-auth'}});
  // Remove the one-time auth code from the address bar once the client has consumed it.
  const url=new URL(location.href);if(url.searchParams.has('code')||url.searchParams.has('error_description')){url.searchParams.delete('code');url.searchParams.delete('error');url.searchParams.delete('error_code');url.searchParams.delete('error_description');history.replaceState(null,'',url.pathname+url.search+url.hash);}
  return client;})();
 try{return await loading;}catch(e){loading=null;throw e;}
}

const redirectTo=hash=>location.origin+location.pathname+(hash||'#account');
function check({data,error}){if(error)throw Object.assign(Error(error.message||'Request failed'),{code:error.code||error.status||'error',status:error.status});return data;}
const need=async()=>{const c=await getClient();if(!c)throw Object.assign(Error('Cloud sync is not configured.'),{code:'not-configured'});return c;};
// Bind a learning request to the session it started with. A queued request must never acquire
// the next account's Authorization header after the person switches accounts.
async function learningRequest(expectedUser,query){
 const c=await need(),session=check(await c.auth.getSession()).session;
 if(!session||(expectedUser&&session.user.id!==expectedUser))throw Object.assign(Error('Account changed'),{code:'stale-account'});
 return check(await query(c).setHeader('Authorization','Bearer '+session.access_token));
}

export const auth={
 async session(){const c=await getClient();if(!c)return null;return check(await c.auth.getSession()).session;},
 async onChange(fn){const c=await getClient();if(!c)return ()=>{};const {data}=c.auth.onAuthStateChange((event,session)=>fn(event,session));return ()=>data.subscription.unsubscribe();},
 async signIn(email,password){return check(await (await need()).auth.signInWithPassword({email,password}));},
 async signUp(email,password,profile={}){return check(await (await need()).auth.signUp({email,password,options:{emailRedirectTo:redirectTo('#account'),data:{ew_profile:profile}}}));},
 async resendConfirmation(email){return check(await (await need()).auth.resend({type:'signup',email,options:{emailRedirectTo:redirectTo('#account')}}));},
 async magicLink(email){return check(await (await need()).auth.signInWithOtp({email,options:{emailRedirectTo:redirectTo('#account'),shouldCreateUser:true}}));},
 async resetPassword(email){return check(await (await need()).auth.resetPasswordForEmail(email,{redirectTo:redirectTo('#account')}));},
 async updatePassword(password){return check(await (await need()).auth.updateUser({password}));},
 async signOut(){const c=await getClient();if(c)check(await c.auth.signOut({scope:'local'}));},
 /** Deletes all English Words data; the login is kept if another app in the project uses it. */
 async deleteAccount(expectedUser=null){return learningRequest(expectedUser,c=>c.rpc('ew_delete_my_account'));},
};

export const data={
 async fetchState(expectedUser=null){const r=await learningRequest(expectedUser,c=>c.from('ew_learning_states').select('state,revision,updated_at').maybeSingle());return r?{state:r.state,revision:Number(r.revision),updated_at:r.updated_at}:null;},
 async pushState(state,baseRevision,deviceId=null,expectedUser=null){const r=await learningRequest(expectedUser,c=>c.rpc('ew_push_learning_state',{p_state:state,p_base_revision:baseRevision,p_device_id:deviceId}));return {status:r.status,revision:r.revision===null?null:Number(r.revision),updated_at:r.updated_at};},
 async createBackup(state,reason='manual',label=null,expectedUser=null){const words=Object.keys(state?.learned||{}).length;await learningRequest(expectedUser,c=>c.from('ew_cloud_backups').insert({state,reason,label,words_learned:words}));},
 async listBackups(expectedUser=null){return learningRequest(expectedUser,c=>c.from('ew_cloud_backups').select('id,label,reason,words_learned,created_at').order('created_at',{ascending:false}).limit(30));},
 async getBackup(id,expectedUser=null){return (await learningRequest(expectedUser,c=>c.from('ew_cloud_backups').select('state').eq('id',id).single())).state;},
 async deleteBackup(id){check(await (await need()).from('ew_cloud_backups').delete().eq('id',id));},
 async profile(expectedUser=null){return learningRequest(expectedUser,c=>c.from('ew_profiles').select('display_name,first_name,last_name,nickname,avatar_data,preferred_language,timezone').maybeSingle());},
 async saveProfile(fields,expectedUser=null){const c=await need(),{data:{user}}=await c.auth.getUser();if(!user||expectedUser&&user.id!==expectedUser)throw Object.assign(Error('Account changed. Try again.'),{code:'stale-account'});await learningRequest(expectedUser||user.id,c=>c.from('ew_profiles').upsert({...fields,id:user.id},{onConflict:'id'}));},
 async initializeProfile(user){
  const existing=await data.profile(user?.id),draft=validateProfile(user?.user_metadata?.ew_profile||{});
  const avatar=pendingAvatar(user);
  if(avatar){await data.saveProfile({avatar_data:avatar},user.id);clearPendingAvatar();}
  if(!draft.error&&(!existing?.first_name||!existing?.last_name||!existing?.nickname)){
   const fields=Object.fromEntries(Object.entries(draft.value).filter(([k])=>!existing?.[k]));
   if(!existing?.display_name)fields.display_name=existing?.nickname||draft.value.nickname;
   await data.saveProfile(fields,user.id);return {...existing,...fields,...(avatar?{avatar_data:avatar}:{})};
  }
  return avatar?{...existing,avatar_data:avatar}:existing;
 },
};

/** Community layer: the public profile, the leaderboard and the one-active-device rule.
 *  Levels, XP and coins come back from the database, which derives them from the synced learning
 *  document — this file never sends a number that a player could have edited. */
export const community={
 async challenge(action,args,device,user){return learningRequest(user,c=>c.rpc('ew_challenge',{p_action:action,...args,p_device:device}));},
 /** Publishes this account's progress and returns {handle,level,xp,coins,rank,players,...}. */
 async syncProfile(handle=null,expectedUser=null){return learningRequest(expectedUser,c=>c.rpc('ew_sync_profile',{p_handle:handle}));},
 async leaderboard(limit=50){return check(await (await need()).from('ew_public_stats')
  .select('user_id,handle,level,xp,words_learned,reviews,lessons,coins,updated_at')
  .order('xp',{ascending:false}).order('updated_at',{ascending:true}).limit(limit));},
 async claimDevice(deviceId,label=null,expectedUser=null){return learningRequest(expectedUser,c=>c.rpc('ew_claim_device',{p_device_id:deviceId,p_label:label}));},
 async deviceStatus(deviceId,expectedUser=null){return learningRequest(expectedUser,c=>c.rpc('ew_device_status',{p_device_id:deviceId}));},
};

export const membership={status:user=>learningRequest(user,c=>c.rpc('ew_membership_status')),redeem:(request,user)=>learningRequest(user,c=>c.rpc('ew_redeem_month',{p_request:request}))};
