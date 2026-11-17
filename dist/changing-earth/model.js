import {QUESTIONS,GROUPS,FOUNDATION,question} from './content.js';
import {presentRecord,answerRecord,emptyRecord} from '../runner/packs.js';
import {collection,addXP} from '../runner/collection.js';

export const DAILY_LIMIT=60;
const namespace=id=>id==='ari'?'emberia':'luminara';
const dayOf=at=>at.slice(0,10);
const integer=(n,max=100000)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
export function ensureEarth(p){return p.changingEarth??={version:1,trials:{},claims:{},learning:{questions:{},concepts:{},mapping:Object.fromEntries(QUESTIONS.map(q=>[q.id,q.concepts]))},sessions:0,active:null};}
function shuffle(a,seed){let n=seed>>>0;return [...a].map(v=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return {v,k:n};}).sort((a,b)=>a.k-b.k).map(x=>x.v);}
function priority(s,q){const r=s.learning.concepts[q.concepts[0]]||emptyRecord();return r.review>0?3:!r.presented?2:1;}
export function reviewQueue(s,seed){
 const groups=GROUPS.map((g,i)=>shuffle(QUESTIONS.filter(q=>q.final&&q.concepts.some(c=>g.units.includes(c))),seed+i).sort((a,b)=>priority(s,b)-priority(s,a))[0].id);
 const extra=shuffle(QUESTIONS.filter(q=>q.final&&!groups.includes(q.id)),seed+99).sort((a,b)=>priority(s,b)-priority(s,a))[0].id;
 return shuffle([...groups,extra],seed+44);
}
export function startEarth(p,seed=Math.floor(Math.random()*4294967295),at=new Date().toISOString()){
 const s=ensureEarth(p);s.sessions++;
 const id=crypto.randomUUID();
 s.active={id,seed,started:at,zone:0,index:0,position:80,phase:'explore',collected:[],trail:0,score:0,crystals:0,queues:FOUNDATION.map((ids,i)=>shuffle(ids,seed+i).sort((a,b)=>priority(s,question(b))-priority(s,question(a)))),final:reviewQueue(s,seed),finalStarted:false};
 return s.active;
}
export function currentIds(r){return r.finalStarted?r.final:r.queues[r.zone];}
export function trialId(r){return r.id+':'+(r.finalStarted?'final':r.zone)+':'+r.index;}
export function currentTrial(p){const s=ensureEarth(p),r=s.active;if(!r)return null;return s.trials[trialId(r)]||null;}
export function beginTask(p,at=new Date().toISOString()){
 const s=ensureEarth(p),r=s.active,key=trialId(r);
 s.trials[key]??={question:currentIds(r)[r.index],run:r.id,at,answers:[]};
 const t=s.trials[key];if(!t.presented){presentRecord(s.learning,question(t.question));t.presented=true;}
 r.phase='challenge';return t;
}
export function solved(t){return !!t?.answers?.length&&t.answers.at(-1).choice===question(t.question)?.answer;}
export function payEarth(p,profile,key,proof,amount,at=new Date().toISOString()){
 const s=ensureEarth(p),day=dayOf(at),id='changing-earth:'+namespace(profile)+':'+day+':'+key;
 if(s.claims[id])return 0;
 const used=Object.values(s.claims).filter(c=>c.day===day).reduce((n,c)=>n+c.amount,0);
 amount=Math.max(0,Math.min(amount,DAILY_LIMIT-used));
 if(!amount)return 0;
 s.claims[id]={day,key,...proof,amount,xp:amount*2};
 p.economyEvents??=[];p.economyEvents.push({id,kind:'earn',source:'changing-earth',amount,key,at});
 collection(p).wallet+=amount;p.crystals+=amount;addXP(p,amount*2);if(s.active)s.active.crystals+=amount;
 return amount;
}
export function answerEarth(p,profile,choice,at=new Date().toISOString()){
 const s=ensureEarth(p),r=s.active,t=currentTrial(p),q=question(t?.question);
 if(!q||r.phase!=='challenge'||solved(t)||!q.choices.some(c=>c.id===choice))return null;
 const attempt=t.answers.length,correct=choice===q.answer;
 t.answers.push({choice,at});answerRecord(s.learning,q,correct,attempt);
 if(correct){r.score+=attempt?5:10;r.phase='feedback';const paid=payEarth(p,profile,'question-'+q.id,{kind:'question',trial:trialId(r)},attempt?1:2,at);return {correct,paid,hint:q.explanation};}
 return {correct,paid:0,hint:q.hint};
}
export function collectEarth(p,profile,gem,at=new Date().toISOString()){
 const r=ensureEarth(p).active;if(!r||r.phase!=='explore'||!integer(gem,7))return 0;
 const id=r.zone+'-'+gem;if(r.collected.includes(id))return 0;
 r.collected.push(id);r.trail++;r.score+=3;
 return payEarth(p,profile,'gem-'+id,{kind:'gem',zone:r.zone,gem},1,at);
}
export function nextTask(p,profile,at=new Date().toISOString()){
 const s=ensureEarth(p),r=s.active;if(r.phase!=='feedback'||!solved(currentTrial(p)))return;
 if(++r.index<currentIds(r).length){beginTask(p,at);return;}
 if(r.zone===4&&!r.finalStarted){r.finalStarted=true;r.index=0;r.phase='final-intro';return;}
 if(r.finalStarted){r.phase='summary';r.completed=at;
  p.rewards??=[];if(!p.rewards.some(x=>x.id==='changing-earth-expedition'))p.rewards.push({id:'changing-earth-expedition',title:'Changing Earth Explorer',date:at,kind:'expedition'});
  const trials=Object.entries(s.trials).filter(([,t])=>t.run===r.id&&solved(t)).map(([id])=>id);
  payEarth(p,profile,'finish',{kind:'finish',run:r.id,trials},5,at);
  return;
 }
 r.phase='zone';
}
export function nextZone(p){const r=ensureEarth(p).active;if(r.phase!=='zone'||r.zone>=4)return;r.zone++;r.index=0;r.position=80;r.phase='explore';}
export function mastery(p){const s=ensureEarth(p);return GROUPS.map(g=>{const records=g.units.map(id=>s.learning.concepts[id]||emptyRecord()),covered=records.filter(r=>r.presented>0).length,needs=records.some(r=>r.review>0),mastered=records.every(r=>r.firstCorrect>0&&!r.review);return {...g,covered,needs,stars:!covered?0:mastered?3:needs?1:2};});}

