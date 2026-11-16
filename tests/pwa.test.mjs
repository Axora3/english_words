// PWA: generated service worker behaviour (precache, offline, update lifecycle, cache hygiene),
// manifest/icons validity, build output, and public-config safety.
import test from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';import vm from 'node:vm';
import {shellFiles,contentVersion,renderServiceWorker} from '../tools/app-files.mjs';
import {publicCloudConfig,readEnv,configModule} from '../tools/env.mjs';

const root=new URL('../',import.meta.url),rootPath=decodeURIComponent(root.pathname.replace(/^\/(\w:)/,'$1'));
async function loadSW(mode='production',{offline=true,existingCaches=[],active=false}={}){
 const files=await shellFiles(rootPath),handlers={},stored=new Map(),caches=new Map(existingCaches.map(k=>[k,new Map()]));let skipped=false;
 const cacheFor=name=>{if(!caches.has(name))caches.set(name,new Map());const m=caches.get(name);return {async addAll(urls){for(const u of urls){await readFile(new URL(u.slice(2),root));m.set(new URL(u,'http://localhost/').href,new Response('cached:'+u));}},async put(k,v){m.set(typeof k==='string'?k:k.url,v);}};};
 const self={location:{origin:'http://localhost'},registration:{scope:'http://localhost/',active:active?{}:null},clients:{claim:async()=>{}},skipWaiting:async()=>{skipped=true;},addEventListener:(type,fn)=>handlers[type]=fn};
 const context={self,caches:{open:async n=>cacheFor(n),keys:async()=>[...caches.keys()],delete:async k=>caches.delete(k),match:async(req)=>{const url=typeof req==='string'?new URL(req,'http://localhost/').href:req.url.split('?')[0];for(const m of caches.values())if(m.has(url))return m.get(url);return undefined;}},URL,Response,fetch:async()=>{if(offline)throw new TypeError('offline');return new Response('network',{status:200});}};
 const src=renderServiceWorker(await readFile(new URL('sw.js',root),'utf8'),{version:'test1',mode,files:[...files]});
 vm.runInNewContext(src,context);return {handlers,caches,files,skipped:()=>skipped,self};
}
const event=(extra={})=>{let p;return {e:{waitUntil:x=>p=x,respondWith:x=>p=x,...extra},done:()=>p};};
const req=(path,mode='cors',method='GET',origin='http://localhost')=>({url:origin+path,method,mode,headers:{has:()=>false}});

