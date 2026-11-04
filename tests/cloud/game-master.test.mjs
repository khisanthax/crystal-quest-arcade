import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accountAPI,gameMasterPage} from '../../worker/accounts.js';
import {LocalD1} from '../../worker/local-db.js';
import {newRun} from '../../dist/runner/model.js';
import {assignHomework,caseState,ensureHomework} from '../../dist/reading/model.js';
import {readingFixture} from '../reading/fixture.mjs';

async function setup(t) {
 const DB = new LocalD1();
 t.after(() => DB.close());
 const env = {DB,CQ_ADMIN_KEY:'maintenance-test-only',CQ_GAME_MASTER_KEY:'strong-owner-test-key-only-1234567890'};
 const owner = {}, child = {}, origin = 'https://arcade.example';
 async function call(action, body, jar = owner, key) {
  const headers = {Origin:origin,Cookie:Object.entries(jar).map(([k,v]) => k+'='+v).join('; ')};
  if (body) headers['Content-Type'] = 'application/json';
  if (action === 'admin') headers['x-cq-admin-key'] = env.CQ_ADMIN_KEY;
  if (key) headers['x-cq-game-master-key'] = key;
  const r = await accountAPI(new Request(origin+'/api/'+action,{method:body ? 'POST' : 'GET',headers,body:body && JSON.stringify(body)}),env);
  for (const cookie of r.headers.getSetCookie()) {
   const [k,v] = cookie.split(';')[0].split('=');
   if (cookie.includes('Max-Age=0')) delete jar[k]; else jar[k] = v;
  }
  return {status:r.status,data:await r.json(),cookies:r.headers.getSetCookie()};
 }
 const a = await call('signup',{username:'owner_test',pin:'5682'});
 const b = await call('signup',{username:'child_test',pin:'5682'},child);
 assert.equal(a.status,200);
 assert.equal(b.status,200);
 assert.equal((await call('admin',{action:'designate-reading-admin',username:'owner_test'})).status,200);
 const gm = (body,jar=owner,key=env.CQ_GAME_MASTER_KEY) => call('game-master',body,jar,key);
 const target = (revision = 0,profile = 'emberia') => ({account:b.data.account.id,profile,revision});
 const change = (value,revision=0,targets=[target(revision)]) => ({action:'mutate',requestId:crypto.randomUUID(),confirmed:true,reason:'Test adjustment',targets,change:value});
 const wallet = async () => (await call('me',null,child)).data.data.profiles.ari.collection?.wallet ?? 0;
 return {env,owner,child,a,b,call,gm,target,change,wallet};
}

test('Game Master requires a designated signed-in owner and a strong unlock; reading admin uses the same elevation',async t => {
 const h = await setup(t);
 const page = jar => gameMasterPage(new Request('https://arcade.example/admin',{headers:{cookie:'cq_session='+jar.cq_session}}),h.env);
 assert.equal(await page({}),false);
 assert.equal(await page(h.child),false);
 assert.equal(await page(h.owner),true);
 assert.equal((await h.gm({action:'list'},h.child)).status,403);
 assert.equal((await h.gm({action:'list'},h.owner,'incorrect')).status,403);
 assert.equal((await h.call('reading-admin',{})).status,403);
 assert.deepEqual((await h.call('reading-access',{})).data,{admin:false,locked:true});
 const unlock = await h.gm({action:'list'});
 assert.equal(unlock.status,200);
 assert.equal(unlock.data.players.length,2);
 assert.equal(unlock.data.catalog.pets.length,60);
 assert.match(unlock.cookies[0],/HttpOnly; SameSite=Strict; Path=\/; Secure; Max-Age=1200/);
 assert.equal((await h.call('reading-admin',{})).status,200);
 assert.equal((await h.call('reading-admin',{},h.child)).status,403);
 await h.call('game-master',{action:'lock'});
 assert.equal((await h.call('reading-admin',{})).status,403);
});

