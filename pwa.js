// PWA runtime: service-worker registration with a user-confirmed update flow, the install prompt,
// and platform detection for the installation guide.
let deferredPrompt=null,registration=null,waiting=null,listeners=new Set(),reloading=false;
const emit=()=>listeners.forEach(fn=>fn(pwaState()));

export function isStandalone(){return matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: minimal-ui)').matches||navigator.standalone===true;}
export function platform(){const ua=navigator.userAgent||'',touchMac=/Macintosh/.test(ua)&&navigator.maxTouchPoints>1;
 if(/iPhone|iPad|iPod/.test(ua)||touchMac)return 'ios';if(/Android/.test(ua))return 'android';return 'desktop';}
export function pwaState(){return {installed:isStandalone(),canPrompt:Boolean(deferredPrompt),platform:platform(),updateReady:Boolean(waiting),swSupported:'serviceWorker' in navigator,controlled:Boolean(navigator.serviceWorker?.controller)};}
export function onPwaChange(fn){listeners.add(fn);return ()=>listeners.delete(fn);}

export async function promptInstall(){if(!deferredPrompt)return 'unavailable';const p=deferredPrompt;deferredPrompt=null;emit();await p.prompt();const {outcome}=await p.userChoice;emit();return outcome;}
/** Activates the waiting service worker; the page reloads once it takes control. */
export function applyUpdate(){if(waiting)waiting.postMessage({type:'SKIP_WAITING'});}

export function initPwa(){
 addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;emit();});
 addEventListener('appinstalled',()=>{deferredPrompt=null;emit();});
 matchMedia('(display-mode: standalone)').addEventListener?.('change',emit);
 if(!('serviceWorker' in navigator))return Promise.resolve(null);
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading||!waiting)return;reloading=true;location.reload();});
 const track=worker=>{if(!worker)return;worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller){waiting=worker;emit();}});};
 return navigator.serviceWorker.register('./sw.js').then(reg=>{registration=reg;
  if(reg.waiting&&navigator.serviceWorker.controller){waiting=reg.waiting;emit();}
  track(reg.installing);reg.addEventListener('updatefound',()=>track(reg.installing));
  // Look for a new deployment when the app regains focus (at most every 30 minutes).
  let last=Date.now();document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-last>1800000){last=Date.now();reg.update().catch(()=>{});}});
  return reg;}).catch(()=>null);
}
export const swRegistration=()=>registration;
