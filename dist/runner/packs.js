import {VOCAB as GEO,choicesFor,HINTS} from '../ari/vocabulary.js';
import {VOCAB as SKY,FACTS,QUESTIONS} from '../kal/science.js';
export const PACK_VERSION=1;
export const builtins=()=>[
 {version:1,id:'earth-science',title:"Earth Science — Rocks and Earth's Layers",subject:'Science',grade:'3–4',vocabulary:GEO.map(v=>({...v})),facts:[],questions:[...GEO.map(v=>({id:v.id,concepts:[v.id],type:'matching',prompt:v.definition,choices:choicesFor(v.id).map(x=>({id:x.id,label:x.term})),answer:v.id,hint:HINTS[v.id],explanation:v.definition})),{id:'layers-order',concepts:['crust','mantle','core'],type:'order',prompt:'Build Earth: outside to center.',choices:[{id:'crust',label:'CRUST'},{id:'mantle',label:'MANTLE'},{id:'core',label:'CORE'}],answer:['crust','mantle','core'],hint:'Start with the thin outside layer.',explanation:'Crust outside, mantle in the middle, core at the center.'},{id:'older-layer',concepts:['dating'],type:'picture',prompt:'In undisturbed layers, which layer is oldest?',picture:'layers',choices:[{id:'bottom',label:'BOTTOM'},{id:'top',label:'TOP'},{id:'middle',label:'MIDDLE'}],answer:'bottom',hint:'The first layers were there before others settled on top.',explanation:'In an undisturbed stack, the bottom layer is older.'}]},
 {version:1,id:'patterns-sky',title:'Patterns in the Sky',subject:'Science',grade:'1',vocabulary:SKY.map(v=>({...v,definition:v.id==='sphere'?'A three-dimensional ball shape.':v.definition})),facts:FACTS.map(v=>({...v})),questions:[...Object.entries(QUESTIONS).map(([key,q])=>({id:key,concepts:[q.id],type:q.art?'picture':'choice',prompt:q.prompt,picture:q.art,choices:q.answers.map(([label,picture],i)=>({id:String(i),label,picture})),answer:String(q.correct),hint:q.hint,explanation:q.explain})),{id:'directions-order',concepts:['east','west'],type:'order',prompt:'Tap sunrise, then sunset.',choices:[{id:'east',label:'EAST',picture:'rise'},{id:'west',label:'WEST',picture:'set'}],answer:['east','west'],hint:'Think about morning before evening.',explanation:'The Sun rises in the east and sets in the west.'}]}
];
const identifier=/^(?!(?:__proto__|constructor|prototype)$)[a-zA-Z0-9_-]{1,64}$/;
const plain=(s,n=400)=>typeof s==='string'&&s.trim().length>0&&s.length<=n;
export function validatePack(p){
 const errors=[];if(!p||typeof p!=='object')return ['A study pack must be a JSON object.'];
 if(p.version!==1)errors.push('version must be 1.');if(!identifier.test(p.id||''))errors.push('Pack ID: use 1–64 letters, numbers, hyphens or underscores.');
 for(const k of ['title','subject','grade'])if(!plain(p[k],160))errors.push(k+' is required (up to 160 characters).');
 const concepts=[];for(const k of ['vocabulary','facts']){if(!Array.isArray(p[k])){errors.push(k+' must be an array.');continue;}if(p[k].length>300)errors.push('At most 300 '+k+' entries.');for(const c of p[k]){if(!c||!identifier.test(c.id||'')||!plain(c.definition)||k==='vocabulary'&&!plain(c.term,100))errors.push('Each '+k+' entry needs an ID, definition'+(k==='vocabulary'?' and term.':'.'));else concepts.push(c.id);}}
 if(new Set(concepts).size!==concepts.length)errors.push('Concept IDs must be unique.');
 if(!Array.isArray(p.questions)||!p.questions.length||p.questions.length>500){errors.push('Include 1–500 questions.');return errors;}
 const ids=new Set();for(const [i,q]of p.questions.entries()){
  const name='Question '+(i+1)+': ';if(!q||!identifier.test(q.id||'')){errors.push(name+'ID is required.');continue;}if(ids.has(q.id))errors.push(name+'duplicate ID.');ids.add(q.id);
  if(!plain(q.prompt))errors.push(name+'prompt is required (max 400 characters).');if(!['choice','matching','picture','order'].includes(q.type))errors.push(name+'unknown question type.');
  if(!Array.isArray(q.concepts)||!q.concepts.length||new Set(q.concepts).size!==q.concepts.length||q.concepts.some(c=>!concepts.includes(c)))errors.push(name+'link it to an existing vocabulary/fact ID.');
  if(!Array.isArray(q.choices)||q.choices.length<2||q.choices.length>4){errors.push(name+'needs 2–4 choices.');continue;}
  const choices=q.choices.map(c=>c?.id),labels=q.choices.map(c=>typeof c?.label==='string'?c.label.trim().toLowerCase():'');
  if(q.choices.some(c=>!c||!identifier.test(c.id||'')||!plain(c.label,160)||c.picture!==undefined&&!/^[\w-]{1,40}$/.test(c.picture)))errors.push(name+'invalid choice ID, label or built-in picture name.');
  if(new Set(choices).size!==choices.length||new Set(labels).size!==labels.length)errors.push(name+'choices must be unique.');
  if(q.type==='order'){if(!Array.isArray(q.answer)||q.answer.length!==choices.length||new Set(q.answer).size!==choices.length||q.answer.some(a=>!choices.includes(a)))errors.push(name+'ordered answer must list every choice ID once.');}
  else if(typeof q.answer!=='string'||!choices.includes(q.answer))errors.push(name+'select exactly one correct choice ID.');
  for(const k of ['hint','explanation','narration'])if(q[k]!==undefined&&(typeof q[k]!=='string'||q[k].length>600))errors.push(name+k+' must be text up to 600 characters.');
  if(q.picture!==undefined&&!/^[\w-]{1,40}$/.test(q.picture))errors.push(name+'invalid built-in picture name.');
 }
 for(const id of concepts)if(!p.questions.some(q=>q?.concepts?.includes(id)))errors.push('Concept '+id+' needs at least one assessment question.');
 return errors;
}
export function parsePack(text){if(text.length>1500000)throw Error('Pack file is too large (maximum 1.5 MB).');const p=JSON.parse(text);const errors=validatePack(p);if(errors.length)throw Error(errors.join('\n'));return p;}
export const emptyRecord=()=>({presented:0,firstCorrect:0,incorrect:0,laterCorrect:0,correct:0,lastDate:null,latest:'Not practiced',review:0});
export function presentRecord(history,q){for(const [map,ids]of [[history.questions,[q.id]],[history.concepts,q.concepts]])for(const id of ids){map[id]??=emptyRecord();map[id].presented++;map[id].lastDate=new Date().toISOString();}}
export function answerRecord(history,q,correct,attempt){for(const [map,ids]of [[history.questions,[q.id]],[history.concepts,q.concepts]])for(const id of ids){map[id]??=emptyRecord();const r=map[id];r.lastDate=new Date().toISOString();if(correct){r.correct++;if(attempt===0)r.firstCorrect++;else r.laterCorrect++;r.latest=attempt===0?'Correct first try':'Correct after retry';r.review=attempt===0?0:2;}else{r.incorrect++;r.review=3;r.latest='Needs another try';}}for(const id of q.concepts){history.concepts[id].review=Math.max(0,...Object.entries(history.questions).filter(([key])=>history.mapping[key]?.includes(id)).map(([,r])=>r.review));}}
export function chooseQuestions(pack,history,count=1,missed=false){const rows=pack.questions.filter(q=>!missed||history.questions[q.id]?.review>0).sort((a,b)=>{const x=history.questions[a.id]||emptyRecord(),y=history.questions[b.id]||emptyRecord();return Number(x.presented>0)-Number(y.presented>0)||y.review-x.review||(x.lastDate||'').localeCompare(y.lastDate||'')||x.presented-y.presented;});const picked=rows.slice(0,count);while(count===2&&rows.length===1&&picked.length&&picked.length<count)picked.push(picked[picked.length%rows.length]);return picked.map(q=>q.id);}