test('Crystal changes are idempotent, revision checked, reversible once, and logged without exposing secrets',async t => {
 const h = await setup(t);
 const award = h.change({type:'wallet',operation:'add',amount:500});
 const replies = await Promise.all([h.gm(award),h.gm(award)]);
 assert.deepEqual(replies.map(x=>x.status),[200,200]);
 assert.equal(replies.filter(x=>x.data.duplicate).length,1);
 assert.equal(await h.wallet(),500);
 assert.equal((await h.gm({...award,change:{...award.change,amount:900}})).status,409);
 assert.equal((await h.gm(h.change({type:'wallet',operation:'remove',amount:501},1))).status,400);
 assert.equal((await h.gm(h.change({type:'wallet',operation:'add',amount:1}))).status,409);
 const log = (await h.gm({action:'audit',account:h.target().account})).data.entries;
 assert.equal(log.length,1);
 assert.deepEqual([log[0].previous.wallet,log[0].updated.wallet],[0,500]);
 const reverse = h.change({type:'wallet',operation:'reverse',auditId:log[0].id},1);
 assert.equal((await h.gm(reverse)).status,200);
 assert.equal(await h.wallet(),0);
 assert.equal((await h.gm(h.change(reverse.change,2))).status,409);
 const detail = (await h.gm({action:'detail',account:h.target().account})).data;
 assert.deepEqual(detail.backups.map(x=>x.revision),[1,0]);
 const backup = (await h.gm({action:'backup'})).data;
 assert.equal(backup.players.length,2);
 assert.doesNotMatch(JSON.stringify(backup),/pin_hash|recovery_hash|cq_session/);
});

test('Atomic reward bundles grant pets and items, reject duplicate ownership, and restore revoked pet XP',async t => {
 const h = await setup(t), both=[h.target(),h.target(0,'luminara')];
 const reward = h.change({type:'reward',crystals:120,pet:'dragon',food:'apple',foodQuantity:2,accessory:'cap'},0,both);
 assert.equal((await h.gm(reward)).status,200);
 const read = async () => (await h.gm({action:'detail',account:h.target().account})).data.data.profiles;
 let profiles = await read();
 for (const key of ['ari','kal']) {
  const c = profiles[key].collection;
  assert.deepEqual([c.wallet,c.pets[0].species,c.equipped,c.food.apple,c.accessories[0]],[120,'dragon','dragon',2,'cap']);
 }
 const ownerTarget = {account:h.a.data.account.id,profile:'emberia',revision:0};
 const failed = await h.gm(h.change(reward.change,1,[ownerTarget,h.target(1)]));
 assert.equal(failed.status,409);
 assert.equal((await h.gm({action:'detail',account:ownerTarget.account})).data.player.revision,0);
 assert.equal(await h.wallet(),120);
 assert.equal((await h.gm(h.change({type:'pet',operation:'xp',item:'dragon',xp:350},1))).status,200);
 assert.equal((await h.gm(h.change({type:'pet',operation:'revoke',item:'dragon'},2))).status,200);
 profiles = await read();
 assert.equal(profiles.ari.collection.equipped,null);
 assert.equal(profiles.kal.collection.equipped,'dragon');
 assert.equal((await h.gm(h.change({type:'pet',operation:'restore',item:'dragon'},3))).status,200);
 assert.equal((await read()).ari.collection.pets[0].xp,350);
 assert.equal((await h.gm(h.change({type:'item',operation:'remove',category:'food',item:'apple',quantity:1},4))).status,200);
 assert.equal((await read()).ari.collection.food.apple,1);
});

test('Account status changes revoke sessions and block login and QR recovery while disabled',async t => {
 const h = await setup(t);
 assert.equal((await h.gm(h.change({type:'account',operation:'disable'}))).status,200);
 assert.equal((await h.call('me',null,h.child)).data.account,null);
 assert.equal((await h.call('login',{username:'child_test',pin:'5682'},h.child)).status,401);
 assert.equal((await h.call('recover',{token:h.b.data.recovery},h.child)).status,401);
 assert.equal((await h.gm(h.change({type:'account',operation:'enable'},1))).status,200);
 assert.equal((await h.gm(h.change({type:'account',operation:'rename',value:'child_updated'},2))).status,200);
 assert.equal((await h.gm(h.change({type:'account',operation:'reset-pin',value:'6492'},3))).status,200);
 assert.equal((await h.call('login',{username:'child_updated',pin:'6492'},h.child)).status,200);
 const rotate = h.change({type:'account',operation:'rotate-recovery'},4);
 const token = (await h.gm(rotate)).data.recovery;
 assert.match(token,/^[a-f0-9]{64}$/);
 assert.equal((await h.gm(rotate)).data.recovery,undefined);
 assert.equal((await h.call('recover',{token:h.b.data.recovery},{})).status,401);
 assert.equal((await h.call('recover',{token},{})).status,200);
 assert.equal((await h.call('recover',{token},{})).status,401);
});

