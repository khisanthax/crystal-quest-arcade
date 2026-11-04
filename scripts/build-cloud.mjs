import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {extname} from 'node:path';
import {build} from 'esbuild';
await mkdir('dist/cloud',{recursive:true});
await build({entryPoints:['dist/cloud/client.js'],outfile:'dist/cloud/client.bundle.js',bundle:true,format:'esm',platform:'browser',target:'safari16',minify:true,legalComments:'eof'});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.txt':'text/plain'};
async function walk(dir,prefix=''){let out=[];for(const f of await readdir(dir,{withFileTypes:true})){if(f.name.startsWith('.')||f.name==='server')continue;if(f.isDirectory())out.push(...await walk(dir+'/'+f.name,prefix+f.name+'/'));else out.push(prefix+f.name);}return out;}
const assets={};for(const f of await walk('dist'))assets['/'+f]={type:types[extname(f)]||'application/octet-stream',data:(await readFile('dist/'+f)).toString('base64')};await mkdir('.generated',{recursive:true});await writeFile('.generated/assets.js','export default '+JSON.stringify(assets)+';');await mkdir('dist/server',{recursive:true});await build({entryPoints:['worker/index.js'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});await mkdir('dist/.openai',{recursive:true});await writeFile('dist/.openai/hosting.json',await readFile('.openai/hosting.json'));console.log('Cloud Worker built with '+Object.keys(assets).length+' game assets.');
