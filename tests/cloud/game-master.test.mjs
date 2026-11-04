import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accountAPI,gameMasterPage} from '../../worker/accounts.js';
import {LocalD1} from '../../worker/local-db.js';
import {history} from '../../dist/runner/store.js';
import {answerRecord,presentRecord} from '../../dist/runner/packs.js';
import {assignLevel} from '../../dist/runner/levels.js';
import {purchase} from '../../dist/runner/collection.js';
import {originalCourse} from '../../dist/runner/original-session.js';
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
  description:'A special reward for excellent detective work.',icon:'star',rarity:'RARE',active:true,reason:'Celebrate reading practice'};
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
 assert.deepEqual(history.filter(x=>x.action==='badge:save').map(x=>x.reason),['Celebrate reading practice','Celebrate reading practice']);
});

test('Pet replacement moves customization and equipped status without changing either wallet',async t=>{
 const h=await setup(t);
 assert.equal((await h.gm(h.change({type:'reward',crystals:40,pet:'dragon',accessory:'cap'}))).status,200);
 assert.equal((await h.gm(h.change({type:'pet',operation:'grant',item:'fox'},1))).status,200);
 const childSave=(await h.call('me',null,h.child)).data;
 const pet=childSave.data.profiles.ari.collection.pets[0];
 pet.name='Sparkler';
 pet.accessories.head='cap';
 assert.equal((await h.call('save',{requestId:'child-customized-pet',revision:2,data:childSave.data},h.child)).status,200);
 assert.equal((await h.gm(h.change({type:'pet',operation:'xp',item:'dragon',xp:430},3))).status,200);
 assert.equal((await h.gm(h.change({type:'pet',operation:'replace',item:'dragon',replacement:'fox'},4))).status,409);
 const replace=h.change({type:'pet',operation:'replace',item:'dragon',replacement:'owl'},4);
 assert.equal((await h.gm(replace)).status,200);
 assert.equal((await h.gm(replace)).data.duplicate,true);
 const profiles=(await h.call('me',null,h.child)).data.data.profiles;
 assert.equal(profiles.ari.collection.wallet,40);
 assert.equal(profiles.kal.crystals,0);
 assert.equal(profiles.ari.collection.equipped,'owl');
 assert.deepEqual(profiles.ari.collection.pets[0],{id:'owl',species:'owl',name:'Sparkler',xp:430,accessories:{head:'cap'}});
 const audit=(await h.gm({action:'audit',account:h.target().account})).data.entries.find(e=>e.action==='pet:replace');
 assert.equal(audit.previous.pet.id,'dragon');
 assert.equal(audit.updated.pet.id,'owl');
 assert.equal(audit.previous.pet.xp,audit.updated.pet.xp);
});

