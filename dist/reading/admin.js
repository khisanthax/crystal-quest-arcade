import {esc} from '../runner/parent.js';
import {convertWorksheet} from './import.js';
import {sentences} from './model.js';

export async function readingRequest(action,body={}){
 if(navigator.onLine===false)throw Error('Could not reach the homework service. Check your connection and try again.');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 let res,data;try{res=await fetch('/api/reading-'+action,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});data=await res.json();}catch{throw Error('Could not reach the homework service. Check your connection and try again.');}finally{clearTimeout(timeout);}if(!res.ok)throw Error(data.error||'The worksheet service is unavailable.');return data;
}
export async function openAdmin({screen,on,back,enter}){
 let access;
 try{access=await readingRequest('access');}catch{access={};}
 if(access.admin){enter();return;}
 let heading='Administrator access';
 let description='<p>Sign in to the designated administrator Explorer to manage homework and study packs.</p>';
 if(access.setupRequired){
  heading='Owner setup required';
  description='<p>Ask the site owner to configure the Game Master access key before opening the workshop.</p>';
 }else if(access.locked){
  heading='Unlock Game Master';
  description='<p>Enter the owner key in Game Master, then return to the workshop.</p><a href="/admin">Open Game Master</a>';
 }
 screen(`<section class="panel"><h2>${heading}</h2>${description}<button id="admin-back">Back</button></section>`,'reading-import');
 on('admin-back',back);
}
export function homeworkAdmin({screen,on,back,getProfile}){
 const $=id=>document.getElementById(id);
 let draft,info;
 const fail=e=>{$('admin-status').textContent=e.message;};
 async function workshop(){return openAdmin({screen,on,back,enter:async()=>{try{info=await readingRequest('admin');show();}catch(e){screen(`<section class="panel"><p>${esc(e.message)}</p><button id="admin-back">Back</button></section>`,'reading-import');on('admin-back',back);}}});}
 const options=(choices,selected)=>choices.map((c,i)=>`<option value="${i}" ${i===selected?'selected':''}>${esc(c)}</option>`).join('');
 const field=(label,id,value,area=false)=>`<label>${label}${area?`<textarea id="${id}" rows="3">${esc(value)}</textarea>`:`<input id="${id}" value="${esc(value)}">`}</label>`;
 function spanOptions(e){
  return '<option value="">Choose supporting sentence(s)</option>'+draft.paragraphs.flatMap((p,pi)=>{const ss=sentences(p.text);return ss.flatMap((x,i)=>[i,i+1].filter(j=>ss[j]).map(j=>`<option value="${pi}:${i}:${j}" ${p.id===e.paragraphId&&x.start===e.start&&ss[j].end===e.end?'selected':''}>Paragraph ${pi+1}: ${esc(p.text.slice(x.start,ss[j].end))}</option>`));}).join('');
 }
 function show(message=''){
  screen(`<section class="panel wide homework-editor"><h2>Homework Workshop</h2><label>Import worksheet file<input id="homework-file" type="file" accept=".json,application/json"></label><div class="row">${info.drafts.map((p,i)=>`<button data-review-draft="${i}">Review ${esc(p.title)}</button>`).join('')}<button id="admin-back">Back</button></div><p id="admin-status" role="status">${esc(message)}</p><details><summary>Published worksheets (${info.published.length})</summary>${info.published.map(p=>`<p>${esc(p.title)} · ${esc(info.players.find(a=>a.id===p.account_id)?.username)} · ${p.profile==='ari'?'Emberia':'Luminara'}</p>`).join('')}</details>${draft?`<form id="homework-review"><h3>Review worksheet</h3>${field('Assignment title','assignment-title',draft.title)}${draft.reviewRequired?'<p>Check this draft against the original worksheet and correct uncertain text before approving.</p>':''}${draft.paragraphs.map((a,i)=>`<fieldset><legend>Paragraph ${i+1}</legend>${field('Reading passage','paragraph-'+i,a.text,true)}${field('Main-idea prompt','main-prompt-'+i,a.mainIdea.prompt)}${a.mainIdea.choices.map((x,j)=>field('Main-idea choice '+(j+1),`main-choice-${i}-${j}`,x)).join('')}<label>Correct main idea<select id="main-answer-${i}">${options(a.mainIdea.choices,a.mainIdea.answer)}</select></label></fieldset>`).join('')}${draft.questions.map((q,i)=>`<fieldset><legend>Question ${i+1}</legend>${field('Question','question-'+i,q.text)}${field('Keyword groups (one per line; alternatives separated by |)','keywords-'+i,q.keywordGroups.map(g=>g.any.join(' | ')).join('\n'),true)}${q.worksheet?.choices?.map((x,j)=>field('Answer choice '+(j+1),`answer-${i}-${j}`,x)).join('')||''}${q.worksheet?.type==='diagram_label'?field('Correct order (choice numbers separated by commas)','answer-key-'+i,q.worksheet.order.map(n=>n+1).join(',')):q.worksheet?.choices?`<label>Correct answer<select id="answer-key-${i}">${options(q.worksheet.choices,q.worksheet.answer)}</select></label>`:''}${field('Answer guidance','guidance-'+i,q.worksheet?.parentGuidance||'')}${q.reflection?`<h4>Follow-up question</h4>${field('Follow-up prompt','reflection-prompt-'+i,q.reflection.prompt)}${q.reflection.choices.map((x,j)=>field('Follow-up choice '+(j+1),`reflection-choice-${i}-${j}`,x)).join('')}<label>Correct follow-up answer<select id="reflection-key-${i}">${options(q.reflection.choices,q.reflection.answer)}</select></label>`:''}${q.hints.map((x,j)=>field('Hint '+(j+1),`hint-${i}-${j}`,x)).join('')}${q.evidence.map((e,j)=>`<label>Supporting evidence ${j+1}<select id="evidence-${i}-${j}">${spanOptions(e)}</select></label>${field('Why this supports the answer',`explanation-${i}-${j}`,e.explanation)}`).join('')}${field('Evidence groups (numbers joined by +; alternatives on separate lines)','groups-'+i,(q.evidenceGroups||q.evidence.map((_,j)=>[j])).map(g=>g.map(n=>n+1).join(' + ')).join('\n'),true)}</fieldset>`).join('')}<label>Assign to Explorer<select id="reading-assignee">${info.players.map(a=>`<option value="${esc(a.id)}">${esc(a.username)}</option>`).join('')}</select></label><label>Player<select id="reading-assignee-profile"><option value="ari">Emberia</option><option value="kal" ${getProfile()==='kal'?'selected':''}>Luminara</option></select></label><label><input id="confirm-transcription" type="checkbox"> I checked the questions, answers and evidence against the worksheet.</label><button type="submit" id="assign-homework" class="primary">Accept &amp; Publish</button><p id="publish-status" role="alert"></p></form>`:''}</section>`,'reading-import');
  on('admin-back',back);
  document.querySelectorAll('[data-review-draft]').forEach(b=>b.onclick=()=>{draft=structuredClone(info.drafts[b.dataset.reviewDraft]);show();});
  on('homework-file',async()=>{try{const f=$('homework-file').files[0];if(!f)return;if(f.size>250000)throw Error('Choose a worksheet smaller than 250 KB.');const p=convertWorksheet(JSON.parse(await f.text()));if(!Array.isArray(p?.paragraphs)||!Array.isArray(p?.questions)||!p.paragraphs.every(a=>a.mainIdea?.choices)||!p.questions.every(q=>Array.isArray(q.keywordGroups)&&Array.isArray(q.evidence)&&Array.isArray(q.hints)))throw Error('This file is missing worksheet questions, paragraphs or evidence.');draft=p;show('Worksheet imported. Review the form below.');}catch(e){fail(e);}},'change');
  if(!draft)return;
  draft.paragraphs.forEach((p,i)=>on('paragraph-'+i,()=>{
   const selections=draft.questions.map((q,qi)=>q.evidence.map((_,j)=>$('evidence-'+qi+'-'+j).value));
   const old=p.text;p.text=$('paragraph-'+i).value;
   draft.questions.forEach((q,qi)=>q.evidence.forEach((e,j)=>{const sel=$('evidence-'+qi+'-'+j);sel.innerHTML=spanOptions({});const v=selections[qi][j];if(v&&(!v.startsWith(i+':')||p.text===old))sel.value=v;}));
  },'change'));
  on('homework-review',async event=>{event.preventDefault();const button=$('assign-homework'),status=$('publish-status');button.disabled=true;try{const pack=collect();const r=await readingRequest('publish',{pack,account:$('reading-assignee').value,profile:$('reading-assignee-profile').value,confirmed:$('confirm-transcription').checked});info.published.unshift({id:r.id,title:r.title,account_id:$('reading-assignee').value,profile:$('reading-assignee-profile').value});draft=null;show(r.title+' published. The assigned player can open it in Reading Detective.');}catch(e){status.textContent=e.message;button.disabled=false;}},'submit');
 }
 function collect(){
  const p=structuredClone(draft);p.title=$('assignment-title').value.trim();p.reviewRequired=false;p.uncertainties=[];
  p.paragraphs.forEach((a,i)=>{a.text=$('paragraph-'+i).value;a.mainIdea={prompt:$('main-prompt-'+i).value,choices:a.mainIdea.choices.map((_,j)=>$('main-choice-'+i+'-'+j).value),answer:Number($('main-answer-'+i).value)};});
  p.questions.forEach((q,i)=>{q.text=$('question-'+i).value;q.keywordGroups=$('keywords-'+i).value.split('\n').filter(Boolean).map(line=>({any:line.split('|').map(x=>x.trim()).filter(Boolean)}));if(q.worksheet){q.worksheet.parentGuidance=$('guidance-'+i).value;if(q.worksheet.choices)q.worksheet.choices=q.worksheet.choices.map((_,j)=>$('answer-'+i+'-'+j).value);if(q.worksheet.type==='diagram_label')q.worksheet.order=$('answer-key-'+i).value.split(',').map(n=>Number(n)-1);else if(q.worksheet.choices)q.worksheet.answer=Number($('answer-key-'+i).value);}
   const guidance=$('guidance-'+i).value;if(!q.worksheet&&guidance)q.worksheet={type:'short_answer',parentGuidance:guidance};if(q.reflection)q.reflection={prompt:$('reflection-prompt-'+i).value,choices:q.reflection.choices.map((_,j)=>$('reflection-choice-'+i+'-'+j).value),answer:Number($('reflection-key-'+i).value)};q.hints=q.hints.map((_,j)=>$('hint-'+i+'-'+j).value);
   q.evidence=q.evidence.map((e,j)=>{const v=$('evidence-'+i+'-'+j).value;if(!v)throw Error('Choose supporting evidence for question '+(i+1)+'.');const [pi,first,last]=v.split(':').map(Number),a=p.paragraphs[pi],ss=sentences(a.text);const range={paragraphId:a.id,start:ss[first].start,end:ss[last].end,explanation:$('explanation-'+i+'-'+j).value};if(e.paragraphId===range.paragraphId&&e.start===range.start&&e.end===range.end&&draft.paragraphs[pi].text.slice(e.quoteStart,e.quoteEnd)===e.sourceQuote)return {...e,...range};return range;});
   q.evidenceGroups=$('groups-'+i).value.split('\n').filter(Boolean).map(l=>l.split('+').map(n=>Number(n.trim())-1));
  });return p;
 }
 return {workshop};
}
