// Single source of truth for the files that make up the app shell. Used by build.mjs, server.mjs
// (to render sw.js) and the tests, so the service-worker precache list can never drift from reality.
import {readdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';

const NOT_SHIPPED=new Set(['server.mjs','build.mjs','sw.js','config.js']);

/** Relative paths (posix) of every file the browser needs for the offline app shell. */
export async function shellFiles(dir){
 const root=(await readdir(dir)).sort();
 const code=root.filter(f=>(f.endsWith('.js')||f.endsWith('.css'))&&!NOT_SHIPPED.has(f));
 const fonts=(await readdir(join(dir,'assets/fonts'))).filter(f=>f.endsWith('.ttf')).sort().map(f=>'assets/fonts/'+f);
 const icons=(await readdir(join(dir,'icons'))).filter(f=>/\.(png|svg)$/.test(f)).sort().map(f=>'icons/'+f);
 return ['index.html','manifest.webmanifest','icon.svg',...code,...fonts,...icons];
}

/** Short content hash over the shell files; changes whenever any shipped byte changes. */
export async function contentVersion(dir,files,extra=''){
 const h=createHash('sha256');for(const f of files){h.update(f);h.update(await readFile(join(dir,f)));}h.update(extra);return h.digest('hex').slice(0,12);
}

/** Fills the sw.js template placeholders. */
export function renderServiceWorker(template,{version,mode,files}){
 const out=template.replace('const VERSION="dev";',`const VERSION=${JSON.stringify(version)};`).replace('const MODE="dev";',`const MODE=${JSON.stringify(mode)};`).replace('const PRECACHE=[];',`const PRECACHE=${JSON.stringify(files.map(f=>'./'+f))};`);
 if(out===template)throw Error('sw.js template placeholders not found');return out;
}
