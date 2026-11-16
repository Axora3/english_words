// Reads public cloud configuration from .env / .env.local / process.env and produces the browser
// config module. Only the Supabase project URL and the anon/publishable key may reach the browser;
// service_role / secret keys are rejected so they can never be shipped by accident.
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';

function parse(text){const out={};for(const line of text.split(/\r?\n/)){const m=line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(!m)continue;let v=m[2];if(/^(['"]).*\1$/.test(v))v=v.slice(1,-1);else v=v.replace(/\s+#.*$/,'');out[m[1]]=v;}return out;}

/** .env, then .env.local, then real environment variables (highest priority). */
export function readEnv(dir=process.cwd(),env=process.env){
 const merged={};for(const f of ['.env','.env.local']){const p=join(dir,f);if(existsSync(p))Object.assign(merged,parse(readFileSync(p,'utf8')));}
 for(const k of ['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_PUBLISHABLE_KEY'])if(env[k])merged[k]=env[k];
 return merged;
}

function jwtRole(key){const parts=key.split('.');if(parts.length!==3)return null;try{return JSON.parse(Buffer.from(parts[1].replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8')).role??null;}catch{return null;}}

/** Returns {url, anonKey} or throws with a message that never contains the key itself. */
export function publicCloudConfig(env){
 const url=String(env.SUPABASE_URL||'').trim(),key=String(env.SUPABASE_ANON_KEY||env.SUPABASE_PUBLISHABLE_KEY||'').trim();
 if(!url&&!key)return {url:'',anonKey:''};
 if(!url||!key)throw Error('Set both SUPABASE_URL and SUPABASE_ANON_KEY (or neither to build without cloud sync).');
 let parsed;try{parsed=new URL(url);}catch{throw Error('SUPABASE_URL is not a valid URL.');}
 const local=['localhost','127.0.0.1'].includes(parsed.hostname);
 if(parsed.protocol!=='https:'&&!(local&&parsed.protocol==='http:'))throw Error('SUPABASE_URL must use https.');
 if(parsed.pathname!=='/'||parsed.search||parsed.hash)throw Error('SUPABASE_URL must be the project origin only, e.g. https://abcd.supabase.co');
 if(/^sb_secret_/i.test(key))throw Error('Refusing to expose a Supabase secret key in the browser. Use the publishable/anon key.');
 const role=jwtRole(key);
 if(role&&role!=='anon')throw Error(`Refusing to expose a Supabase key with role "${role}" in the browser. Use the anon/publishable key.`);
 if(!role&&!/^sb_publishable_/.test(key))throw Error('SUPABASE_ANON_KEY does not look like a Supabase anon or publishable key.');
 return {url:parsed.origin,anonKey:key};
}

export function configModule(cfg){return `// Generated at build/serve time from environment variables. Public values only.\nexport const cloudConfig=${JSON.stringify(cfg)};\n`;}