test('A high-score repair clears only the selected stage snapshot or pack/world record',async t=>{
 const h=await setup(t);
 const data=h.b.data.data, p=data.profiles.ari;
 const run=newRun('ari','earth-science',{},77), other=newRun('ari','earth-science',{theme:'cosmic'},78);
 run.score=90; run.distance=200; run.crystals=23; other.score=80;
 const story=originalCourse(p,'ari','earth-science','volcano',0);
 story.ledger.score=300; story.progress.run.score=300;
 p.runs={'earth-science':run};
 p.courses={'earth-science~volcano':run};
 p.stageCourses={'earth-science~volcano~0':run,'earth-science~cosmic~0':other};
 p.levelProgress={'earth-science':{completed:false,dust:0,xpDust:0,worlds:{
  volcano:{stages:1,finishes:0,bestScore:90,stageIds:[0]},cosmic:{stages:1,finishes:0,bestScore:80,stageIds:[0]},
 }}};
 p.learning={'earth-science':{questions:{},concepts:{},latest:'synthetic study history'}};
 p.highScore=350; p.crystals=23;
 h.env.DB.db.prepare('UPDATE explorers SET payload=? WHERE id=?').run(JSON.stringify(data),h.target().account);
 const apply=(change,revision)=>h.gm(h.change({type:'high-score-reset',...change},revision));
 assert.equal((await apply({courseField:'stageCourses',courseKey:'earth-science~volcano~0'},0)).status,200);
 const load=async()=>(await h.gm({action:'detail',account:h.target().account})).data.data.profiles.ari;
 let result=await load();
 assert.equal(result.stageCourses['earth-science~volcano~0'].score,0);
 assert.equal(result.stageCourses['earth-science~volcano~0'].distance,200);
 assert.equal(result.stageCourses['earth-science~volcano~0'].crystals,23);
 assert.equal(result.courses['earth-science~volcano'].score,0);
 assert.equal(result.runs['earth-science'].score,0);
 assert.equal(result.stageCourses['earth-science~cosmic~0'].score,80);
 assert.equal(result.originalCourses['earth-science~volcano~0'].ledger.score,300);
 assert.equal(result.levelProgress['earth-science'].worlds.volcano.bestScore,90);
 assert.equal((await apply({courseField:'originalCourses',courseKey:'earth-science~volcano~0'},1)).status,200);
 assert.equal((await apply({packId:'earth-science',world:'volcano'},2)).status,200);
 result=await load();
 assert.equal(result.originalCourses['earth-science~volcano~0'].ledger.score,0);
 assert.equal(result.originalCourses['earth-science~volcano~0'].progress.run.score,0);
 assert.equal(result.levelProgress['earth-science'].worlds.volcano.bestScore,0);
 assert.equal(result.levelProgress['earth-science'].worlds.cosmic.bestScore,80);
 assert.deepEqual(result.levelProgress['earth-science'].worlds.volcano.stageIds,[0]);
 assert.equal(result.highScore,350);
 assert.equal(result.crystals,23);
 assert.deepEqual(result.learning,p.learning);
});

