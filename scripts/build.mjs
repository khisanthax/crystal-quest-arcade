import {publicReadingCatalog} from '../worker/reading-admin.js';
import {readdir,readFile,writeFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {VOCAB as ARI} from '../dist/ari/vocabulary.js';
import {VOCAB as KAL,FACTS} from '../dist/kal/science.js';
import {builtins,validatePack} from '../dist/runner/packs.js';
for(const p of builtins())if(validatePack(p).length)throw Error(validatePack(p).join('\n'));
for(const p of ['runner/app.js','runner/model.js','runner/view.js','runner/controls.js','runner/packs.js','runner/parent.js','runner/store.js','runner/worlds.js','runner/world-art.js','runner/collection.js','runner/pet-art.js','runner/shop.js','runner/study-pack.schema.json','vendor/three.module.min.js','vendor/three.core.min.js','classic.html'])await access('dist/'+p);
if(ARI.length!==13||KAL.length!==9||FACTS.length!==11)throw Error('A school question bank is incomplete.');
for(const p of ['index.html','arcade.js','arcade.css','ari/index.html','kal/index.html','shared/physics.js','shared/runtime.js','shared/saves.js','shared/base.css','icon.svg','apple-touch-icon.png','manifest.webmanifest'])await access('dist/'+p);
async function walk(dir,prefix=''){const out=[];for(const item of await readdir(dir,{withFileTypes:true})){if(item.name.startsWith('.')||item.name==='server'||!prefix&&item.name==='admin')continue;if(item.isDirectory())out.push(...await walk(dir+'/'+item.name,prefix+item.name+'/'));else if(item.name!=='sw.js')out.push(prefix+item.name);}return out;}
await writeFile('dist/reading/catalog.js','export const bundledCases='+JSON.stringify(publicReadingCatalog(),null,2)+';\n');
const files=(await walk('dist')).sort(),hash=createHash('sha256');for(const f of files)hash.update(await readFile('dist/'+f));const version=hash.digest('hex').slice(0,12);
await writeFile('dist/sw.js',`const CACHE='science-arcade-${version}';
const FILES=${JSON.stringify(files.map(f=>'./'+f))};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('science-arcade-')||k.startsWith('volcano-quest-'))&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin||['api','admin'].includes(new URL(e.request.url).pathname.split('/')[1]))return;
 if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(async()=>{const url=new URL(e.request.url);if(url.pathname.endsWith('/'))url.pathname+='index.html';return await caches.match(url.href)||await caches.match('./index.html');}));}
 else e.respondWith(caches.open(CACHE).then(async c=>await c.match(e.request)||fetch(e.request)));
});
`);
console.log('Crystal Quest Arcade: one static build, '+files.length+' files, shared runner and original adventures verified. Cache '+version+'.');
