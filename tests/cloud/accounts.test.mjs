import {test} from 'node:test';import assert from 'node:assert/strict';
import {LocalD1} from '../../worker/local-db.js';import {accountAPI} from '../../worker/accounts.js';import {adopt,purchase,feed,bankRun} from '../../dist/runner/collection.js';import {newRun} from '../../dist/runner/model.js';
import {queueReward} from '../../dist/runner/rewards.js';import {assignHomework,caseState,ensureHomework,readingReward} from '../../dist/reading/model.js';import {readingFixture} from '../reading/fixture.mjs';
function harness(){const DB=new LocalD1(),env={DB,CQ_ADMIN_KEY:'test-only-maintenance-key',CQ_GAME_MASTER_KEY:'synthetic-owner-key-for-cloud-tests-123'};let serial=0;const jar=()=>({});async function call(path,body,j={},ip='local-test'){const headers={'Origin':'http://local.test','x-preview-ip':ip};if(body)headers['Content-Type']='application/json';if(path==='admin')headers['x-cq-admin-key']=env.CQ_ADMIN_KEY;if(path==='game-master'&&env.CQ_GAME_MASTER_KEY)headers['x-cq-game-master-key']=env.CQ_GAME_MASTER_KEY;if(Object.keys(j).length)headers.Cookie=Object.entries(j).map(([k,v])=>k+'='+v).join('; ');const r=await accountAPI(new Request('http://local.test/api/'+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined}),env);for(const c of r.headers.getSetCookie()){const [k,v]=c.split(';')[0].split('=');if(c.includes('Max-Age=0'))delete j[k];else j[k]=v;}return {status:r.status,data:await r.json(),cookies:r.headers.getSetCookie()};}async function signup(j,name){const r=await call('signup',{username:name||'qa_user'+serial++,pin:'5682'},j);assert.equal(r.status,200,JSON.stringify(r.data));return r.data;}async function elevate(j,username){assert.equal((await call('admin',{action:'designate-reading-admin',username},j)).status,200);assert.equal((await call('game-master',{action:'list'},j)).status,200);}return {DB,env,jar,call,signup,elevate};}