test('Verified account snapshots guard destructive reset and restore with account isolation and existing sessions',async t=>{
 const h=await setup(t);
 const account=h.target().account, username=h.b.data.account.username;
 const create=(revision,extra={})=>({action:'snapshot-create',requestId:crypto.randomUUID(),confirmed:true,
  reason:'Verified safety backup',account,username,revision,...extra});
 const read=async()=> (await h.call('me',null,h.child)).data;
 const apply=(change,revision)=>h.gm(h.change(change,revision));
 const save=async (revision) => {
  const response=await h.gm(create(revision));
  assert.equal(response.status,200,JSON.stringify(response.data));
  assert.equal(response.data.snapshot.current,true);
  return response.data.snapshot;
 };
 assert.equal((await h.gm(create(0),h.child)).status,403);
 assert.equal((await h.gm(create(0,{username:'mismatch'}))).status,400);
 assert.equal((await apply({type:'reward',crystals:250,pet:'fox'},0)).status,200);
 const current=await read();
 const p=current.data.profiles.ari;
 purchase(p,'food','apple');
 p.learning['earth-science']={questions:{},concepts:{},latest:'saved study progress'};
 assert.equal((await h.call('save',{requestId:'synthetic-food-purchase',revision:1,data:current.data},h.child)).status,200);
 const beforeBadge=await save(2);
 const mint=await h.gm({action:'badge-save',requestId:crypto.randomUUID(),confirmed:true,name:'Reward to recover',
  description:'Synthetic badge for restore testing.',icon:'star',rarity:'RARE',active:true});
 const badge=mint.data.badge;
 assert.equal((await apply({type:'badge',id:badge.id,version:1},2)).status,200);
 assert.equal((await apply({type:'account-reset',username,snapshotId:beforeBadge.id},2)).status,409);
 const prior=await save(2);
 const downloaded=await h.gm({action:'snapshot-download',account,id:prior.id});
 assert.equal(downloaded.status,200);
 assert.equal(downloaded.data.format,'crystal-quest-verified-snapshot-v1');
 assert.deepEqual(Object.keys(downloaded.data.data.profiles),['emberia','luminara']);
 assert.equal(downloaded.data.data.profiles.emberia.collection.wallet,240);
 assert.equal(downloaded.data.badges[0][1],badge.id);
 assert.doesNotMatch(JSON.stringify(downloaded.data),/pin_hash|recovery_hash|cq_session/);
 assert.equal((await h.gm({action:'snapshot-download',account:h.a.data.account.id,id:prior.id})).status,404);

 assert.equal((await apply({type:'wallet',operation:'add',amount:50},2)).status,200);
 assert.equal((await apply({type:'account-reset',username,snapshotId:prior.id},3)).status,409);
 const safetyBody=create(3), safetyRes=await h.gm(safetyBody);
 assert.equal(safetyRes.status,200);
 const safety=safetyRes.data.snapshot;
 assert.equal((await h.gm(safetyBody)).data.duplicate,true);
 const reset=h.change({type:'account-reset',username,snapshotId:safety.id},3);
 assert.equal((await h.gm({...reset,change:{...reset.change,username:'wrong'}})).status,400);
 assert.equal((await h.gm(reset)).status,200);
 assert.equal((await h.gm(reset)).data.duplicate,true);
 const empty=await read();
 assert.equal(empty.account.id,account);
 assert.equal(empty.revision,4);
 assert.equal(empty.data.profiles.ari.crystals,0);
 assert.equal(empty.data.profiles.ari.collection,undefined);
 assert.deepEqual(empty.data.profiles.ari.learning,{});
 assert.equal(empty.data.profiles.ari.economyEvents[0].kind,'purchase');
 assert.deepEqual((await h.call('collectible-badges',{profile:'emberia'},h.child)).data.badges,[]);
 assert.equal((await h.call('save',{requestId:'stale-after-reset',revision:3,data:current.data},h.child)).status,409);

 const clean=await save(4);
 const restore=h.change({type:'snapshot-restore',username,snapshotId:prior.id,safetySnapshotId:clean.id},4);
 assert.equal((await h.gm(restore)).status,200);
 const restored=await read(), restoredProfile=restored.data.profiles.ari;
 assert.equal(restored.account.id,account);
 assert.equal(restored.revision,5);
 assert.equal(restoredProfile.collection.wallet,240);
 assert.equal(restoredProfile.collection.pets[0].species,'fox');
 assert.equal(restoredProfile.learning['earth-science'].latest,'saved study progress');
 assert.equal(restoredProfile.economyEvents[0].kind,'purchase');
 assert.equal((await h.call('collectible-badges',{profile:'emberia'},h.child)).data.badges[0].id,badge.id);
 const oldSnapshots=(await h.gm({action:'snapshots',account})).data.snapshots;
 assert.equal(oldSnapshots.length,4);
 assert.equal(oldSnapshots.some(s=>s.current),false);
 const audit=(await h.gm({action:'audit',account})).data.entries;
 assert.equal(audit.filter(e=>e.action==='account-reset').length,1);
 assert.equal(audit.find(e=>e.action==='snapshot-restore').updated.restoredSnapshotId,prior.id);
});

test('Snapshot integrity failure prevents downloads and account reset',async t=>{
 const h=await setup(t), account=h.target().account, username=h.b.data.account.username;
 const creation=await h.gm({action:'snapshot-create',requestId:crypto.randomUUID(),confirmed:true,reason:'Safety backup',
  account,username,revision:0});
 assert.equal(creation.status,200);
 const id=creation.data.snapshot.id;
 h.env.DB.db.prepare("UPDATE game_master_snapshots SET payload='{}' WHERE id=?").run(id);
 assert.equal((await h.gm({action:'snapshot-download',account,id})).status,409);
 const reset=await h.gm(h.change({type:'account-reset',username,snapshotId:id}));
 assert.equal(reset.status,409);
 assert.equal((await h.call('me',null,h.child)).data.revision,0);
});

