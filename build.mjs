// Production build: a clean static site in dist/ (deploy target for Vercel or any static host).
// Generates config.js from environment variables, vendors the pinned Supabase client and renders the
// service worker with a content-hashed cache version.
import {mkdir,copyFile,writeFile,cp,rm,readFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {emptyState} from './core.js';
import {buildWidgetScript} from './widget-export.js';
import {readEnv,publicCloudConfig,configModule} from './tools/env.mjs';
import {shellFiles,contentVersion,renderServiceWorker} from './tools/app-files.mjs';

const root=process.cwd();
const cloud=publicCloudConfig(readEnv(root)); // throws on a missing half or a secret key
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
const files=await shellFiles(root);
for(const file of files){await mkdir(dirname('dist/'+file),{recursive:true});await copyFile(file,'dist/'+file);}
await cp('assets/fonts','dist/assets/fonts',{recursive:true});
await writeFile('dist/config.js',configModule(cloud),'utf8');
await mkdir('dist/vendor',{recursive:true});
await copyFile('node_modules/@supabase/supabase-js/dist/umd/supabase.js','dist/vendor/supabase.js');
await copyFile('node_modules/@supabase/supabase-js/LICENSE','dist/vendor/supabase-js.LICENSE');
const precache=[...files,'config.js','vendor/supabase.js'];
const version=await contentVersion('dist',precache);
await writeFile('dist/sw.js',renderServiceWorker(await readFile('sw.js','utf8'),{version,mode:'production',files:precache}),'utf8');
await mkdir('widgets',{recursive:true});await mkdir('dist/widgets',{recursive:true});
const widgetScript=buildWidgetScript(emptyState());
await writeFile('widgets/English Words.js',widgetScript,'utf8');
await writeFile('dist/widgets/English Words.js',widgetScript,'utf8');
console.log(`Built dist/ (${precache.length} precached files, cache ${version}, cloud sync ${cloud.url?'configured for '+cloud.url:'not configured'}).`);