test('guided paper mission credits once and server rejects a reward without evidence or a real worksheet question',async()=>{const h=harness(),j=h.jar(),a=await h.signup(j),d=a.data,p=d.profiles.ari,pack=readingFixture();assignHomework(d,'ari',pack);const hw=ensureHomework(d,'ari'),s=caseState(hw,pack);s.evidence.q1={...pack.questions[0].evidence[0]};s.written.q1={selfReported:true,at:new Date().toISOString()};assert.equal(readingReward(p,hw,pack,s,'mission:q1',2),2);assert.equal(readingReward(p,hw,pack,s,'mission:q1',2),0);await h.elevate(j,a.account.username);assert.equal((await h.call('save',{requestId:'paper-1',revision:0,data:d},j)).status,200);const bad=structuredClone(d),bp=bad.profiles.ari,bh=bp.homework,bs=bh.cases[pack.id][0];bs.written.q2={selfReported:true};readingReward(bp,bh,pack,bs,'mission:q2',2);assert.equal((await h.call('save',{requestId:'paper-invalid',revision:1,data:bad},j)).status,400);assert.equal((await h.call('me',null,j)).data.data.profiles.ari.collection.wallet,2);h.DB.close();});
test('four isolated explorers, hashed PINs, secure sessions, device enrollment and username/PIN switching on one trusted device',async()=>{const h=harness(),users=[];for(let i=0;i<4;i++){const j=h.jar(),a=await h.signup(j);users.push({j,a});assert.ok(!JSON.stringify(a).includes('5682'));}assert.equal((await h.call('signup',{username:'qa_fifth',pin:'5682'},h.jar(),'different-ip')).status,409);for(const {j,a}of users)assert.equal((await h.call('me',null,j)).data.account.id,a.account.id);const row=h.DB.db.prepare('SELECT pin_hash,pin_salt FROM explorers LIMIT 1').get();assert.equal(row.pin_hash.length,64);assert.notEqual(row.pin_hash,'5682');const unknown=await h.call('login',{username:users[0].a.account.username,pin:'5682'},h.jar(),'new-device');assert.equal(unknown.status,401);assert.equal((await h.call('backup',null,h.jar())).status,401);await h.call('logout',{},users[0].j);assert.equal((await h.call('login',{username:users[0].a.account.username,pin:'5682'},users[0].j)).status,200);h.DB.close();});
test('QR recovery rotates exactly once, restores another device, revokes old sessions and supports multiple accounts per trusted iPad',async()=>{const h=harness(),j=h.jar(),a=await h.signup(j,'qa_first');await h.call('logout',{},j);const b=await h.signup(j,'qa_second');await h.call('logout',{},j);assert.equal((await h.call('login',{username:a.account.username,pin:'5682'},j)).status,200);const second=h.jar(),recovered=await h.call('recover',{token:a.recovery},second);assert.equal(recovered.status,200);assert.equal(recovered.data.account.id,a.account.id);assert.notEqual(recovered.data.recovery,a.recovery);assert.equal((await h.call('recover',{token:a.recovery},h.jar(),'third-device')).status,401);assert.equal((await h.call('me',null,j)).data.account,null);assert.equal((await h.call('me',null,second)).data.account.id,a.account.id);await h.call('logout',{},j);assert.equal((await h.call('login',{username:b.account.username,pin:'5682'},j)).status,200);h.DB.close();});
test('atomic wallet transactions, server prices, idempotent saves, refresh-safe rewards and stale-device conflicts',async()=>{const h=harness(),j=h.jar(),a=await h.signup(j),d=a.data,p=d.profiles.ari;adopt(p,'dog',true);const r=newRun('ari','earth-science');r.crystals=100;bankRun(p,r,d.packs[r.packId]);purchase(p,'food','apple');feed(p,'dog','apple');const body={requestId:'first',revision:0,data:d},result=await h.call('save',body,j);assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.revision,1);assert.equal((await h.call('save',body,j)).data.revision,1);let saved=(await h.call('me',null,j)).data;assert.equal(saved.data.profiles.ari.collection.wallet,90);assert.equal(saved.data.profiles.kal.crystals,0);const cheat=structuredClone(d);cheat.profiles.ari.collection.wallet++;assert.equal((await h.call('save',{requestId:'forged',revision:1,data:cheat},j)).status,400);const attempts=await Promise.all(['two','three'].map(requestId=>h.call('save',{requestId,revision:1,data:d},j)));assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);assert.equal(h.DB.db.prepare('SELECT count(*) AS n FROM wallet_transactions').get().n,4);assert.equal(h.DB.db.prepare('SELECT count(*) AS n FROM save_history').get().n,1);h.DB.close();});
test('migration is confirmed, backed by a fresh revision, one time only; sign-in throttles and API is not a GET mutation surface',async()=>{const h=harness(),j=h.jar(),a=await h.signup(j),d=a.data;d.profiles.ari.crystals=127;assert.equal((await h.call('migrate',{requestId:'m1',revision:0,data:d},j)).status,409);assert.equal((await h.call('migrate',{requestId:'m2',revision:0,data:d,confirmed:true},j)).status,200);assert.equal((await h.call('migrate',{requestId:'m3',revision:1,data:d,confirmed:true},j)).status,409);assert.equal((await h.call('passport',null,j)).status,405);let locked=false;for(let i=0;i<8;i++){const r=await h.call('login',{username:a.account.username,pin:'4445'},j,'guessing-ip');if(r.status===429)locked=true;}assert.ok(locked);const backup=await h.call('backup',null,j);assert.equal(backup.status,200);assert.ok(!JSON.stringify(backup.data).includes(a.recovery));assert.ok(!JSON.stringify(backup.data).includes('pin_hash'));h.DB.close();});
test('three-stage cosmetic grants, reading coins and pet XP pass server validation; unearned XP and weak replacement PINs fail',async()=>{const h=harness(),j=h.jar(),a=await h.signup(j),d=a.data,p=d.profiles.ari;adopt(p,'fox',true);for(let stage=0;stage<3;stage++){const r=newRun('ari','earth-science',{},stage+1);r.stage=stage;queueReward(r,'stage',25,50,'stage:'+stage);bankRun(p,r,d.packs[r.packId]);}const pack=readingFixture();assignHomework(d,'ari',pack);const hw=ensureHomework(d,'ari'),s=caseState(hw,pack);s.mainIdeas.p1={initial:true,selected:0,correct:true,attempts:1};readingReward(p,hw,pack,s,'main:p1',2,3);s.evidence.q1={...pack.questions[0].evidence[0],independent:true};readingReward(p,hw,pack,s,'evidence:q1',10,12);await h.elevate(j,a.account.username);let saved=await h.call('save',{requestId:'mixed',revision:0,data:d},j);assert.equal(saved.status,200,JSON.stringify(saved.data));assert.ok(p.collection.accessories.includes('cap'));const cheat=structuredClone(d);cheat.profiles.ari.collection.pets[0].xp+=500;assert.equal((await h.call('save',{requestId:'xp-cheat',revision:1,data:cheat},j)).status,400);assert.equal((await h.call('pin',{pin:'1234'},j)).status,400);assert.equal((await h.call('pin',{pin:'6492'},j)).status,200);await h.call('logout',{},j);assert.equal((await h.call('login',{username:a.account.username,pin:'5682'},j)).status,401);assert.equal((await h.call('login',{username:a.account.username,pin:'6492'},j)).status,200);h.DB.close();});
test('the same case can reward both retained fantasy profiles without transaction-ID collisions',async()=>{const h=harness(),j=h.jar(),a=await h.signup(j),d=a.data,pack=readingFixture();for(const id of ['ari','kal']){assignHomework(d,id,pack);const hw=ensureHomework(d,id),s=caseState(hw,pack);s.evidence.q1={...pack.questions[0].evidence[0],independent:true};readingReward(d.profiles[id],hw,pack,s,'evidence:q1',10,12);}await h.elevate(j,a.account.username);const result=await h.call('save',{requestId:'two-profile-case',revision:0,data:d},j);assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(h.DB.db.prepare('SELECT count(*) AS n FROM wallet_transactions').get().n,2);const saved=(await h.call('me',null,j)).data.data;assert.equal(saved.profiles.ari.collection.wallet,10);assert.equal(saved.profiles.kal.collection.wallet,10);h.DB.close();});
test('previously customized worksheet with a built-in case ID keeps its own title and grading after redaction',async()=>{
 const h=harness(),j=h.jar(),a=await h.signup(j);
 try{
  const {readingFixture}=await import('../reading/fixture.mjs'),pack=readingFixture();pack.title='Existing customized worksheet';pack.paragraphs[0].mainIdea.answer=1;
  assignHomework(a.data,'ari',pack);
  await h.elevate(j,a.account.username);
  assert.equal((await h.call('migrate',{data:a.data,confirmed:true,revision:0,requestId:'legacy-custom'},j)).status,200);
  const me=(await h.call('me',null,j)).data,view=me.data.homeworkPacks[pack.id];assert.equal(view.title,pack.title);assert.equal(view.paragraphs[0].mainIdea.answer,undefined);
  assert.equal((await h.call('reading-check',{id:pack.id,profile:'ari',kind:'main',paragraph:'p1',answer:1},j)).data.correct,true);
  me.data.sound=true;assert.equal((await h.call('save',{data:me.data,revision:me.revision,requestId:'legacy-roundtrip'},j)).status,200);
  const backup=(await h.call('admin',{action:'backup',username:a.account.username},j)).data;assert.equal(backup.data.homeworkPacks[pack.id].paragraphs[0].mainIdea.answer,1);
 }finally{h.DB.close();}
});

