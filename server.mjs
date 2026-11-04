import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {accountAPI,gameMasterPage} from './worker/accounts.js';
import {randomBytes} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {localDatabase} from './worker/local-db.js';
const DB=localDatabase(),keyPath='.local/maintenance-key';if(!existsSync(keyPath))writeFileSync(keyPath,randomBytes(32).toString('hex'),{mode:0o600});const env={DB,CQ_GAME_MASTER_KEY:process.env.CQ_GAME_MASTER_KEY,CQ_ADMIN_KEY:process.env.CQ_ADMIN_KEY||readFileSync(keyPath,'utf8')};const root=resolve('dist');
const types={'.png':'image/png','.json':'application/json','.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
http.createServer(async(req,res)=>{try{if(req.url.startsWith('/api/')){let body='';for await(const chunk of req){body+=chunk;if(body.length>6000000){res.writeHead(413);res.end();return;}}const request=new Request('http://'+req.headers.host+req.url,{method:req.method,headers:{...req.headers,'x-preview-ip':req.socket.remoteAddress||'local'},body:['GET','HEAD'].includes(req.method)?undefined:body});const result=await accountAPI(request,env);for(const [k,v]of result.headers)if(k!=='set-cookie')res.setHeader(k,v);const cookies=result.headers.getSetCookie();if(cookies.length)res.setHeader('set-cookie',cookies);res.statusCode=result.status;res.end(await result.text());return;}const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
if(name.split(/[\\/]/).some(part=>part.toLowerCase()==='server'||part.startsWith('.')))throw Error();
const relative=name.toLowerCase()==='/admin'?'/admin/index.html':name.endsWith('/')?name+'index.html':name;
const path=resolve(root,'.'+relative);
if(!path.startsWith(root+sep))throw Error();
const adminPage=path.slice(root.length+1).split(sep)[0].replace(/[ .]+$/g,'').toLowerCase()==='admin';
if(adminPage&&!await gameMasterPage(new Request('http://'+req.headers.host+req.url,{headers:req.headers}),env)){
 res.writeHead(403,{'Cache-Control':'no-store'});res.end('Sign in to the designated administrator Explorer first.');return;
}
const data=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':adminPage?'no-store':'no-cache'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}}).listen(Number(process.env.PORT||4175),'0.0.0.0',()=>console.log('Crystal Quest Arcade: http://localhost:4175 (on iPad use this computer’s LAN address, port 4175)'));
