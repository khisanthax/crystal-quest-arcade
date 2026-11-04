import {homeworkAdmin,readingRequest} from './admin.js';
import {STAGES,ensureGuided,missionState,missionKeywords,setStage,switchMission,visitParagraph,forwardParagraph,mainIdeaParagraph,beginAnswer,finishMainIdea,canWrite,acknowledgePaper,nextMission} from './workflow.js';
import {bundledCases} from './catalog.js';
import {ensureHomework,caseState,checkKeywords,checkEvidence,claimEvidence,evidenceSegments,activityRequired,checkActivity,readingReward,words,sentences} from './model.js';
import {petPortrait} from '../runner/pet-art.js';
import {equipped,collection,ACCESSORIES} from '../runner/collection.js';
import {esc} from '../runner/parent.js';
export function detectiveArt(){return `<svg viewBox="0 0 240 330" aria-hidden="true"><defs><linearGradient id="coat" x2="1" y2="1"><stop stop-color="#d09d50"/><stop offset="1" stop-color="#956434"/></linearGradient></defs><ellipse cx="125" cy="316" rx="75" ry="12" fill="#10261a66"/><path d="M84 244l-10 62h27l18-55 10 55h30l-11-67" fill="#3c4c57"/><path d="M70 179q51-40 95 0l14 85H58z" fill="url(#coat)" stroke="#744c32" stroke-width="4"/><path d="M107 161l16 54 16-54" fill="#fff0c3"/><path d="M119 198l-9 54h20l-5-54" fill="#76a7a1"/><path d="M83 182l-33 50m107-43 33 10" stroke="#d3a25e" stroke-width="24" stroke-linecap="round"/><circle cx="189" cy="195" r="13" fill="#ffc99c"/><path d="M87 80q45-51 83 12l-9 64q-36 41-76-2z" fill="#6c4031"/><ellipse cx="122" cy="113" rx="44" ry="51" fill="#ffd1a5"/><path d="M77 108q-9-75 49-66 62 1 42 76l-17-43q-22 34-74 33" fill="#6f4230"/><path d="M69 77q52-54 108 0l-18-38q-38-42-70 1z" fill="#d3ab69" stroke="#875c39" stroke-width="4"/><path d="M65 79q59-19 118 0" fill="none" stroke="#916840" stroke-width="12" stroke-linecap="round"/><ellipse cx="107" cy="114" rx="5" ry="7" fill="#343b3a"/><ellipse cx="142" cy="114" rx="5" ry="7" fill="#343b3a"/><path d="M113 137q13 13 25-3" stroke="#9c5d41" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M177 190l19-41" stroke="#7d5234" stroke-width="11" stroke-linecap="round"/><circle cx="203" cy="126" r="30" fill="#9ce6eb88" stroke="#f1ce74" stroke-width="9"/><path d="M189 112l20-8" stroke="#fff8" stroke-width="5" stroke-linecap="round"/></svg>`;}
export function readingUI({getData,getProfile,save,screen,on,back,notice,speak}){const $=id=>document.getElementById(id);let pack=null,s=null,h=null,mode='clue',anchor=null,tab='today';const context=()=>{const d=getData(),id=getProfile();h=ensureHomework(d,id);return {d,id,p:d.profiles[id]};};
function library(nextTab='today'){tab=nextTab;const {d,p}=context(),active=d.homeworkPacks[h.active],list=h.assigned.map(id=>d.homeworkPacks[id]).filter(Boolean);screen(`<section class="panel case-library"><p class="eyebrow">A LITTLE READING. A BIG DISCOVERY.</p><h2>🔎 Reading Detective</h2><p>Find clues. Open the case file. Write on your real worksheet.</p>${active&&tab==='today'?(()=>{const a=caseState(h,active),found=Object.keys(a.evidence).length;return `<article class="today-case"><span>📜 TODAY’S CASE</span><h3>${esc(active.title)}</h3><progress value="${Object.keys(a.written).length}" max="${active.questions.length}"></progress><p>${found}/${active.questions.length} clues found · ${Object.keys(a.written).length} answers written · ${active.questions.length-Object.keys(a.written).length} remaining</p><button class="primary" id="continue-case">${a.completed?'REVIEW TODAY’S CASE':'CONTINUE TODAY’S CASE'} ➜</button></article>`;})():''}${!active&&tab==='today'?'<div class="case-empty"><div>📂 ✨</div><h3>Your next mystery is waiting!</h3><p>Choose a verified worksheet below, or ask a grown-up to import another.<br>No homework has been invented or assigned for you.</p></div>':''}${tab==='past'?`<div class="past-cases">${list.map(a=>{const attempts=h.cases[a.id]||[],last=attempts.at(-1);return `<article><h3>${esc(a.title)}</h3><p>${last?.completed?'Case closed · replay earns 10% crystals':'Saved investigation'}${h.active===a.id?' · Current case':''}</p><button data-case="${esc(a.id)}">${last?.completed?'REPLAY CASE':'CONTINUE CASE'}</button></article>`;}).join('')||'<p>Completed cases will stay here for review.</p>'}</div>`:''}${catalogPanel()}<div id="assigned-worksheets"></div><div class="row"><button id="new-case" class="secondary">START NEW CASE</button><button id="past-cases">${tab==='past'?'TODAY’S CASE':'PAST CASES'}</button><button id="reading-back">BACK TO GAMES</button></div></section>`,'reading-library');bindCatalog();on('continue-case',()=>open(active.id));on('new-case',workshop);on('past-cases',()=>library(tab==='past'?'today':'past'));on('reading-back',back);document.querySelectorAll('[data-case]').forEach(b=>b.onclick=()=>open(b.dataset.case,true));const listEl=$('assigned-worksheets'),id=getProfile();readingRequest('library',{profile:id}).then(({cases})=>{if(!listEl.isConnected||getProfile()!==id||!cases.length)return;listEl.innerHTML=`<h3>Assigned homework</h3><div class="row">${cases.map((c,i)=>`<button data-published="${i}">${esc(c.title)}</button>`).join('')}</div>`;listEl.querySelectorAll('button').forEach(b=>b.onclick=()=>{const c=cases[Number(b.dataset.published)];d.homeworkPacks[c.id]=c;if(!h.assigned.includes(c.id))h.assigned.push(c.id);h.active=c.id;open(c.id);});}).catch(()=>{});save();}
function catalogPanel(){return `<section class="bundled-cases"><h3>Choose a worksheet case</h3><div class="past-cases">${bundledCases.map(a=>`<article class="bundled-case ${a.reviewRequired?'needs-review':''}"><small>${a.reviewRequired?'⚠ NEEDS REVIEW · NOT ASSIGNED':'✓ VERIFIED WORKSHEET'}</small><h3>${esc(a.title)}</h3><p>${a.questions.length} ${a.reviewRequired?'activities · adapted passage':'activities · ready to investigate'}</p>${a.reviewRequired?'<p>The first source photo is blurry. A grown-up must check and correct this adaptation before homework use.</p>':''}<button data-bundled="${esc(a.id)}">${a.reviewRequired?'PARENT REVIEW PREVIEW':'OPEN CASE'}</button></article>`).join('')}</div></section>`;}
function bindCatalog(){document.querySelectorAll('[data-bundled]').forEach(b=>b.onclick=()=>{const item=bundledCases.find(a=>a.id===b.dataset.bundled);if(item.reviewRequired){workshop();return;}try{const {d,id}=context();d.homeworkPacks[item.id]??=item;if(!h.assigned.includes(item.id))h.assigned.push(item.id);h.active=item.id;save();open(item.id);}catch(e){notice(e.message);}});}
const admin=homeworkAdmin({screen,on,back:()=>library(),getProfile});
const workshop=admin.workshop;
function open(id,replay=false){const {d}=context();pack=d.homeworkPacks[id]||bundledCases.find(x=>x.id===id&&!x.reviewRequired);if(!pack)return;d.homeworkPacks[id]=pack; s=ensureGuided(caseState(h,pack,replay),pack);anchor=null;render();}
const qNow=()=>pack.questions[s.mission], paragraph=()=>pack.paragraphs[s.paragraph], current=()=>missionState(s,qNow());
function reward(key,n,xp=0){const {p}=context(),paid=readingReward(p,h,pack,s,key,n,xp);if(paid)notice(`✦ +${paid} crystals!`);save();}
function stage(value){setStage(s,pack,value);anchor=null;render();}
const readingStages=new Set([STAGES.CLUES,STAGES.SELECT,STAGES.EVIDENCE_FEEDBACK,STAGES.READY]);
function primary(label,disabled=false){return `<button id="guided-primary" data-primary class="reading-action gold" ${disabled?'disabled':''}>${label}</button>`;}
function quotedEvidence(q){const spans=s.evidence[q.id]?.segments||evidenceSegments(s,q.id);return spans.map(e=>`<blockquote class="verified">${esc(pack.paragraphs.find(a=>a.id===e.paragraphId)?.text.slice(e.start,e.end)||'')}</blockquote>`).join('');}
function advanceMission(){if(pack.questions.every(q=>s.written[q.id])){if(!s.completed){s.completed=new Date().toISOString();reward('complete',5,15);}stage(STAGES.CASE_COMPLETE);return;}if(!nextMission(s,pack))switchMission(s,pack,pack.questions.findIndex(q=>!s.written[q.id]));render();}
function openOverview(target){if(![STAGES.MAP,STAGES.NOTEBOOK].includes(s.workflowStage))s.overviewReturn=s.workflowStage;stage(target);}
function goBack(){const st=s.workflowStage;if(st===STAGES.MAP||st===STAGES.NOTEBOOK){stage(s.overviewReturn||STAGES.CLUES);return;}if(st===STAGES.PAPER){stage(s.paperReturn||STAGES.READY);return;}if(st===STAGES.CONNECTION||st===STAGES.MAIN_IDEA){stage(STAGES.READY);return;}if(st===STAGES.SELECT||st===STAGES.EVIDENCE_FEEDBACK||st===STAGES.READY){stage(STAGES.CLUES);return;}library();}
function render(){
 anchor=null;const {p}=context(),q=qNow(),m=current(),a=paragraph(),st=s.workflowStage,pet=equipped(p),done=Object.keys(s.written).length;
 const ideaParagraph=st===STAGES.MAIN_IDEA?mainIdeaParagraph(s,pack):null;
 let content='',action='',handler=null;
 if(st===STAGES.KEYWORDS||st===STAGES.KEYWORD_FEEDBACK){content=keywordPanel(q);action=primary('CHECK MY KEYWORDS');handler=validateKeywords;}
 else if(readingStages.has(st)){content=passagePanel(q,a);const partial=st===STAGES.EVIDENCE_FEEDBACK&&m.verdict;
  action=primary(st===STAGES.CLUES?'DONE FINDING CLUES':st===STAGES.READY?'YES, I FOUND IT!':partial?'KEEP INVESTIGATING':'CHECK MY EVIDENCE',st===STAGES.SELECT&&!m.selection);
  if(st===STAGES.READY)action+='<button class="story-nav" id="keep-looking">No, keep looking</button>';
  handler=st===STAGES.CLUES?()=>{m.feedback=visibleClues(m,a.id).length?'Clue notes saved.':'';stage(STAGES.SELECT);}:st===STAGES.READY?foundAnswer:partial?()=>stage(STAGES.CLUES):verifyEvidence;
 }
 else if(st===STAGES.MAIN_IDEA){
  const mi=s.mainIdeas[ideaParagraph.id],number=pack.paragraphs.indexOf(ideaParagraph)+1;
  content=`<p class="case-eyebrow">PARAGRAPH ${number} · REMEMBER THE IDEA</p><h2>What was this paragraph mostly about?</h2><div class="idea-choices guided-choices">${ideaParagraph.mainIdea.choices.map((c,i)=>`<button data-main-idea="${i}">${esc(c)}</button>`).join('')}</div><p role="status">${mi?'Think about the whole paragraph, not just one detail. Try again.':''}</p><details><summary>Read it again</summary><p class="whole-story-text">${esc(ideaParagraph.text)}</p></details>`;
 }
 else if(st===STAGES.MAP||st===STAGES.NOTEBOOK){content=overview(st===STAGES.NOTEBOOK);}
 else if(st===STAGES.CONNECTION){content=connectionPanel(q);action=primary(q.worksheet?.type==='diagram_label'&&!s.activities?.[q.id]?.correct?'CHECK MY LABELS':'CHECK MY ANSWER',!connectionReady(q));handler=checkConnection;}
 else if(st===STAGES.PAPER){content=`<h2>Write your answer on your homework sheet!</h2><p>Use your clues to write your answer in your own words.</p><div class="paper-evidence">${quotedEvidence(q)}</div>`;action=primary('I WROTE MY ANSWER');handler=()=>{if(acknowledgePaper(s,pack))reward('mission:'+q.id,2);advanceMission();};}
 else if(st===STAGES.COMPLETE){content=`<h2>✓ Answer written</h2><div class="paper-evidence">${quotedEvidence(q)}</div><button id="edit-evidence">Review evidence</button>`;action=primary(pack.questions.every(q=>s.written[q.id])?'FINISH CASE':'NEXT MISSION');handler=advanceMission;}
 else {content=`<div class="guided-celebration">🏆 ✨</div><h2>Case closed!</h2><p>You investigated ${pack.questions.length} missions.</p><p>Check that <strong>every answer is written on your original worksheet</strong>. Bring your paper to school!</p><button class="guided-link" id="review-work">Review my discoveries</button>`;action=primary('BACK TO CASES');handler=()=>library();}
 screen(`<section class="reading-detective guided" data-workflow="${st}" data-mission="${esc(q.id)}"><header class="reading-status"><button id="guided-back">← Back</button><button id="case-menu">Cases</button><div><small>READING DETECTIVE</small><strong>${esc(pack.title)}</strong></div><span>${done}/${pack.questions.length} written</span><b>💎 ${collection(p).wallet}</b><button id="read-case" aria-label="Read aloud">🔊</button><button id="reading-voice" aria-label="Toggle narration">Voice ${getData().narration?'On':'Off'}</button></header><div class="detective-layout"><aside class="detective-guide"><h2>Reading<br>Detective 🔎</h2><div class="detective-character">${detectiveArt()}</div>${pet?`<div class="detective-pet">${petPortrait(pet.species)}${Object.values(pet.accessories||{}).filter(Boolean).map(id=>`<span class="reading-accessory">${ACCESSORIES.find(a=>a.id===id)?.icon||''}</span>`).join('')}<small>${esc(pet.name)}</small></div>`:''}<p class="guide-tip">One question.<br>Your discoveries.</p></aside><main class="parchment guided-parchment"><div class="guided-scroll"><header class="guided-question"><small>MISSION ${s.mission+1} OF ${pack.questions.length}</small>${[STAGES.KEYWORDS,STAGES.KEYWORD_FEEDBACK,STAGES.CASE_COMPLETE,STAGES.MAIN_IDEA].includes(st)?'':`<h2>${esc(q.text)}</h2>`}</header>${content}</div><footer class="guided-action">${action}</footer></main><aside class="case-progress guided-sidebar"><h3>My Detective Case</h3><progress value="${done}" max="${pack.questions.length}"></progress><p>Mission ${s.mission+1}</p><div class="guided-status">${s.written[q.id]?'✓ Paper answer written':s.evidence[q.id]?'✓ Evidence found':s.keywords[q.id]?.checks?'✓ Question reviewed':'Choose question clues'}</div>${readingStages.has(st)&&!(st===STAGES.READY&&m.reviewSaved)?'':'<button id="notebook" class="story-nav">📓 Look at My Clues</button><button id="view-all" class="story-nav">📖 Whole Story</button>'}<details><summary>My Questions</summary><div class="mission-list">${pack.questions.map((x,i)=>s.written[x.id]||i===s.mission?`<button data-mission="${i}">${s.written[x.id]?'✓':'🔎'} Mission ${i+1}</button>`:'').join('')}</div></details></aside></div><footer class="reading-banner" role="status">${esc(m.feedback||'No timer. Take one step at a time.')}</footer></section>`,'reading');
 on('guided-back',goBack);on('keep-looking',()=>stage(STAGES.CLUES));on('guided-primary',handler||(()=>{}));on('case-menu',()=>{save();library();});on('reading-voice',()=>{getData().narration=!getData().narration;save();render();});on('read-case',()=>speak(q.text+(readingStages.has(st)?' '+a.text:'')));
 on('view-all',()=>openOverview(STAGES.MAP));on('notebook',()=>openOverview(STAGES.NOTEBOOK));on('edit-evidence',()=>{m.selection=null;m.selectionChecked=false;m.feedback='Your saved evidence stays safe. Choose another supporting clue if you want.';stage(STAGES.SELECT);});on('review-work',()=>stage(STAGES.NOTEBOOK));
 document.querySelectorAll('button[data-mission]').forEach(b=>b.onclick=()=>{switchMission(s,pack,Number(b.dataset.mission));render();});
 if(st===STAGES.KEYWORDS||st===STAGES.KEYWORD_FEEDBACK)bindKeywords(q);
 if(readingStages.has(st))bindPassage(q,a);
 if(st===STAGES.MAIN_IDEA)document.querySelectorAll('[data-main-idea]').forEach(b=>b.onclick=async()=>{
  const {id,mainIdea}=ideaParagraph,selected=Number(b.dataset.mainIdea);
  const result=pack.published?await gradeRemote('main',{paragraph:id,answer:selected}):{correct:selected===mainIdea.answer};
  if(!result)return;
  const {correct}=result,record=s.mainIdeas[id]??={initial:correct,attempts:0,correct:false};
  Object.assign(record,{selected,correct,attempts:record.attempts+1});
  if(correct){finishMainIdea(s,pack);reward('main:'+id,2,3);}
  render();
 });
 if(st===STAGES.MAP||st===STAGES.NOTEBOOK){document.querySelectorAll('[data-paragraph]').forEach(b=>b.onclick=()=>{if(!s.keywords[q.id]?.checks&&!s.evidence[q.id]){s.paragraph=Number(b.dataset.paragraph);stage(STAGES.KEYWORDS);}else{visitParagraph(s,pack,Number(b.dataset.paragraph));render();}});}
 if(st===STAGES.CONNECTION)bindConnection(q);save();
}
function keywordPanel(q){const k=s.keywords[q.id]??={selected:[],checks:0,result:null};let cursor=0;const markup=words(q.text).map((w,i)=>{const before=q.text.slice(cursor,w.start);cursor=w.end;return esc(before)+`<button data-keyword="${i}" class="question-word ${k.selected.includes(i)?'chosen':''}" aria-pressed="${k.selected.includes(i)}">${esc(w.text)}</button>`;}).join('')+esc(q.text.slice(cursor));return `<h2>Tap the important words in this question</h2><div class="keyword-question">${markup}</div><p id="keyword-feedback" role="status">${esc(current().feedback||'Choose the topic and what you need to find. You can also continue without choosing words.')}</p>`;}

function bindKeywords(q){const k=s.keywords[q.id];document.querySelectorAll('[data-keyword]').forEach(b=>b.onclick=()=>{const n=Number(b.dataset.keyword);k.selected=k.selected.includes(n)?k.selected.filter(x=>x!==n):[...k.selected,n];k.accepted=false;current().feedback='';stage(STAGES.KEYWORDS);});}
async function validateKeywords(){
 const q=qNow(),k=s.keywords[q.id],selected=k.selected;
 const result=!selected.length?{quality:'skipped',accepted:false,reward:false}
  :pack.published?await gradeRemote('keywords',{selected}):missionKeywords(q,selected);
 if(!result)return;
 k.initial??=result.quality;
 k.checks++;
 k.result=result;
 k.accepted=result.accepted;
 current().feedback=result.accepted?'✓ Useful clues! Keep them in mind as you read.'
  :selected.length?'As you read, think about the topic and what the question asks.':'Keep the question in mind as you read.';
 visitParagraph(s,pack,s.paragraph);
 if(result.accepted)reward('keywords:'+q.id,2);
 render();
}
function illustration(a){const v=typeof a.illustration==='string'?a.illustration:a.illustration?.kind;if(!['forest','garden','space','ocean'].includes(v))return '';return `<svg class="reading-illustration" viewBox="0 0 180 110" role="img" aria-label="${esc(a.illustration?.alt||v+' illustration')}"><rect width="180" height="110" rx="13" fill="${v==='space'?'#25344f':v==='ocean'?'#83c9d7':'#b2d6ba'}"/>${v==='forest'||v==='garden'?'<path d="M0 100q90-45 180 0v10H0" fill="#608e61"/><path d="M32 95V40m72 50V30m44 70V46" stroke="#8c6747" stroke-width="9"/><g fill="#4c9b6b"><circle cx="32" cy="32" r="25"/><circle cx="104" cy="25" r="28"/><circle cx="148" cy="40" r="23"/></g>':v==='space'?'<g fill="#ffe9a1"><circle cx="23" cy="20" r="2"/><circle cx="146" cy="70" r="3"/><circle cx="60" cy="89" r="2"/></g><circle cx="100" cy="45" r="28" fill="#b0a1da"/><ellipse cx="100" cy="45" rx="46" ry="9" fill="none" stroke="#e6c997" stroke-width="6"/>':'<path d="M20 110V70m0 15-10-10m10 17 15-18m115 36V60m0 20-13-14m13 27 18-13" stroke="#e6a7ab" fill="none" stroke-width="9"/><g fill="#f9d18d"><ellipse cx="75" cy="40" rx="22" ry="11"/><path d="M53 40l-13-13v26z"/></g><circle cx="84" cy="38" r="2" fill="#314c58"/>'}</svg>`;}

function passagePanel(q,a){if(s.workflowStage===STAGES.READY&&current().reviewSaved)return `<h3>Your verified clues</h3>${quotedEvidence(q)}<h2>Did you find your answer?</h2>`;if(!s.visited.includes(a.id))s.visited.push(a.id);const m=current(),selecting=[STAGES.SELECT,STAGES.EVIDENCE_FEEDBACK].includes(s.workflowStage)&&!(s.workflowStage===STAGES.EVIDENCE_FEEDBACK&&m.verdict),ss=sentences(a.text),spans=evidenceSegments(s,q.id);
 return `<div class="passage-heading"><p class="case-eyebrow">Paragraph ${s.paragraph+1} of ${pack.paragraphs.length}</p></div><h2 class="reading-instruction">${s.workflowStage===STAGES.READY?'Did you find your answer?':selecting?'Highlight the sentence that helps answer your question.':'Clue Mode'}</h2>${s.workflowStage===STAGES.CLUES?'<p class="reading-instruction">Tap words that might help answer your question.</p>':''}<nav class="story-buttons" aria-label="Paragraph navigation"><button id="previous-paragraph" ${s.paragraph?'':'disabled'}>⬅ Previous Paragraph</button><button id="next-paragraph">${s.paragraph===pack.paragraphs.length-1?'📖 Review Story':'Next Paragraph ➜'}</button><button id="full-source">📖 Whole Story</button><button id="open-notebook">📓 Look at My Clues</button></nav>${illustration(a)}<div id="passage-scroll" class="passage-scroll ${selecting?'select-evidence':''}" aria-label="Reading passage">${ss.map((sentence,i)=>{const pending=!m.selectionChecked&&m.selection?.paragraphId===a.id&&m.selection.start<sentence.end&&m.selection.end>sentence.start,green=!pending&&spans.some(e=>e.paragraphId===a.id&&e.start<=sentence.start&&e.end>=sentence.end);return `<span data-sentence="${i}" ${selecting&&!m.shortSpan?`tabindex="0" role="button" aria-pressed="${pending}"`: ''} class="passage-sentence ${pending&&!m.shortSpan?'pending':''} ${green?'verified current-verified':''}">${spanWords(a,sentence,selecting,m)}</span> `;}).join('')}</div><p id="evidence-feedback" role="status">${esc(m.feedback||'')}</p><nav class="guided-secondary"><button id="reading-hint">💡 Help</button>${s.evidence[q.id]&&s.workflowStage!==STAGES.READY?'<button id="review-evidence">Review saved clues</button>':''}${selecting?`<button id="clear-evidence">Clear selection</button><button id="span-mode" aria-pressed="${!!m.shortSpan}">${m.shortSpan?'Use whole sentences':'Select a short span'}</button>`:''}</nav>`;
}
function allClues(id){return [...new Set([...(s.clues[id]||[]),...Object.values(s.missions).flatMap(m=>m.clues?.[id]||[])])];}
function visibleClues(m,id){return allClues(id).filter(n=>!(m.hiddenClues?.[id]||[]).includes(n));}
function spanWords(a,sentence,selecting,m){let cursor=0;return words(sentence.text).map(w=>{const start=sentence.start+w.start,end=sentence.start+w.end,before=sentence.text.slice(cursor,w.start);cursor=w.end;const pending=!m.selectionChecked&&m.selection?.paragraphId===a.id&&m.selection.start<=start&&m.selection.end>=end,green=evidenceSegments(s,qNow().id).some(e=>e.paragraphId===a.id&&e.start<=start&&e.end>=end);return esc(before)+(selecting?`<span data-evidence-word data-start="${start}" data-end="${end}" ${m.shortSpan?`tabindex="0" role="button" aria-pressed="${pending}"`: ''} class="${pending?(m.shortSpan?'pending':''):green?'verified':''}">${esc(w.text)}</span>`:`<button class="clue-word ${visibleClues(m,a.id).includes(start)?'clued':''} ${green?'verified':''}" data-clue="${start}" aria-pressed="${visibleClues(m,a.id).includes(start)}">${esc(w.text)}</button>`);}).join('')+esc(sentence.text.slice(cursor));}
function bindPassage(q,a){const m=current();document.querySelectorAll('[data-clue]').forEach(b=>b.onclick=()=>{const n=Number(b.dataset.clue),list=m.clues[a.id]??=[],visible=visibleClues(m,a.id).includes(n);m.hiddenClues??={};const hidden=m.hiddenClues[a.id]??=[];if(visible){m.clues[a.id]=list.filter(x=>x!==n);s.clues[a.id]=(s.clues[a.id]||[]).filter(x=>x!==n);m.hiddenClues[a.id]=[...hidden,n];}else{m.clues[a.id]=[...list,n];m.hiddenClues[a.id]=hidden.filter(x=>x!==n);}b.classList.toggle('clued',!visible);b.setAttribute('aria-pressed',String(!visible));save();});
 on('previous-paragraph',()=>{visitParagraph(s,pack,s.paragraph-1);render();});on('next-paragraph',()=>{s.overviewReturn=STAGES.CLUES;forwardParagraph(s,pack);render();});on('full-source',()=>openOverview(STAGES.MAP));on('open-notebook',()=>openOverview(STAGES.NOTEBOOK));on('reading-hint',hint);on('review-evidence',()=>{m.reviewSaved=true;stage(STAGES.READY);});on('back-saved-reading',()=>{m.reviewSaved=false;stage(STAGES.CLUES);});on('clear-evidence',()=>{m.selection=null;m.selectionChecked=false;anchor=null;stage(STAGES.SELECT);});on('span-mode',()=>{m.shortSpan=!m.shortSpan;m.selection=null;anchor=null;stage(STAGES.SELECT);});
 const region=$('passage-scroll'),ss=sentences(a.text);if(!region?.classList.contains('select-evidence'))return;let dragging=false,touchStart=null;
 const saved=evidenceSegments(s,q.id).filter(e=>e.paragraphId===a.id);
 const pick=target=>{
  const el=target?.closest(m.shortSpan?'[data-evidence-word]':'[data-sentence]');
  if(!el||!region.contains(el))return;
  const key=m.shortSpan?{start:Number(el.dataset.start),end:Number(el.dataset.end)}:ss[Number(el.dataset.sentence)];
  anchor??=key;
  const start=Math.min(anchor.start,key.start),end=Math.max(anchor.end,key.end);
  m.selection={paragraphId:a.id,start,end};
  m.selectionChecked=false;
  m.verdict=false;
  setStage(s,pack,STAGES.SELECT);
  for(const node of region.querySelectorAll('[data-sentence], [data-evidence-word]')){
   const sentence=node.hasAttribute('data-sentence');
   const range=sentence?ss[Number(node.dataset.sentence)]:{start:Number(node.dataset.start),end:Number(node.dataset.end)};
   const pending=range.start<end&&range.end>start;
   const green=!pending&&saved.some(e=>e.start<=range.start&&e.end>=range.end);
   const highlighted=pending&&(sentence?!m.shortSpan:m.shortSpan);
   node.classList.toggle('pending',highlighted);
   if(node.hasAttribute('aria-pressed'))node.setAttribute('aria-pressed',String(highlighted));
   node.classList.toggle('verified',green);
   if(sentence)node.classList.toggle('current-verified',green);
  }
  $('guided-primary').disabled=false;
  $('guided-primary').textContent='CHECK MY EVIDENCE';
  save();
 };
 region.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch'){
   touchStart={id:e.pointerId,x:e.clientX,y:e.clientY};
   return;
  }
  e.preventDefault();
  dragging=true;
  pick(e.target);
  try{region.setPointerCapture(e.pointerId);}catch{}
 });
 region.addEventListener('pointermove',e=>{
  if(dragging)pick(document.elementFromPoint(e.clientX,e.clientY));
 });
 region.addEventListener('pointerup',e=>{
  dragging=false;
  if(touchStart?.id!==e.pointerId)return;
  const {x,y}=touchStart;
  touchStart=null;
  if(Math.hypot(e.clientX-x,e.clientY-y)<10)pick(e.target);
 });
 for(const event of ['pointercancel','lostpointercapture'])region.addEventListener(event,e=>{
  dragging=false;
  if(touchStart?.id===e.pointerId)touchStart=null;
 });
 region.querySelectorAll('[role=button]').forEach(e=>e.onkeydown=event=>{
  if(['Enter',' '].includes(event.key)){event.preventDefault();pick(e);}
 });

}
async function gradeRemote(kind,args){const root=document.querySelector('.guided'),selection=current().selection;if(root.dataset.checking)return null;root.dataset.checking='true';try{const r=await readingRequest('check',{id:pack.id,profile:getProfile(),question:qNow().id,kind,...args});return root.isConnected&&(kind!=='evidence'||selection===current().selection)?r:null;}catch(e){if(root.isConnected){current().feedback=e.message;render();}return null;}finally{delete root.dataset.checking;}}
async function verifyEvidence(){const q=qNow(),m=current();if(!m.selection)return;const selection={...m.selection},was=!!s.evidence[q.id];let r;
 if(pack.published){r=await gradeRemote('evidence',{selection,claims:s.evidenceClaims?.[q.id]||[]});if(!r)return;if(r.correct){s.evidenceClaims??={};const claims=s.evidenceClaims[q.id]??=[];if(!claims.some(e=>e.paragraphId===selection.paragraphId&&e.start===selection.start&&e.end===selection.end))claims.push(selection);if(r.complete&&!was)s.evidence[q.id]={...selection,segments:r.segments,independent:!(s.hints[q.id]||s.checks.some(c=>c.question===q.id&&!c.correct))};}}
 else{const match=checkEvidence(pack,q,selection);r=match?claimEvidence(pack,q,s,selection):{correct:false};}
 s.checks.push({question:q.id,...selection,correct:r.correct,at:new Date().toISOString(),hints:s.hints[q.id]||0});m.verdict=r.correct;m.selectionChecked=r.correct;
 if(!r.correct){m.feedback='Keep it yellow. Does this explain what your question asks? Revise your selection or ask for help.';stage(STAGES.EVIDENCE_FEEDBACK);return;}
 m.reviewSaved=false;if(r.complete&&!was)reward('evidence:'+q.id,10,12);m.feedback=r.complete?'✓ You found supporting evidence!':`✓ A useful supporting part (${r.matched}/${r.required}). Keep looking for the rest.`;stage(r.complete?STAGES.READY:STAGES.EVIDENCE_FEEDBACK);
}
async function hint(){const q=qNow(),m=current(),n=s.hints[q.id]||0,selected=words(q.text).filter((_,i)=>s.keywords[q.id]?.selected.includes(i)).map(w=>w.text).join(', ');s.hints[q.id]=n+1;m.feedback=n===0?'Your question clues: '+(selected||'the topic and what you need to find')+'. What are you looking for?':n===1?'What is this question really asking? Think about what you remember reading.':n===2?'Open your Notebook. Which of your paragraph summaries connects with this question?':(pack.published?(await gradeRemote('hint',{}))?.hint||'Think about the question.':q.hints[Math.min(n-2,q.hints.length-1)]);render();}
function overview(notebook){
 const cards=pack.paragraphs.map((a,i)=>{
  const notes=words(a.text).filter(w=>allClues(a.id).includes(w.start)).map(w=>w.text);
  const verified=pack.questions.flatMap((q,n)=>evidenceSegments(s,q.id).filter(e=>e.paragraphId===a.id).map(e=>`<blockquote class="verified">✓ Mission ${n+1}: ${esc(a.text.slice(e.start,e.end))}</blockquote>`));
  if(notebook&&!notes.length&&!verified.length)return '';
  return `<article><button data-paragraph="${i}"><strong>Paragraph ${i+1}</strong><small>${s.visited.includes(a.id)?'Explored':'Not yet explored'}</small></button>${notebook?(notes.length?`<p class="notebook-blue">${esc(notes.join(' · '))}</p>`:'')+verified.join(''):`<p class="whole-story-text">${esc(a.text)}</p>`}</article>`;
 }).join('');
 return `<h2>${notebook?'Look at My Clues':'Whole Story'}</h2><p>Tap a paragraph to open it.</p><div class="paragraph-map">${cards||'<p>Your clues will appear here when you tap words in the story.</p>'}</div>`;
}
function foundAnswer(){beginAnswer(s,pack);render();}
function connectionPanel(q){const a=q.worksheet,m=current();if(q.reflection&&(!activityRequired(q)||s.activities?.[q.id]?.correct)&&!s.reflections[q.id]?.correct)return `<h2>Which answer fits what you found?</h2><p>${esc(q.reflection.prompt)}</p>${choiceButtons(q.reflection.choices,m)}`;if(a?.type==='diagram_label'){const order=m.diagram??=[];return `<h2>Label from outside to center</h2><div class="layer-diagram"><svg viewBox="0 0 200 200" role="img" aria-label="Earth's four layers from outside to center"><circle cx="100" cy="100" r="95" fill="#638bab"/><circle cx="100" cy="100" r="85" fill="#cb7952"/><circle cx="100" cy="100" r="62" fill="#efb44f"/><circle cx="100" cy="100" r="30" fill="#fff2a8"/></svg><ol>${[0,1,2,3].map(i=>`<li><button data-layer-slot="${i}">${order[i]===undefined?'Tap a name':esc(a.choices[order[i]])}</button></li>`).join('')}</ol></div><div class="guided-choices">${[2,0,3,1].map(i=>`<button data-layer="${i}" ${order.includes(i)?'disabled':''}>${esc(a.choices[i])}</button>`).join('')}</div><p>${esc(m.feedback)}</p>`;}return `<h2>Which answer fits what you found?</h2>${choiceButtons(a.choices,m)}`;}
function choiceButtons(choices,m){return `<div class="guided-choices">${choices.map((c,i)=>`<button data-connection="${i}" aria-pressed="${m.answer===i}" class="${m.answer===i?'chosen':''}">${esc(c)}</button>`).join('')}</div><p>${esc(m.feedback||'Use what your green evidence tells you.')}</p>`;}
function connectionReady(q){const m=current();return q.worksheet?.type==='diagram_label'&&!s.activities?.[q.id]?.correct?m.diagram?.length===4:Number.isInteger(m.answer);}
function bindConnection(q){const m=current();document.querySelectorAll('[data-connection]').forEach(b=>b.onclick=()=>{m.answer=Number(b.dataset.connection);render();});document.querySelectorAll('[data-layer]').forEach(b=>b.onclick=()=>{m.diagram??=[];const n=Number(b.dataset.layer);if(m.diagram.length<4&&!m.diagram.includes(n))m.diagram.push(n);render();});document.querySelectorAll('[data-layer-slot]').forEach(b=>b.onclick=()=>{m.diagram=(m.diagram||[]).slice(0,Number(b.dataset.layerSlot));render();});}
async function checkConnection(){const q=qNow(),m=current();let correct;if(activityRequired(q)&&!s.activities?.[q.id]?.correct){const answer=q.worksheet.type==='diagram_label'?m.diagram:m.answer;if(pack.published){const r=await gradeRemote('answer',{answer});if(!r)return;correct=r.correct;s.activities??={};const record=s.activities[q.id]??={initial:correct,attempts:0};record.correct=correct;record.attempts++;}else correct=checkActivity(q,s,answer);}else if(q.reflection&&!s.reflections[q.id]?.correct){if(pack.published){const r=await gradeRemote('reflection',{answer:m.answer});if(!r)return;correct=r.correct;}else correct=m.answer===q.reflection.answer;s.reflections[q.id]??={initial:correct,attempts:0,correct:false};s.reflections[q.id].attempts++;s.reflections[q.id].correct=correct;if(correct)reward('reflection:'+q.id,2);}if(correct){m.answer=null;m.feedback='✓ You connected your clue to its meaning.';s.paperReturn=STAGES.READY;foundAnswer();}else{m.feedback='Look again at your green clues. Try another connection.';if(q.worksheet?.type==='diagram_label')m.diagram=[];render();}}
return {library,open,workshop};}
