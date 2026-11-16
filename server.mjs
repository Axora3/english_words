// Local development server (127.0.0.1 only). Serves the source tree plus three generated resources:
// /config.js (public cloud config from .env.local), /sw.js (service worker with precache list) and
// /vendor/supabase.js (the pinned official client from node_modules).
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,join} from 'node:path';
import {readEnv,publicCloudConfig,configModule} from './tools/env.mjs';
import {shellFiles,contentVersion,renderServiceWorker} from './tools/app-files.mjs';
const root=process.cwd(),port=Number(process.env.PORT||5173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.json':'application/json; charset=utf-8','.ttf':'font/ttf','.png':'image/png','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8'};
const headers=type=>({'Content-Type':type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
const VENDOR=join(root,'node_modules/@supabase/supabase-js/dist/umd/supabase.js');
function config(){try{return configModule(publicCloudConfig(readEnv(root)));}catch(error){console.warn('Cloud sync disabled:',error.message);return configModule({url:'',anonKey:''});}}
async function serviceWorker(){const files=await shellFiles(root),extra=config();return renderServiceWorker(await readFile(join(root,'sw.js'),'utf8'),{version:'dev-'+await contentVersion(root,files,extra),mode:'dev',files:[...files,'config.js','vendor/supabase.js']});}
http.createServer(async(req,res)=>{try{
 const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(path==='/config.js'){res.writeHead(200,headers(types['.js'])).end(config());return;}
 if(path==='/sw.js'){res.writeHead(200,headers(types['.js'])).end(await serviceWorker());return;}
 if(path==='/vendor/supabase.js'){res.writeHead(200,headers(types['.js'])).end(await readFile(VENDOR));return;}
 const file=resolve(root,'.'+(path==='/'?'/index.html':path));
 if(!file.startsWith(root+'\\')&&!file.startsWith(root+'/')||/[\\/](node_modules|\.git|supabase|tests)([\\/]|$)|[\\/]\.env/.test(file.slice(root.length))){res.writeHead(403).end();return;}
 const data=await readFile(file);res.writeHead(200,headers(types[extname(file)]||'application/octet-stream'));res.end(data);
}catch{res.writeHead(404).end('Not found');}}).listen(port,'127.0.0.1',()=>console.log(`English Words is ready at http://localhost:${port}`));