export function validEarth(s){
 if(s===undefined)return true;
 if(!s||s.version!==1||!s.trials||!s.claims||!s.learning||!integer(s.sessions)||Object.keys(s.trials).length>10000||Object.keys(s.claims).length>10000)return false;
 for(const [id,t]of Object.entries(s.trials))if(id.length>160||!question(t?.question)||typeof t.run!=='string'||typeof t.at!=='string'||!Array.isArray(t.answers)||t.answers.length>200||t.answers.some((a,i)=>!question(t.question).choices.some(c=>c.id===a.choice)||typeof a.at!=='string'||i<t.answers.length-1&&a.choice===question(t.question).answer))return false;
 for(const c of Object.values(s.claims))if(!c||!/^\d{4}-\d{2}-\d{2}$/.test(c.day)||!integer(c.amount,5)||!c.amount||c.xp!==c.amount*2||!['question','gem','finish'].includes(c.kind))return false;
 for(const map of ['questions','concepts']){if(!s.learning[map])return false;for(const r of Object.values(s.learning[map]))if(['presented','firstCorrect','incorrect','laterCorrect','correct','review'].some(k=>!integer(r?.[k])))return false;}
 const r=s.active;if(!r)return true;
 if(typeof r.id!=='string'||!integer(r.zone,4)||!integer(r.index,20)||!['explore','challenge','feedback','zone','final-intro','summary','paused'].includes(r.phase)||!Number.isFinite(r.position)||r.position<0||r.position>3200||!integer(r.score)||!integer(r.trail)||!integer(r.crystals)||!Array.isArray(r.collected)||new Set(r.collected).size!==r.collected.length||r.collected.some(id=>!/^([0-4])-([0-7])$/.test(id))||!Array.isArray(r.queues)||r.queues.length!==5||r.queues.some((ids,i)=>!Array.isArray(ids)||ids.length!==FOUNDATION[i].length||new Set(ids).size!==ids.length||ids.some(id=>!FOUNDATION[i].includes(id)))||!Array.isArray(r.final)||r.final.length!==9||new Set(r.final).size!==9||r.final.some(id=>!question(id)?.final))return false;
 if(r.final.some(id=>!question(id)?.final)||GROUPS.some(g=>!r.final.some(id=>g.units.includes(question(id).concepts[0]))))return false;
 const ids=currentIds(r),t=s.trials[trialId(r)];
 if(r.index>=ids.length&&!['zone','summary'].includes(r.phase))return false;
 if(['challenge','feedback'].includes(r.phase)&&(!t||t.question!==ids[r.index]))return false;
 if(r.phase==='feedback'&&!solved(t))return false;
 return true;
}

