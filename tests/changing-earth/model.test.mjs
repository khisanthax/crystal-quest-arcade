import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshData,validateBackup,exportBackup,importBackup} from '../../dist/runner/store.js';
import {QUESTIONS,VOCABULARY,FOUNDATION,GROUPS,question} from '../../dist/changing-earth/content.js';
import {startEarth,ensureEarth,beginTask,currentTrial,answerEarth,nextTask,nextZone,mastery,reviewQueue,validEarth,collectEarth,validateEarthProgress} from '../../dist/changing-earth/model.js';
import {adopt,collection} from '../../dist/runner/collection.js';
import {validateEconomy,accountAPI} from '../../worker/accounts.js';
import {LocalD1} from '../../worker/local-db.js';
const data=()=>{const d=freshData();for(const p of Object.values(d.profiles))collection(p);return d;};
const solve=(p,id='ari')=>{const q=question(currentTrial(p).question);assert.equal(answerEarth(p,id,q.answer).correct,true);nextTask(p,id);};
test('Changing Earth retains the exact five review definitions and assesses all fifteen review ideas with eight interaction types',()=>{
 assert.deepEqual(VOCABULARY.map(v=>v.definition),["Molten rock below Earth's surface.","Magma that has reached Earth's surface.",'Rock formed when magma or lava cools and hardens.','Rock formed from sediments that build up and become rock.','Rock changed by heat and pressure.']);
 assert.equal(new Set(QUESTIONS.map(q=>q.type)).size,8);
 assert.equal(new Set(QUESTIONS.map(q=>q.id)).size,QUESTIONS.length);
 assert.equal(new Set(GROUPS.flatMap(g=>g.units)).size,15);
 for(const q of QUESTIONS){assert.equal(q.choices.filter(c=>c.id===q.answer).length,1);assert.equal(new Set(q.choices.map(c=>c.label)).size,q.choices.length);assert.ok(q.hint.length<200);}
 assert.ok(FOUNDATION.flat().length>=25);
});
test('five zones and nine varied final tasks complete, save validly at every transition, and never change the other profile',()=>{
 const d=data(),before=structuredClone(d),p=d.profiles.ari;adopt(p,'dog',true);startEarth(p,174);
 const checked=new Set();let guard=0;
 while(p.changingEarth.active.phase!=='summary'&&guard++<150){const r=p.changingEarth.active;switch(r.phase){case 'explore':collectEarth(p,'ari',0);beginTask(p);break;case 'challenge':checked.add(question(currentTrial(p).question).type);solve(p);break;case 'zone':nextZone(p);break;case 'final-intro':beginTask(p);break;default:throw Error(r.phase);}assert.equal(validEarth(p.changingEarth),true);assert.equal(validateBackup(d),true);}
 assert.ok(guard<150);assert.equal(checked.size,8);assert.equal(p.changingEarth.active.phase,'summary');assert.ok(p.collection.wallet>0&&p.collection.wallet<=60);assert.ok(p.collection.pets[0].xp>0);assert.deepEqual(d.profiles.kal,before.profiles.kal);assert.ok(mastery(p).every(g=>g.stars===3));assert.equal(validateEconomy(before,d).filter(t=>t.event.kind==='earn').reduce((n,t)=>n+t.event.amount,0),p.collection.wallet);
 const restored=importBackup(exportBackup(d));assert.deepEqual(restored.profiles.ari.changingEarth,p.changingEarth);assert.deepEqual(restored.profiles.ari.collection,p.collection);
 assert.equal(p.rewards.filter(r=>r.id==='changing-earth-expedition').length,1);
});
test('wrong answers teach, retries are recorded separately, and replay favors missed ideas without manufacturing mastery',()=>{
 const d=data(),p=d.profiles.ari;startEarth(p,55);beginTask(p);const t=currentTrial(p),q=question(t.question),unit=q.concepts[0],wrong=q.choices.find(c=>c.id!==q.answer).id;
 assert.equal(answerEarth(p,'ari',wrong).correct,false);assert.equal(answerEarth(p,'ari',q.answer).correct,true);
 const s=p.changingEarth;assert.equal(s.learning.concepts[unit].firstCorrect,0);assert.equal(s.learning.concepts[unit].laterCorrect,1);assert.equal(s.learning.concepts[unit].incorrect,1);assert.ok(mastery(p).find(g=>g.units.includes(unit)).stars<3);
 assert.equal(s.active.score,5);
 const r=startEarth(p,987);assert.equal(question(r.queues[0][0]).concepts[0],unit);
 const selections=new Set(Array.from({length:12},(_,seed)=>reviewQueue(s,seed).join(',')));assert.ok(selections.size>3);
 for(let seed=0;seed<20;seed++){const final=reviewQueue(s,seed);assert.equal(new Set(final).size,9);for(const g of GROUPS)assert.ok(final.some(id=>g.units.includes(question(id).concepts[0])));}
});
test('repeat/reload cannot pay the same activity twice, daily cap is shared across runs, and reward proofs cannot be rewound or forged',()=>{
 const before=data(),d=structuredClone(before),p=d.profiles.ari;startEarth(p,4);collectEarth(p,'ari',0);beginTask(p);const q=question(currentTrial(p).question);answerEarth(p,'ari',q.answer);
 assert.doesNotThrow(()=>validateEconomy(before,d));const paid=structuredClone(d),wallet=p.collection.wallet;
 assert.equal(answerEarth(p,'ari',q.answer),null);assert.equal(p.collection.wallet,wallet);
 startEarth(p,4);collectEarth(p,'ari',0);beginTask(p);answerEarth(p,'ari',q.answer);assert.equal(p.collection.wallet,wallet);assert.doesNotThrow(()=>validateEconomy(paid,d));
 for(const edit of [x=>{x.profiles.ari.changingEarth.claims={};},x=>{x.profiles.ari.collection.wallet++;},x=>{Object.values(x.profiles.ari.changingEarth.claims)[0].amount++;},x=>{Object.values(x.profiles.ari.changingEarth.trials)[0].answers=[];}]){const bad=structuredClone(paid);edit(bad);assert.throws(()=>validateEconomy(paid,bad));}
 const other=structuredClone(before);other.profiles.kal.changingEarth=structuredClone(paid.profiles.ari.changingEarth);assert.throws(()=>validateEconomy(before,other));
});
test('offline yesterday rewards can sync, while future-dated reward proofs are rejected',()=>{
 const before=data(),d=structuredClone(before),p=d.profiles.ari,yesterday=new Date(Date.now()-86400000).toISOString();startEarth(p,5,yesterday);collectEarth(p,'ari',0,yesterday);assert.doesNotThrow(()=>validateEconomy(before,d));
 const future=data(),f=future.profiles.ari;startEarth(f,5);collectEarth(f,'ari',0,new Date(Date.now()+86400000).toISOString());assert.throws(()=>validateEconomy(before,future));
});
test('Changing Earth cloud rewards, independent saves, and remembered account data survive actual save API round trips',async t=>{
 const DB=new LocalD1();t.after(()=>DB.close());const env={DB},cookies={};
 async function call(path,body){const headers={Origin:'http://earth.test','Content-Type':'application/json',Cookie:Object.entries(cookies).map(([k,v])=>k+'='+v).join('; ')};const response=await accountAPI(new Request('http://earth.test/api/'+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined}),env);for(const cookie of response.headers.getSetCookie()){const [k,v]=cookie.split(';')[0].split('=');cookies[k]=v;}return {status:response.status,data:await response.json()};}
 const signup=await call('signup',{username:'qa_changing_earth',pin:'5682'});assert.equal(signup.status,200);const d=signup.data.data,p=d.profiles.ari;adopt(p,'dog',true);startEarth(p,99);collectEarth(p,'ari',0);beginTask(p);answerEarth(p,'ari',question(currentTrial(p).question).answer);
 const request={data:d,revision:0,requestId:'changing-earth-cloud'};const save=await call('save',request);assert.equal(save.status,200,JSON.stringify(save.data));assert.equal((await call('save',request)).data.revision,1);
 const saved=(await call('me')).data;assert.equal(saved.data.profiles.ari.collection.wallet,p.collection.wallet);assert.equal(saved.data.profiles.kal.crystals,0);assert.deepEqual(saved.data.profiles.ari.changingEarth,p.changingEarth);assert.equal(saved.data.profiles.ari.collection.pets[0].species,'dog');
 const forged=structuredClone(saved.data);forged.profiles.ari.collection.wallet+=100;assert.equal((await call('save',{data:forged,revision:1,requestId:'forged'})).status,400);assert.equal((await call('me')).data.revision,1);
});