test('Game Master reports are isolated, read-only, and contain coverage and homework counts without answer keys',async t=>{
 const h=await setup(t), account=h.target().account, data=h.b.data.data, player=data.profiles.ari;
 assignLevel(data,'ari','patterns-sky',false);
 player.levels.find(level=>level.packId==='patterns-sky').archived=true;
 const pack=data.packs['earth-science'], study=history(data,'ari',pack.id);
 study.sessions=2; study.lastSession='2026-10-01T16:00:00Z';
 const [q1,q2]=pack.questions;
 presentRecord(study,q1); answerRecord(study,q1,true,0);
 presentRecord(study,q2); answerRecord(study,q2,false,0); answerRecord(study,q2,true,1);
 player.journeys={runner:{volcano:{completed:[0,1]}},original:{volcano:{completed:[0]}}};
 player.levelProgress={'earth-science':{completed:false,dust:0,xpDust:0,worlds:{volcano:{stages:2,finishes:0,bestScore:510,stageIds:[0,1]}}}};
 player.lastAdventure={mode:'runner',world:'volcano',stage:1,packId:'earth-science'};

 const readCase=readingFixture();
 assignHomework(data,'ari',readCase);
 const current=caseState(ensureHomework(data,'ari'),readCase);
 current.written.q1={selfReported:true,at:'2026-10-02T16:00:00Z'};
 h.env.DB.db.prepare('UPDATE explorers SET payload=? WHERE id=?').run(JSON.stringify(data),account);
 const publish=await h.call('reading-publish',{confirmed:true,pack:{...readCase,title:'Waiting to start'},account,profile:'ari'});
 assert.equal(publish.status,403);
 await h.gm({action:'list'});
 assert.equal((await h.call('reading-publish',{confirmed:true,pack:{...readCase,title:'Waiting to start'},account,profile:'ari'})).status,200);

 const body={action:'progress-report',account,profile:'emberia'};
 assert.equal((await h.gm(body,h.child)).status,403);
 assert.equal((await h.gm({...body,profile:'ari'})).status,400);
 assert.equal((await h.gm({...body,packId:'missing-test'})).status,404);
 const result=await h.gm(body);
 assert.equal(result.status,200,JSON.stringify(result.data));
 const report=result.data;
 assert.deepEqual([report.coverage.attempted,report.coverage.firstCorrect,report.coverage.accuracy,report.coverage.assessedConcepts,report.coverage.sessions],[2,1,50,2,2]);
 assert.equal(report.coverage.lastSession,Date.parse(study.lastSession));
 assert.equal(report.missed[0].incorrect,1);
 assert.ok(report.missed[0].review>0);
 assert.equal(report.homework.active,readCase.id);
 assert.deepEqual(report.homework.cases[0].missions[0],{id:'q1',number:1,written:true});
 assert.equal(report.homework.cases[0].written,1);
 assert.equal(report.homework.cases[1].title,'Waiting to start');
 assert.equal(report.homework.cases[1].attempts,0);
 const volcano=report.worlds.find(w=>w.id==='volcano');
 assert.deepEqual(volcano.runnerCompleted,[0,1]);
 assert.deepEqual(volcano.originalCompleted,[0]);
 assert.deepEqual(volcano.packStagesCompleted,[0,1]);
 assert.equal(volcano.bestScore,510);
 assert.deepEqual(report.location,player.lastAdventure);
 assert.doesNotMatch(JSON.stringify(report),/"(?:answer|answers|choices|keywordGroups|evidence|explanation|pin_hash|recovery_hash|cq_session)"/);
 const archive=(await h.gm({...body,packId:'patterns-sky'})).data;
 assert.equal(archive.pack.archived,true);
 assert.equal(archive.coverage.accuracy,null);
 const other=(await h.gm({...body,profile:'luminara'})).data;
 assert.equal(other.pack.id,'patterns-sky');
 assert.equal(other.coverage.attempted,0);
 assert.deepEqual(other.homework.cases,[]);
 assert.equal((await h.call('me',null,h.child)).data.revision,0);
 assert.equal((await h.gm({action:'audit',account})).data.entries.length,0);
});

