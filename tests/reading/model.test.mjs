import {test} from 'node:test';import assert from 'node:assert/strict';
import {STAGES,beginAnswer,ensureGuided,nextMission,setStage,switchMission,visitParagraph} from '../../dist/reading/workflow.js';
import {freshData} from '../../dist/runner/store.js';import {validateHomework,assignHomework,ensureHomework,caseState,checkKeywords,checkEvidence,readingReward,words,sentences} from '../../dist/reading/model.js';import {readingFixture} from './fixture.mjs';
test('source words, pages and exact sentence offsets survive wrapping; invalid and uncertain imports are rejected',()=>{const p=readingFixture();assert.deepEqual(validateHomework(p),[]);for(const a of p.paragraphs)for(const s of sentences(a.text))assert.equal(a.text.slice(s.start,s.end),s.text);assert.ok(validateHomework({...p,uncertainties:['blurry sentence']} ).length);assert.ok(validateHomework({...p,paragraphs:'bad'}).length);const invalid=structuredClone(p);invalid.questions[0].evidence[0].start++;assert.ok(validateHomework(invalid).some(e=>e.includes('exact offsets')));});
test('batch keywords accept semantic groups, discourage selecting everything and never reward clue tapping',()=>{const q=readingFixture().questions[0],ws=words(q.text);assert.equal(checkKeywords(q,ws.map((_,i)=>i)).quality,'broad');const selected=ws.map((w,i)=>['why','beans'].includes(w.text.toLowerCase())?i:-1).filter(i=>i>=0);assert.equal(checkKeywords(q,selected).quality,'focused');assert.equal(checkKeywords(q,[]).reward,false);});
test('phrase keywords are checked in source order regardless of tap order',()=>{const q={text:'How do living things grow?',keywordGroups:[{any:['living things']}]};assert.equal(checkKeywords(q,[3,2]).quality,'focused');});
test('only exact reviewed evidence turns green; one/two adjacent alternatives work and arbitrary overlap does not',()=>{const p=readingFixture(),q=p.questions[0],e=q.evidence[0];assert.ok(checkEvidence(p,q,e));assert.equal(checkEvidence(p,q,{...e,start:e.start+3}),null);assert.equal(checkEvidence(p,q,{...e,start:0,end:p.paragraphs[0].text.length}),null);const ss=sentences(p.paragraphs[0].text);q.evidence.push({paragraphId:'p1',start:ss[0].start,end:ss[1].end,explanation:'Alternate context.'});assert.ok(checkEvidence(p,q,q.evidence[1]));assert.equal(checkEvidence(p,p.questions[2],e),null);});
test('independent homework records, paper acknowledgments, current/past/replay rates and reward IDs persist',()=>{const d=freshData(),p=readingFixture();assignHomework(d,'ari',p);const h=ensureHomework(d,'ari'),s=caseState(h,p);assert.equal(readingReward(d.profiles.ari,h,p,s,'keywords:q1',2),2);assert.equal(readingReward(d.profiles.ari,h,p,s,'keywords:q1',2),0);assert.equal(readingReward(d.profiles.ari,h,p,s,'evidence:q1',10),10);s.completed='now';const replay=caseState(h,p,true);assert.equal(replay.attempt,1);assert.equal(readingReward(d.profiles.ari,h,p,replay,'evidence:q1',10),1);assert.equal(d.profiles.kal.crystals,0);const updated={...structuredClone(p),title:'Changed'};assert.throws(()=>assignHomework(d,'ari',updated),/new pack ID/);assert.equal(JSON.parse(JSON.stringify(h)).cases[p.id][0].completed,'now');});

test('a save paused at the old navigation quiz resumes the investigation',()=>{
 const d=freshData(),pack=readingFixture();
 assignHomework(d,'ari',pack);
 const s=ensureGuided(caseState(ensureHomework(d,'ari'),pack),pack);
 visitParagraph(s,pack,1);
 setStage(s,pack,STAGES.MAIN_IDEA);
 s.transition={from:1,returnStage:STAGES.CLUES,to:2};
 s.mainIdeas.p1={initial:true,correct:true,selected:0,attempts:1};
 const resumed=ensureGuided(JSON.parse(JSON.stringify(s)),pack);
 assert.equal(resumed.paragraph,1);
 assert.equal(resumed.workflowStage,STAGES.CLUES);
 assert.equal(resumed.mainIdeas.p1.correct,true);
});

test('returning to a mission during its main-idea check keeps the completed activity',()=>{
 const d=freshData(),pack=readingFixture();
 assignHomework(d,'ari',pack);
 const s=ensureGuided(caseState(ensureHomework(d,'ari'),pack),pack);
 s.written.q1={selfReported:true};
 s.written.q2={selfReported:true};
 assert.equal(switchMission(s,pack,2),true);
 s.evidence.q3=pack.questions[2].evidence[0];
 s.reflections.q3={correct:true};
 setStage(s,pack,STAGES.CONNECTION);
 beginAnswer(s,pack);
 assert.equal(s.workflowStage,STAGES.MAIN_IDEA);
 assert.equal(switchMission(s,pack,1),true);
 assert.equal(nextMission(s,pack),true);
 assert.equal(s.workflowStage,STAGES.READY);
 beginAnswer(s,pack);
 assert.equal(s.workflowStage,STAGES.MAIN_IDEA);
 assert.equal(s.reflections.q3.correct,true);
});
