import draft from './reading-draft.js';
import {readyCases} from './reading-ready.js';
export const isBundledReadingPack=(id,p)=>readyCases.some(x=>!x.reviewRequired&&x.id===id&&JSON.stringify(x)===JSON.stringify(p));
import {validateHomework,claimEvidence,checkActivity} from '../dist/reading/model.js';
import {missionKeywords} from '../dist/reading/workflow.js';

export async function isReadingAdmin(db,id){return !!await db.prepare('SELECT 1 FROM reading_admin WHERE slot=1 AND account_id=?').bind(id).first();}
function learnerCopy(p){
 return {schemaVersion:1,id:p.id,title:p.title,published:true,paragraphs:p.paragraphs.map(a=>({id:a.id,text:a.text,page:a.page,illustration:a.illustration,mainIdea:{prompt:a.mainIdea.prompt,choices:a.mainIdea.choices}})),questions:p.questions.map(q=>({id:q.id,text:q.text,worksheet:q.worksheet&&{type:q.worksheet.type,choices:q.worksheet.choices},reflection:q.reflection&&{prompt:q.reflection.prompt,choices:q.reflection.choices}}))};
}
export async function readingAction(path,body,{db,a,fail,response}){
 const admin=a?await isReadingAdmin(db,a.id):false;
 if(path==='/api/reading-access')return response({admin});
 if(path==='/api/reading-library'){
  if(!['ari','kal'].includes(body.profile))fail(400,'Choose a player.');
  const rows=(await db.prepare('SELECT payload FROM reading_publications WHERE account_id=? AND profile=? ORDER BY published DESC').bind(a.id,body.profile).all()).results;
  return response({cases:rows.map(r=>learnerCopy(JSON.parse(r.payload)))});
 }
 if(path==='/api/reading-check'){
  if(typeof body.id!=='string'||!['ari','kal'].includes(body.profile))fail(400,'Choose a worksheet and player.');
  const builtin=readyCases.find(p=>p.id===body.id);const row=!builtin&&a?await db.prepare('SELECT payload FROM reading_publications WHERE id=? AND account_id=? AND profile=?').bind(body.id,a.id,body.profile).first():null;
  const saved=a&&JSON.parse(a.payload),legacy=saved?.profiles?.[body.profile]?.homework?.assigned?.includes(body.id)&&saved.homeworkPacks?.[body.id];
  const pack=(legacy&&!legacy.published?legacy:null)||(row&&JSON.parse(row.payload))||builtin;
  if(!pack)fail(404,'That homework is not assigned to this player.');
  const q=pack.questions.find(q=>q.id===body.question);
  if(body.kind==='main'){const p=pack.paragraphs.find(p=>p.id===body.paragraph);return response({correct:!!p&&p.mainIdea.answer===body.answer});}
  if(!q)fail(400,'Choose an active question.');
  if(body.kind==='keywords'){if(!Array.isArray(body.selected)||body.selected.length>250)fail(400,'Choose words from the question.');const r=missionKeywords(q,body.selected);return response({accepted:r.accepted,quality:r.quality,matched:r.matched,reward:r.accepted});}
  if(body.kind==='evidence'){
   const s={evidence:{},hints:{},checks:[]};for(const x of (Array.isArray(body.claims)?body.claims:[]).slice(0,50))claimEvidence(pack,q,s,x);
   const r=claimEvidence(pack,q,s,body.selection);
   return response({correct:r.correct,complete:r.complete,matched:r.matched,required:r.required,segments:r.correct?s.evidence[q.id]?.segments:undefined});
  }
  if(body.kind==='answer'){return response({correct:checkActivity(q,{evidence:{[q.id]:true}},body.answer)});}
  if(body.kind==='reflection')return response({correct:!!q.reflection&&q.reflection.answer===body.answer});
  if(body.kind==='hint')return response({hint:q.hints[1]||'Think about what the question asks.'});
  fail(400,'Unknown homework check.');
 }
 if(!admin)fail(403,'Only the designated administrator can open this workshop.');
 if(path==='/api/reading-admin'){
  const players=(await db.prepare('SELECT id,username FROM explorers ORDER BY username').all()).results;
  const published=(await db.prepare('SELECT id,account_id,profile,payload,published FROM reading_publications ORDER BY published DESC').all()).results.map(({payload,...r})=>({...r,title:JSON.parse(payload).title}));
  return response({players,published,drafts:[...(draft?[draft]:[]),...readyCases,...Object.values(JSON.parse(a.payload).homeworkPacks||{}).filter(p=>!p.published&&!readyCases.some(x=>x.id===p.id))]});
 }
 if(path==='/api/reading-publish'){
  if(body.confirmed!==true)fail(400,'Confirm you reviewed the worksheet first.');
  const pack=structuredClone(body.pack);
  if(!pack||typeof pack!=='object')fail(400,'Import a worksheet first.');
  pack.id='published-'+crypto.randomUUID();
  const errors=validateHomework(pack);if(errors.length)fail(400,errors[0]);
  if(!['ari','kal'].includes(body.profile)||!await db.prepare('SELECT 1 FROM explorers WHERE id=?').bind(body.account).first())fail(400,'Choose an existing player.');
  await db.prepare('INSERT INTO reading_publications(id,account_id,profile,payload,published) VALUES (?,?,?,?,?)').bind(pack.id,body.account,body.profile,JSON.stringify(pack),Date.now()).run();
  return response({id:pack.id,title:pack.title,published:true});
 }
 fail(404,'Unknown homework action.');
}
export async function validatePublicationSaves(db,account,data,fail,old){
 for(const [id,p] of Object.entries(data.homeworkPacks||{})){
  const legacy=old?.homeworkPacks?.[id],builtin=readyCases.find(x=>x.id===id);
  if(legacy&&!legacy.published&&!isBundledReadingPack(id,legacy)){if(p?.published)data.homeworkPacks[id]=legacy;continue;}
  if(builtin&&(p?.published||isBundledReadingPack(id,p))){data.homeworkPacks[id]=learnerCopy(builtin);continue;}
  if(!id.startsWith('published-')&&!p?.published)continue;
  const r=await db.prepare('SELECT payload,profile FROM reading_publications WHERE id=? AND account_id=?').bind(id,account).first();
  if(!r)fail(403,'That published worksheet is not assigned to this explorer.');
  for(const [profile,player] of Object.entries(data.profiles)){if(profile!==r.profile&&(player.homework?.active===id||player.homework?.assigned?.includes(id)||player.homework?.cases?.[id]))fail(403,'That worksheet is assigned to a different player.');}
  data.homeworkPacks[id]=learnerCopy(JSON.parse(r.payload));
 }
}

export function redactKnownReading(data){for(const [id,p] of Object.entries(data.homeworkPacks||{})){if(!p.published)data.homeworkPacks[id]=learnerCopy(p);}return data;}

export function publicReadingCatalog(){return [...readyCases.map(learnerCopy),...(draft?[{id:draft.id,title:draft.title,reviewRequired:true,questions:draft.questions.map(()=>({}))}]:[])];}