test('the server rejects a second ID for the same homework reward proof',async t=>{
 const h=harness(),j=h.jar(),a=await h.signup(j),data=a.data;
 t.after(()=>h.DB.close());
 await h.elevate(j,a.account.username);
 const p=data.profiles.ari,pack=readingFixture();
 assignHomework(data,'ari',pack);
 const homework=ensureHomework(data,'ari'),state=caseState(homework,pack);
 state.evidence.q1={...pack.questions[0].evidence[0],independent:true};
 const paid=readingReward(p,homework,pack,state,'evidence:q1',10);
 assert.equal(paid,10);
 assert.equal((await h.call('save',{requestId:'first-proof',revision:0,data},j)).status,200);
 const copied={...p.economyEvents[0],id:p.economyEvents[0].id+':again'};
 p.economyEvents.push(copied);
 homework.rewardIds.push(copied.id);
 p.crystals+=paid;
 p.collection.wallet+=paid;
 const res=await h.call('save',{requestId:'replayed-proof',revision:1,data},j);
 assert.equal(res.status,400);
 assert.match(res.data.error,/matching saved learning event/);
});

test('new recovery passports expire and pre-migration passports remain usable once',async t=>{
 const h=harness(),j=h.jar(),a=await h.signup(j);
 t.after(()=>h.DB.close());
 const expiry=h.DB.db.prepare('SELECT recovery_expires FROM explorers WHERE id=?').get(a.account.id).recovery_expires;
 assert.ok(expiry>Date.now());
 h.DB.db.prepare('UPDATE explorers SET recovery_expires=? WHERE id=?').run(Date.now()-1000,a.account.id);
 assert.equal((await h.call('recover',{token:a.recovery},h.jar())).status,401);
 h.DB.db.prepare('UPDATE explorers SET recovery_expires=NULL WHERE id=?').run(a.account.id);
 assert.equal((await h.call('recover',{token:a.recovery},h.jar())).status,200);
 assert.equal((await h.call('recover',{token:a.recovery},h.jar())).status,401);
});