test('Reward packages grant badge and inventory atomically across profiles and reject stale or duplicate badges',async t=>{
 const h=await setup(t);
 const mint={action:'badge-save',requestId:crypto.randomUUID(),confirmed:true,name:'Birthday star',
  description:'An exclusive collectible for a special day.',icon:'star',rarity:'RARE',active:true};
 const badge=(await h.gm(mint)).data.badge;
 const packageBody={action:'package-save',requestId:crypto.randomUUID(),confirmed:true,name:'Birthday gift',active:true,
  change:{type:'reward',crystals:60,pet:'owl',food:'apple',foodQuantity:2,accessory:'cap',badge:badge.id}};
 const invalid=await h.gm({...packageBody,change:{...packageBody.change,badge:'nonexistent-badge'}});
 assert.equal(invalid.status,400);
 const created=await h.gm(packageBody);
 assert.equal(created.status,200,JSON.stringify(created.data));
 const pkg=created.data.package;
 const listing=(await h.gm({action:'packages'})).data;
 assert.equal(listing.packages[0].change.badge,badge.id);
 assert.equal(listing.badges[0].name,'Birthday star');
 const bundle={type:'reward-package',id:pkg.id,version:pkg.version,badgeVersion:badge.version};
 const both=[h.target(),h.target(0,'luminara')];
 const stale=h.change({...bundle,badgeVersion:badge.version+1},0,both);
 assert.equal((await h.gm(stale)).status,409);
 assert.equal(await h.wallet(),0);
 const grant=h.change(bundle,0,both);
 const responses=await Promise.all([h.gm(grant),h.gm(grant)]);
 assert.deepEqual(responses.map(r=>r.status),[200,200]);
 assert.equal(responses.filter(r=>r.data.duplicate).length,1);
 const child=(await h.call('me',null,h.child)).data;
 assert.equal(child.revision,1);
 for (const [key,profile] of [['ari','emberia'],['kal','luminara']]) {
  const c=child.data.profiles[key].collection;
  assert.deepEqual([c.wallet,c.pets[0].id,c.food.apple,c.accessories[0]],[60,'owl',2,'cap']);
  assert.equal((await h.call('collectible-badges',{profile},h.child)).data.badges[0].id,badge.id);
 }
 const ownerTarget={account:h.a.data.account.id,profile:'emberia',revision:0};
 const duplicates=h.change({type:'reward',crystals:90,badge:badge.id,badgeVersion:badge.version},1,[ownerTarget,h.target(1)]);
 assert.equal((await h.gm(duplicates)).status,409);
 assert.equal((await h.call('me',null,h.owner)).data.revision,0);
 assert.deepEqual((await h.call('collectible-badges',{profile:'emberia'},h.owner)).data.badges,[]);
 assert.equal(await h.wallet(),60);

 const retire={...mint,id:badge.id,version:badge.version,requestId:crypto.randomUUID(),active:false};
 assert.equal((await h.gm(retire)).status,200);
 assert.equal((await h.gm(h.change({...bundle,badgeVersion:2},0,[ownerTarget]))).status,409);
 assert.equal((await h.gm({...packageBody,requestId:crypto.randomUUID()})).status,400);
 assert.equal((await h.call('me',null,h.owner)).data.revision,0);
 const history=(await h.gm({action:'audit'})).data.entries.filter(r=>r.action==='reward-package');
 assert.equal(history.length,2);
 assert.ok(history.every(r=>r.updated.badge.id===badge.id && r.updated.wallet===60 && r.updated.package.id===pkg.id));
});
