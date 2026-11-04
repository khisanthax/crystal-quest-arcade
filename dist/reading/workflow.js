import {checkKeywords,normalize,activityRequired} from './model.js';
export const STAGES=Object.freeze({KEYWORDS:'QUESTION_KEYWORDS',KEYWORD_FEEDBACK:'KEYWORD_FEEDBACK',CLUES:'INVESTIGATE_CLUES',SELECT:'SELECT_EVIDENCE',EVIDENCE_FEEDBACK:'EVIDENCE_FEEDBACK',READY:'MISSION_READY_TO_FINISH',PAPER:'PAPER_ANSWER',COMPLETE:'MISSION_COMPLETE',MAIN_IDEA:'PARAGRAPH_MAIN_IDEA',MAP:'VIEW_ALL',NOTEBOOK:'NOTEBOOK',CONNECTION:'ANSWER_CONNECTION',CASE_COMPLETE:'CASE_COMPLETE'});
const general=new Set(['what','which','who','where','when','how','why','is','are','do','does','the','of','on','a','an']);
export function missionKeywords(q,selected){
 const specific=q.keywordGroups.filter(g=>g.any.some(t=>normalize(t).split(' ').some(w=>!general.has(w))));
 const result=checkKeywords({...q,keywordGroups:specific.length?specific:q.keywordGroups},selected);
 return {...result,accepted:result.quality==='focused'};
}
export function missionState(s,q){
 s.missions??={};return s.missions[q.id]??={stage:s.written[q.id]?STAGES.COMPLETE:s.evidence[q.id]?STAGES.READY:STAGES.KEYWORDS,selection:null,selectionChecked:false,clues:{},feedback:'',location:'keep'};
}
// Additive migration: never replace old learning maps, reward IDs or acknowledgments.
export function ensureGuided(s,pack){
 s.missions??={};for(const q of pack.questions){const m=missionState(s,q),k=s.keywords[q.id];if(!s.guidedVersion&&!pack.published&&k?.checks&&missionKeywords(q,k.selected||[]).accepted){k.accepted=true;if(!s.evidence[q.id]&&!s.written[q.id])m.stage=STAGES.CLUES;}}
 if(!s.guidedVersion){s.mission=Math.max(0,Math.min(pack.questions.length-1,s.mission||0));const legacy=missionState(s,pack.questions[s.mission]);if(s.selection&&pack.paragraphs.some(a=>a.id===s.selection.paragraphId)&&!legacy.selection)legacy.selection={...s.selection};if(s.written[pack.questions[s.mission].id]&&!s.completed){const next=pack.questions.findIndex(q=>!s.written[q.id]);if(next>=0)s.mission=next;}s.paragraph=Math.max(0,Math.min(pack.paragraphs.length-1,s.paragraph||0));const active=missionState(s,pack.questions[s.mission]);s.workflowStage=s.completed?STAGES.CASE_COMPLETE:active.stage;s.guidedVersion=1;}
 s.workflowStage??=missionState(s,pack.questions[s.mission]).stage;
 // Older saves can be waiting on a quiz that used to block Next Paragraph.
 if(s.transition){
  const returnStage=s.transition.returnStage||STAGES.CLUES;
  if(s.workflowStage===STAGES.MAIN_IDEA)setStage(s,pack,returnStage);
  if(s.overviewReturn===STAGES.MAIN_IDEA)s.overviewReturn=returnStage;
  delete s.transition;
 }
 if(s.workflowStage===STAGES.MAIN_IDEA){
  const paragraph=mainIdeaParagraph(s,pack);
  if(!paragraph||s.mainIdeas[paragraph.id]?.correct)finishMainIdea(s,pack);
 }
 return s;
}
export function setStage(s,pack,stage){s.workflowStage=stage;const m=missionState(s,pack.questions[s.mission]);if(![STAGES.MAP,STAGES.NOTEBOOK,STAGES.MAIN_IDEA,STAGES.CASE_COMPLETE].includes(stage))m.stage=stage;}
export function switchMission(s,pack,index){if(!pack.questions[index])return false;const available=index===0||s.written[pack.questions[index-1].id]||s.keywords[pack.questions[index].id]?.checks||s.evidence[pack.questions[index].id];if(!available)return false;s.mission=index;s.workflowStage=missionState(s,pack.questions[index]).stage;return true;}
export function visitParagraph(s,pack,index){if(!pack.paragraphs[index])return; s.paragraph=index;if(!s.visited.includes(pack.paragraphs[index].id))s.visited.push(pack.paragraphs[index].id);setStage(s,pack,STAGES.CLUES);}
export function forwardParagraph(s,pack){
 if(s.paragraph+1<pack.paragraphs.length)visitParagraph(s,pack,s.paragraph+1);
 else setStage(s,pack,STAGES.MAP);
}
export function mainIdeaParagraph(s,pack){
 const evidence=s.evidence[pack.questions[s.mission].id];
 const primary=evidence?.segments?.[0]??evidence;
 return pack.paragraphs.find(paragraph=>paragraph.id===primary?.paragraphId);
}
export function beginAnswer(s,pack){
 const q=pack.questions[s.mission];
 if(!s.evidence[q.id])return;
 if(!canWrite(s,q)){setStage(s,pack,STAGES.CONNECTION);return;}
 const paragraph=mainIdeaParagraph(s,pack);
 if(paragraph&&!s.mainIdeas[paragraph.id]?.correct){
  missionState(s,q).stage=STAGES.READY;
  setStage(s,pack,STAGES.MAIN_IDEA);
 }else finishMainIdea(s,pack);
}
export function finishMainIdea(s,pack){
 const q=pack.questions[s.mission];
 setStage(s,pack,!s.evidence[q.id]?STAGES.CLUES:canWrite(s,q)?STAGES.PAPER:STAGES.CONNECTION);
}
export function canWrite(s,q){return !!s.evidence[q.id]&&(!activityRequired(q)||s.activities?.[q.id]?.correct)&&(!q.reflection||s.reflections[q.id]?.correct);}
export function acknowledgePaper(s,pack){const q=pack.questions[s.mission];if(!canWrite(s,q))return false;const fresh=!s.written[q.id];s.written[q.id]??={selfReported:true,at:new Date().toISOString()};missionState(s,q).completed=s.written[q.id].at;setStage(s,pack,STAGES.COMPLETE);return fresh;}
export function nextMission(s,pack){if(!s.written[pack.questions[s.mission].id])return false;const next=pack.questions.findIndex((q,i)=>i>s.mission&&!s.written[q.id]);if(next>=0){s.mission=next;setStage(s,pack,missionState(s,pack.questions[next]).stage);return true;}return false;}