test('ordinary cloud saves cannot rewind paid course days or run cursors; resume can still add rewards',async t=>{
 const h=harness(), j=h.jar(), a=await h.signup(j), data=a.data, p=data.profiles.ari;
 t.after(()=>h.DB.close());
 const run=newRun('ari','earth-science',{},76);
 run.sessionId='qa-ledger-rewind';
 const older=structuredClone(run);
 run.crystals=80;
 run.petXP=30;
 queueReward(run,'gate',8,15,'gate:1');
 bankRun(p,run,data.packs[run.packId]);
 p.runs[run.packId]=run;
 const first=await h.call('save',{requestId:'ledger-paid',revision:0,data},j);
 assert.equal(first.status,200,JSON.stringify(first.data));
 const paid=(await h.call('me',null,j)).data.data, paidProfile=paid.profiles.ari;
 const today=Object.keys(paidProfile.rewardBook.days)[0];
 const yesterday=new Date(Date.parse(today+'T00:00:00Z')-86400000).toISOString().slice(0,10);
 const edits=[
  book=>{book.days[today].crystals-=20;book.days[yesterday]={crystals:20,xp:0};},
  book=>{book.days[yesterday]=book.days[today];delete book.days[today];},
  book=>{book.days[today].xp--;},
  book=>{delete book.runs[run.sessionId];},
  book=>{book.runs[run.sessionId].events=[];},
  ...['trackCrystals','trackXP','rawCrystals','rawXP','bonusCrystals','bonusXP'].map(field=>book=>{book.runs[run.sessionId][field]--;}),
 ];
 for(const [i,edit] of edits.entries()){
  const rewind=structuredClone(paid);
  edit(rewind.profiles.ari.rewardBook);
  const reply=await h.call('save',{requestId:'rewind-paid-ledger-'+i,revision:1,data:rewind},j);
  assert.equal(reply.status,409,JSON.stringify(reply.data));
  assert.match(reply.data.error,/course reward history/i);
 }

 // Reopening an older local checkpoint does not rewind the separate paid ledger.
 bankRun(paidProfile,older,paid.packs[run.packId]);
 assert.equal(paidProfile.collection.wallet,88);
 const resumed=paidProfile.runs[run.packId];
 resumed.crystals+=12;
 queueReward(resumed,'gate',8,15,'gate:2');
 bankRun(paidProfile,resumed,paid.packs[run.packId]);
 const advanced=await h.call('save',{requestId:'ledger-resume',revision:1,data:paid},j);
 assert.equal(advanced.status,200,JSON.stringify(advanced.data));
 const me=(await h.call('me',null,j)).data;
 assert.equal(me.revision,2);
 assert.equal(me.data.profiles.ari.collection.wallet,108);
 assert.deepEqual(me.data.profiles.ari.rewardBook.runs[run.sessionId].events,['qa-ledger-rewind:gate:1','qa-ledger-rewind:gate:2']);
});