test('Saved packages are versioned and reusable and a server-selected gift records its recipient',async t=>{
 const h=await setup(t);
 const body={action:'package-save',requestId:crypto.randomUUID(),confirmed:true,name:'Synthetic gift',active:true,
  change:{type:'reward',crystals:40,pet:'dragon',accessory:'cap'}};
 const first=await h.gm(body);
 assert.equal(first.status,200,JSON.stringify(first.data));
 const pkg=first.data.package;
 assert.equal((await h.gm(body)).data.duplicate,true);
 assert.equal((await h.gm({action:'packages'})).data.packages.length,1);
 const give=h.change({type:'reward-package',id:pkg.id,version:pkg.version});
 assert.equal((await h.gm(give)).status,200);
 assert.equal(await h.wallet(),40);
 assert.equal((await h.gm(give)).data.duplicate,true);
 const deactivate={...body,id:pkg.id,version:pkg.version,requestId:crypto.randomUUID(),active:false};
 assert.equal((await h.gm(deactivate)).status,200);
 assert.equal((await h.gm(h.change(give.change,1))).status,409);
 const draw=(await h.gm({action:'random-recipient',profile:'emberia',accounts:[h.target().account]})).data;
 assert.equal(draw.target.account,h.target().account);
 const gift={...h.change({type:'reward',crystals:80},1),draw:draw.draw};
 assert.equal((await h.gm({...gift,targets:[h.target(1,'luminara')]})).status,400);
 assert.equal((await h.gm(gift)).status,200);
 assert.equal((await h.gm(gift)).data.duplicate,true);
 assert.equal(await h.wallet(),120);
 const {entries}=(await h.gm({action:'audit'})).data;
 assert.equal(entries.filter(x=>x.action==='package:save').length,2);
 assert.equal(entries.find(x=>x.action==='reward:random').account,draw.target.account);
 assert.equal(entries.find(x=>x.action==='reward-package').updated.package.name,pkg.name);
});

test('Course and mission repair are targeted and a gameplay restore preserves current collections',async t=>{
 const h=await setup(t);
 const data=h.b.data.data, p=data.profiles.ari;
 const run=newRun('ari','earth-science'), other=newRun('ari','earth-science',{theme:'cosmic'});
 p.runs['earth-science']=run;
 p.stageCourses={'earth-science~volcano~0':run,'earth-science~cosmic~0':other};
 p.learning['earth-science']={questions:{},concepts:{}};
 const pack=readingFixture();
 assignHomework(data,'ari',pack);
 const homework=ensureHomework(data,'ari'), state=caseState(homework,pack);
 state.written.q1={selfReported:true,at:new Date().toISOString()};
 state.written.q2={selfReported:true,at:new Date().toISOString()};
 state.visited=['p1'];
 state.completed='2026-01-01T00:00:00Z';
 homework.rewardIds.push('homework:emberia:'+pack.id+':0:mission:q1');
 // Seed the prior save directly as a fixture, never touch a live player's data.
 h.env.DB.db.prepare('UPDATE explorers SET payload=? WHERE id=?').run(JSON.stringify(data),h.target().account);
 assert.equal((await h.gm(h.change({type:'run-reset',courseKey:'earth-science~volcano~0',courseField:'stageCourses'}))).status,200);
 assert.equal((await h.gm(h.change({type:'mission-reset',packId:pack.id,questionId:'q1'},1))).status,200);
 assert.equal((await h.gm(h.change({type:'reward',crystals:80,pet:'dragon'},2))).status,200);
 const load=async()=> (await h.gm({action:'detail',account:h.target().account})).data.data.profiles.ari;
 const repaired=await load();
 assert.equal(repaired.stageCourses['earth-science~volcano~0'],undefined);
 assert.ok(repaired.stageCourses['earth-science~cosmic~0']);
 assert.deepEqual(repaired.learning,p.learning);
 const reading=repaired.homework.cases[pack.id][0];
 assert.equal(reading.written.q1,undefined);
 assert.equal(reading.written.q2.selfReported,true);
 assert.equal(reading.completed,null);
 assert.deepEqual(reading.visited,['p1']);
 assert.deepEqual(repaired.homework.rewardIds,homework.rewardIds);
 assert.equal((await h.gm(h.change({type:'restore',revision:0},3))).status,200);
 const restored=await load();
 assert.ok(restored.stageCourses['earth-science~volcano~0']);
 assert.equal(restored.collection.wallet,80);
 assert.equal(restored.collection.pets[0].species,'dragon');
 assert.equal(restored.homework.cases[pack.id][0].written.q1,undefined);
});

