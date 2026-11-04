import {build} from 'esbuild';
await build({entryPoints:['dist/cloud/client.js'],outfile:'dist/cloud/client.bundle.js',bundle:true,format:'esm',platform:'browser',target:'safari16',minify:true,legalComments:'eof'});