test('install precaches the whole app shell (code, grammar data, fonts, icons)',async()=>{
 const sw=await loadSW();const ev=event();sw.handlers.install(ev.e);await ev.done();
 const cached=[...sw.caches.get('english-words-shell-test1').keys()].map(u=>new URL(u).pathname);
 for(const f of ['/index.html','/app.js','/grammar-data.js','/words.js','/sync.js','/icons/icon-512.png','/manifest.webmanifest'])assert.ok(cached.includes(f),f);
 assert.equal(sw.skipped(),true,'first install takes control immediately');
});
test('an update installs in the background and waits for the user before activating',async()=>{
 const sw=await loadSW('production',{active:true});const ev=event();sw.handlers.install(ev.e);await ev.done();assert.equal(sw.skipped(),false);
 sw.handlers.message({data:{type:'SKIP_WAITING'}});assert.equal(sw.skipped(),true);
});
test('offline navigation serves the cached app; cross-origin and non-GET requests are never intercepted',async()=>{
 const sw=await loadSW();let ev=event();sw.handlers.install(ev.e);await ev.done();
 ev=event({request:req('/#review','navigate')});sw.handlers.fetch(ev.e);assert.equal(await (await ev.done()).text(),'cached:./index.html');
 ev=event({request:req('/grammar-data.js')});sw.handlers.fetch(ev.e);assert.equal(await (await ev.done()).text(),'cached:./grammar-data.js');
 ev=event({request:req('/rest/v1/learning_states','cors','GET','https://abcd.supabase.co')});sw.handlers.fetch(ev.e);assert.equal(ev.done(),undefined,'Supabase requests go straight to the network, uncached');
 ev=event({request:req('/app.js','cors','POST')});sw.handlers.fetch(ev.e);assert.equal(ev.done(),undefined);
});
test('activation deletes caches from older versions only',async()=>{
 const sw=await loadSW('production',{existingCaches:['english-words-v6','english-words-shell-old','other-app']});const ev=event();sw.handlers.activate(ev.e);await ev.done();
 assert.deepEqual([...sw.caches.keys()].sort(),['other-app']);
});
test('the precache list is generated from real files and covers every shipped module',async()=>{
 const files=await shellFiles(rootPath);for(const f of files)await readFile(new URL(f,root));
 const modules=(await readdir(root)).filter(f=>f.endsWith('.js')&&f!=='sw.js');assert.deepEqual(modules.filter(f=>!files.includes(f)),[]);
 assert.notEqual(await contentVersion(rootPath,files),await contentVersion(rootPath,files,'changed'),'cache version changes with content');
});
test('manifest is installable: standalone, scoped, with 192/512 and maskable PNG icons that exist',async()=>{
 const m=JSON.parse(await readFile(new URL('manifest.webmanifest',root),'utf8'));
 assert.equal(m.name,'English Words');assert.equal(m.short_name,'English Words');assert.equal(m.display,'standalone');assert.ok(m.start_url&&m.scope&&m.theme_color&&m.background_color&&m.description);
 const png=async src=>{const b=await readFile(new URL(src.replace('./',''),root));assert.deepEqual([...b.subarray(1,4)],[80,78,71]);return [b.readUInt32BE(16),b.readUInt32BE(20)];};
 for(const [size,purpose] of [['192x192','any'],['512x512','any'],['512x512','maskable']]){const icon=m.icons.find(i=>i.sizes===size&&i.purpose===purpose&&i.type==='image/png');assert.ok(icon,size+' '+purpose);assert.deepEqual(await png(icon.src),size.split('x').map(Number));}
 assert.deepEqual(await png('./icons/apple-touch-icon.png'),[180,180]);
});
test('public cloud config accepts only the URL and anon/publishable key, never secrets',()=>{
 const jwt=role=>['e30',Buffer.from(JSON.stringify({role,iss:'supabase'})).toString('base64url'),'sig'].join('.');
 assert.deepEqual(publicCloudConfig({}),{url:'',anonKey:''});
 assert.deepEqual(publicCloudConfig({SUPABASE_URL:'https://abcd.supabase.co/',SUPABASE_ANON_KEY:jwt('anon')}),{url:'https://abcd.supabase.co',anonKey:jwt('anon')});
 assert.equal(publicCloudConfig({SUPABASE_URL:'https://abcd.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_x'}).anonKey,'sb_publishable_x');
 assert.throws(()=>publicCloudConfig({SUPABASE_URL:'https://abcd.supabase.co',SUPABASE_ANON_KEY:jwt('service_role')}),e=>/service_role/.test(e.message)&&!e.message.includes(jwt('service_role')));
 assert.throws(()=>publicCloudConfig({SUPABASE_URL:'https://abcd.supabase.co',SUPABASE_ANON_KEY:'sb_secret_abc'}),/secret key/);
 assert.throws(()=>publicCloudConfig({SUPABASE_URL:'http://abcd.supabase.co',SUPABASE_ANON_KEY:jwt('anon')}),/https/);
 assert.throws(()=>publicCloudConfig({SUPABASE_URL:'https://abcd.supabase.co'}),/both/);
 assert.match(configModule({url:'',anonKey:''}),/export const cloudConfig=\{"url":"","anonKey":""\}/);
 assert.equal(typeof readEnv(rootPath,{}),'object');
});
test('index.html declares the manifest, iOS meta, icons and a CSP that only allows Supabase as an external origin',async()=>{
 const html=await readFile(new URL('index.html',root),'utf8');
 for(const s of ['rel="manifest"','apple-touch-icon','apple-mobile-web-app-capable','viewport-fit=cover','theme-color'])assert.ok(html.includes(s),s);
 const csp=html.match(/Content-Security-Policy" content="([^"]+)"/)[1];assert.match(csp,/script-src 'self';/);assert.match(csp,/connect-src 'self' https:\/\/\*\.supabase\.co;/);assert.doesNotMatch(csp,/unsafe-eval/);
});
