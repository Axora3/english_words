// English Words service worker (template). build.mjs and server.mjs fill VERSION, MODE and PRECACHE.
// - Same-origin GET requests only. Supabase (cross-origin) traffic and auth tokens are never cached.
// - Production: precached app shell is cache-first; new deployments install in the background and
//   wait until the page asks to activate them ("Update available" prompt).
// - Development: network-first so local edits are visible immediately.
const VERSION="dev";
const MODE="dev";
const PRECACHE=[];
const SHELL=`english-words-shell-${VERSION}`,RUNTIME=`english-words-runtime-${VERSION}`;
const NETWORK_FIRST=['./config.js'];

self.addEventListener('install',event=>{
 event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(PRECACHE)).then(()=>{
  // First install has nothing to replace, so it may take control at once; updates wait for the user.
  if(!self.registration.active)return self.skipWaiting();
 }));
});

self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('english-words-')&&k!==SHELL&&k!==RUNTIME&&k!==WIDGET_CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener('message',event=>{
 if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
 if(event.data?.type==='GET_VERSION')event.ports?.[0]?.postMessage({version:VERSION,mode:MODE});
 // The page owns the learning data (it lives in localStorage), so it sends the finished widget card.
 if(event.data?.type==='WIDGET_DATA')event.waitUntil(saveWidgetPayload(event.data).then(()=>renderWidget()));
});

const scopeURL=path=>new URL(path,self.registration.scope).href;
async function fromNetwork(request,cacheName){
 const response=await fetch(request);
 if(response.ok&&response.type==='basic'&&cacheName){const copy=response.clone();caches.open(cacheName).then(cache=>cache.put(request,copy)).catch(()=>{});}
 return response;
}
async function networkFirst(request,cacheName){
 try{return await fromNetwork(request,cacheName);}catch{const cached=await caches.match(request,{ignoreSearch:true});if(cached)return cached;throw Error('offline');}
}
async function cacheFirst(request){
 const cached=await caches.match(request,{ignoreSearch:true});if(cached)return cached;return fromNetwork(request,RUNTIME);
}
async function navigation(request){
 const shell=scopeURL('./index.html');
 if(MODE==='production'){const cached=await caches.match(shell);if(cached){fromNetwork(request).catch(()=>{});return cached;}}
 try{return await fromNetwork(request,null);}catch{return (await caches.match(shell))||(await caches.match('./index.html'))||new Response('<!doctype html><meta charset="utf-8"><title>Offline</title><p>English Words is offline and has not been cached yet. Connect once to install it.</p>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});}
}

self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(request.headers.has('authorization'))return;
 if(request.mode==='navigate'){event.respondWith(navigation(request));return;}
 const path='./'+url.pathname.slice(new URL(self.registration.scope).pathname.length);
 if(MODE!=='production'||NETWORK_FIRST.includes(path)){event.respondWith(networkFirst(request,RUNTIME).catch(()=>Response.error()));return;}
 event.respondWith(cacheFirst(request).catch(()=>Response.error()));
});


/* ---------------- Windows 11 Widgets Board (Microsoft Edge PWA widgets) ----------------
   The board renders an Adaptive Card. The page posts the finished card here (WIDGET_DATA); it is
   kept in its own cache so the widget can still be drawn when the app is not running. Before the
   app has ever run, the files named by the manifest are used instead. */
const WIDGET_TAG='english-words-daily',WIDGET_CACHE='english-words-widget',WIDGET_KEY='./widget-payload.json';
async function saveWidgetPayload(payload){
 const cache=await caches.open(WIDGET_CACHE);
 await cache.put(WIDGET_KEY,new Response(JSON.stringify({template:payload.template,data:payload.data}),{headers:{'Content-Type':'application/json'}}));
}
async function widgetPayload(definition){
 const cache=await caches.open(WIDGET_CACHE),stored=await cache.match(WIDGET_KEY);
 if(stored)return stored.json();
 if(!definition?.msAcTemplate||!definition?.data)return null;
 const [template,data]=await Promise.all([fetch(definition.msAcTemplate).then(r=>r.text()),fetch(definition.data).then(r=>r.text())]);
 return {template,data};
}
async function renderWidget(widget){
 if(!self.widgets)return;
 const found=widget||await self.widgets.getByTag(WIDGET_TAG).catch(()=>null);
 if(!found)return;
 const payload=await widgetPayload(found.definition);
 if(payload)await self.widgets.updateByTag(found.definition?.tag||WIDGET_TAG,payload);
}
self.addEventListener('widgetinstall',event=>event.waitUntil(renderWidget(event.widget)));
self.addEventListener('widgetresume',event=>event.waitUntil(renderWidget(event.widget)));
self.addEventListener('periodicsync',event=>{if(event.tag===WIDGET_TAG)event.waitUntil(renderWidget());});
self.addEventListener('widgetclick',event=>{
 const route=event.action==='open-review'?'#review':'#learn';
 event.waitUntil(openApp(scopeURL('./')+route));
});

async function openApp(url){
 const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 const client=clients.find(c=>new URL(c.url).origin===self.location.origin);
 if(client){await client.navigate(url).catch(()=>{});return client.focus();}
 return self.clients.openWindow(url);
}

self.addEventListener('notificationclick',e=>{e.notification.close();const url=new URL(e.notification.data?.url||'./',self.registration.scope).href;e.waitUntil(openApp(url));});