test('Exclusive collectible badges are private, auditable, versioned and safe to grant in bulk',async t=>{
 const h=await setup(t);
 const mint={action:'badge-save',requestId:crypto.randomUUID(),confirmed:true,name:'Star Reader',
  description:'A special reward for excellent detective work.',icon:'star',rarity:'RARE',active:true};
 assert.equal((await h.gm(mint,h.child)).status,403);
 assert.equal((await h.gm({...mint,icon:'https://not-an-icon.example'})).status,400);
 const first=await h.gm(mint);
 assert.equal(first.status,200,JSON.stringify(first.data));
 const badge=first.data.badge;
 assert.equal((await h.gm(mint)).data.duplicate,true);
 assert.deepEqual((await h.gm({action:'badges'})).data.badges,[badge]);
 const owned=(profile,jar=h.child)=>h.call('collectible-badges',{profile},jar);
 assert.equal((await owned('emberia',{})).status,401);
 assert.equal((await owned('ari')).status,400);
 assert.deepEqual((await owned('emberia')).data.badges,[]);
 const ownerTarget={account:h.a.data.account.id,profile:'luminara',revision:0};
 const grant=h.change({type:'badge',id:badge.id,version:badge.version},0,[h.target(),ownerTarget]);
 const replies=await Promise.all([h.gm(grant),h.gm(grant)]);
 assert.deepEqual(replies.map(r=>r.status),[200,200]);
 assert.equal(replies.filter(r=>r.data.duplicate).length,1);
 assert.equal(replies[0].data.revisions[0].revision,0);
 const childBadge=(await owned('emberia')).data.badges[0];
 assert.equal(childBadge.id,badge.id);
 assert.equal(childBadge.rarity,'RARE');
 assert.equal(typeof childBadge.awarded,'number');
 assert.deepEqual((await owned('luminara')).data.badges,[]);
 assert.equal((await owned('luminara',h.owner)).data.badges[0].id,badge.id);
 assert.deepEqual((await owned('emberia',h.owner)).data.badges,[]);
 const rejected=await h.gm(h.change(grant.change,0,[h.target(0,'luminara'),h.target()]));
 assert.equal(rejected.status,409);
 assert.deepEqual((await owned('luminara')).data.badges,[]);
 const edit={...mint,requestId:crypto.randomUUID(),id:badge.id,version:1,name:'Star Detective',active:false};
 assert.equal((await h.gm(edit)).status,200);
 assert.equal((await owned('emberia')).data.badges[0].name,'Star Detective');
 assert.equal((await h.gm(h.change({...grant.change,version:2},0,[h.target(0,'luminara')]))).status,409);
 assert.equal((await h.gm({...edit,requestId:crypto.randomUUID(),active:true})).status,409);
 const backup=(await h.gm({action:'backup',account:h.target().account})).data.players[0];
 assert.equal(backup.badges.emberia[0].name,'Star Detective');
 assert.deepEqual(backup.badges.luminara,[]);
 const history=(await h.gm({action:'audit'})).data.entries;
 assert.equal(history.filter(x=>x.action==='badge').length,2);
 assert.equal(history.filter(x=>x.action==='badge:save').length,2);
});
