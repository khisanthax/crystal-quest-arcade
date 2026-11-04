import {sentences,validateHomework} from './model.js';
// The worksheet interchange format uses quote offsets, often inside sentences.
// Runtime highlights select whole sentences; retain the original mapping for audit.
export function convertWorksheet(source){
 if(source?.format!=='crystal-quest-reading-detective')return source;
 if(source.schema_version!==1)throw Error('Unsupported worksheet interchange version.');
 const p={schemaVersion:1,id:source.id,title:source.title,reviewRequired:!!source.requires_parent_review||!source.ready_for_assignment,uncertainties:source.requires_parent_review?[source.parent_review_warning||source.source_note||'Adapted passage: compare with a clear original before assigning.']:[],paragraphs:source.passage_paragraphs.map(a=>({id:a.id,text:a.text,mainIdea:{prompt:a.main_idea_check.prompt,choices:a.main_idea_check.choices,answer:a.main_idea_check.correct_index}})),questions:[],importMetadata:structuredClone(source)};
 for(const q of source.questions){
  const evidence=[];const groups=q.valid_evidence_groups.map(group=>group.map(e=>{
   const a=p.paragraphs.find(a=>a.id===e.paragraph_id);if(!a)throw Error(`${q.id}: unknown paragraph ${e.paragraph_id}.`);
   const start=a.text.indexOf(e.quote);if(start<0||a.text.indexOf(e.quote,start+1)>=0)throw Error(`${q.id}: evidence quote must occur exactly once in ${a.id}.`);
   const end=start+e.quote.length,ss=sentences(a.text),included=ss.filter(s=>s.end>start&&s.start<end);
   if(!included.length||included.length>2)throw Error(`${q.id}: choose one or two adjacent supporting sentences.`);
   const span={paragraphId:a.id,start:included[0].start,end:included.at(-1).end,explanation:'This passage supports part of what the question asks.',sourceQuote:e.quote,quoteStart:start,quoteEnd:end};
   const key=evidence.findIndex(x=>x.paragraphId===span.paragraphId&&x.start===span.start&&x.end===span.end);if(key>=0)return key;evidence.push(span);return evidence.length-1;
  }));
  const activity={type:q.type,choices:q.choices,answer:q.correct_index,parentGuidance:q.answer_guidance_parent_only,notes:q.notes};
  if(q.type==='diagram_label'){activity.choices=['Crust','Mantle','Outer core','Inner core'];activity.order=[0,1,2,3];}
  p.questions.push({id:q.id,text:q.prompt,keywordGroups:q.question_keywords.map(t=>({any:[t]})),evidence,evidenceGroups:groups,hints:Object.values(q.hints),worksheet:activity,requirePaperAnswer:q.require_paper_answer});
 }
 const errors=validateHomework({...p,reviewRequired:false,uncertainties:[]});if(errors.length)throw Error(errors.join('\n'));return p;
}
