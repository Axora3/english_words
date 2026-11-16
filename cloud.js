// Supabase access layer. Loaded lazily; does nothing when the build has no cloud configuration.
// Uses only the public anon/publishable key; every table is protected by Row Level Security.
// Auth uses the PKCE flow so email links return with ?code=… and never collide with #hash routes.
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
function check({data,error}){if(error)throw Object.assign(Error(error.message||'Request failed'),{code:error.code||error.status||'error'});return data;}
const need=async()=>{const c=await getClient();if(!c)throw Object.assign(Error('Cloud sync is not configured.'),{code:'not-configured'});return c;};

export const auth={
 async session(){const c=await getClient();if(!c)return null;return check(await c.auth.getSession()).session;},
 async onChange(fn){const c=await getClient();if(!c)return ()=>{};const {data}=c.auth.onAuthStateChange((event,session)=>fn(event,session));return ()=>data.subscription.unsubscribe();},
 async signIn(email,password){return check(await (await need()).auth.signInWithPassword({email,password}));},
 async signUp(email,password){return check(await (await need()).auth.signUp({email,password,options:{emailRedirectTo:redirectTo('#account')}}));},
 async magicLink(email){return check(await (await need()).auth.signInWithOtp({email,options:{emailRedirectTo:redirectTo('#account'),shouldCreateUser:true}}));},
 async resetPassword(email){return check(await (await need()).auth.resetPasswordForEmail(email,{redirectTo:redirectTo('#account')}));},
 async updatePassword(password){return check(await (await need()).auth.updateUser({password}));},
 async signOut(){const c=await getClient();if(c)check(await c.auth.signOut({scope:'local'}));},
 /** Deletes all English Words data; the login is kept if another app in the project uses it. */
 async deleteAccount(){return check(await (await need()).rpc('ew_delete_my_account'));},
};

export const data={
 async fetchState(){const r=check(await (await need()).from('ew_learning_states').select('state,revision,updated_at').maybeSingle());return r?{state:r.state,revision:Number(r.revision),updated_at:r.updated_at}:null;},
 async pushState(state,baseRevision,deviceId=null){const r=check(await (await need()).rpc('ew_push_learning_state',{p_state:state,p_base_revision:baseRevision,p_device_id:deviceId}));return {status:r.status,revision:r.revision===null?null:Number(r.revision),updated_at:r.updated_at};},
 async createBackup(state,reason='manual',label=null){const words=Object.keys(state?.learned||{}).length;check(await (await need()).from('ew_cloud_backups').insert({state,reason,label,words_learned:words}));},
 async listBackups(){return check(await (await need()).from('ew_cloud_backups').select('id,label,reason,words_learned,created_at').order('created_at',{ascending:false}).limit(30));},
 async getBackup(id){return check(await (await need()).from('ew_cloud_backups').select('state').eq('id',id).single()).state;},
 async deleteBackup(id){check(await (await need()).from('ew_cloud_backups').delete().eq('id',id));},
 async profile(){return check(await (await need()).from('ew_profiles').select('display_name,preferred_language,timezone').maybeSingle());},
 async saveProfile(fields){const c=await need(),{data:{user}}=await c.auth.getUser();check(await c.from('ew_profiles').upsert({id:user.id,...fields},{onConflict:'id'}));},
};