test('Reading and study administration fail closed without an owner key while learners can continue',async t=>{
 const h=harness(), owner=h.jar(), child=h.jar();
 t.after(()=>h.DB.close());
 const a=await h.signup(owner,'qa_owner_gate'), b=await h.signup(child,'qa_child_gate');
 await h.elevate(owner,a.account.username);
 const pack=readingFixture(), publication={pack,confirmed:true,account:b.account.id,profile:'ari'};
 const published=await h.call('reading-publish',publication,owner);
 assert.equal(published.status,200);
 delete h.env.CQ_GAME_MASTER_KEY;

 // Even a previously elevated owner cannot administer when no key is configured.
 assert.deepEqual((await h.call('reading-access',{},owner)).data,{admin:false,locked:true,setupRequired:true});
 assert.deepEqual((await h.call('reading-access',{},child)).data,{admin:false,locked:false});
 assert.equal((await h.call('game-master',{action:'list'},owner)).status,503);
 assert.equal((await h.call('reading-admin',{},owner)).status,403);
 assert.equal((await h.call('reading-publish',publication,owner)).status,403);
 const changed=structuredClone(a.data);
 changed.packs['earth-science'].title='Unauthorized study edit';
 assert.equal((await h.call('save',{requestId:'locked-study-edit',revision:0,data:changed},owner)).status,403);
 assert.equal((await h.call('migrate',{requestId:'locked-study-migration',revision:0,data:changed,confirmed:true},owner)).status,403);
 const added=structuredClone(a.data);
 assignHomework(added,'ari',pack);
 assert.equal((await h.call('save',{requestId:'locked-homework-save',revision:0,data:added},owner)).status,403);

 const library=await h.call('reading-library',{profile:'ari'},child);
 assert.equal(library.status,200);
 assert.equal(library.data.cases[0].id,published.data.id);
 assert.equal(library.data.cases[0].paragraphs[0].mainIdea.answer,undefined);
 const check=await h.call('reading-check',{id:published.data.id,profile:'ari',kind:'main',paragraph:'p1',answer:0},child);
 assert.equal(check.status,200);
 assert.equal(check.data.correct,true);
 const {readyCases}=await import('../../worker/reading-ready.js');
 const publicPack=readyCases.find(x=>!x.reviewRequired)??readingFixture();
 // The public checkout has no bundled worksheets. Supply an original fixture
 // so anonymous grading exercises the same path in both checkouts.
 if(!readyCases.includes(publicPack)){
  readyCases.push(publicPack);
  t.after(()=>readyCases.splice(readyCases.indexOf(publicPack),1));
 }
 const first=publicPack.paragraphs[0];
 const openCheck=await h.call('reading-check',{id:publicPack.id,profile:'ari',kind:'main',paragraph:first.id,answer:first.mainIdea.answer},{});
 assert.equal(openCheck.status,200);
 assert.equal(openCheck.data.correct,true);

 const ordinary=structuredClone(b.data);
 ordinary.narration=false;
 assert.equal((await h.call('save',{requestId:'normal-player-save',revision:0,data:ordinary},child)).status,200);
 assert.equal((await h.call('me',null,owner)).data.revision,0);
});