// Account saves use this same proof validator; clients cannot mint arbitrary
// credits, replace paid proofs, or reset the daily replay cap by rewinding a run.
export function validateEarthProgress(old,next,profile,fail){
 const a=old.changingEarth,b=next.changingEarth;if(!validEarth(b))fail(400,'Changing Earth progress needs a valid save.');
 if(a&&!b)fail(409,'Changing Earth progress cannot be removed by an ordinary save.');
 if(!b)return {xp:0,coins:0};
 for(const [id,t]of Object.entries(a?.trials||{})){
  const n=b.trials[id];if(!n||t.question!==n.question||t.run!==n.run||t.at!==n.at||JSON.stringify(t.answers)!==JSON.stringify(n.answers.slice(0,t.answers.length)))fail(409,'Changing Earth attempts cannot be rewound.');
 }
 for(const [id,c]of Object.entries(a?.claims||{}))if(JSON.stringify(c)!==JSON.stringify(b.claims[id]))fail(409,'Changing Earth rewards cannot be rewound.');
 const fresh=Object.entries(b.claims).filter(([id])=>!a?.claims[id]),day=new Date().toISOString().slice(0,10),totals={};
 let xp=0,coins=0;
 for(const [id,c]of Object.entries(b.claims)){
  if(id!=='changing-earth:'+namespace(profile)+':'+c.day+':'+c.key)fail(400,'Changing Earth reward belongs to another profile.');
  totals[c.day]=(totals[c.day]||0)+c.amount;if(totals[c.day]>DAILY_LIMIT)fail(400,'Changing Earth daily reward limit exceeded.');
 }
 for(const [id,c]of fresh){
  const event=(next.economyEvents||[]).find(e=>e.id===id);
  const age=(Date.parse(day)-Date.parse(c.day))/86400000;
  if(!Number.isFinite(age)||age<0||!event||typeof event.at!=='string'||event.source!=='changing-earth'||event.key!==c.key||event.amount!==c.amount||dayOf(event.at)!==c.day)fail(400,'Changing Earth reward needs its matching learning transaction.');
  let maximum=0;
  if(c.kind==='question'){
   const t=b.trials[c.trial];if(solved(t)&&c.key==='question-'+t.question)maximum=t.answers.length===1?2:1;
  }else if(c.kind==='gem'&&integer(c.zone,4)&&integer(c.gem,7)&&c.key==='gem-'+c.zone+'-'+c.gem)maximum=1;
  else if(c.kind==='finish'&&c.key==='finish'&&Array.isArray(c.trials)){
   const trials=c.trials.map(id=>b.trials[id]);
   if(trials.every(t=>t?.run===c.run&&solved(t))&&FOUNDATION.flat().every(id=>trials.some(t=>t.question===id))&&new Set(trials.filter(t=>question(t.question).final).map(t=>t.question)).size===9)maximum=5;
  }
  if(!maximum||c.amount>maximum)fail(400,'Changing Earth reward has no completed activity.');
  coins+=c.amount;xp+=c.xp;
 }
 return {coins,xp};
}
