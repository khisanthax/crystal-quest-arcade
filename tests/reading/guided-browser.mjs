import {expect} from '@playwright/test';
import {words,sentences} from '../../dist/reading/model.js';
export const state=p=>p.evaluate(()=>window.crystalQuest);
export async function oneAction(page){
 await expect.poll(()=>page.evaluate(()=>{
  const actions=[...document.querySelectorAll('[data-primary]')];
  return actions.length<=1&&actions.every(action=>{
   const box=action.getBoundingClientRect();
   return box.height>=43.99&&box.top>=-0.01&&box.bottom<=innerHeight+0.01;
  });
 }),{message:'At most one primary action is visible and at least 44 pixels tall'}).toBe(true);
}
export async function keywordStep(page,q){await oneAction(page);await expect(page.locator('[data-primary]')).toHaveText('CHECK MY KEYWORDS');const ws=words(q.text),indices=ws.map((w,i)=>q.keywordGroups.some(g=>g.any.some(t=>t.toLowerCase().split(' ').includes(w.text.toLowerCase())))?i:-1).filter(i=>i>=0);for(const i of indices)await page.locator(`[data-keyword="${i}"]`).tap();await expect(page.locator(".question-word.chosen")).toHaveCount(indices.length);await page.locator('[data-primary]').tap();await expect(page.locator('[data-primary]')).toHaveText('DONE FINDING CLUES');}
export async function navigate(page,index){await page.locator('#full-source').tap();await page.locator(`[data-paragraph="${index}"]`).tap();await expect(page.locator('[data-primary]')).toHaveText('DONE FINDING CLUES');}
export async function selectSpan(page,pack,e){const pi=pack.paragraphs.findIndex(a=>a.id===e.paragraphId);await navigate(page,pi);await page.locator('[data-primary]').tap();const ss=sentences(pack.paragraphs[pi].text),first=ss.findIndex(x=>x.start===e.start),last=ss.findIndex(x=>x.end===e.end);await page.locator(`[data-sentence="${first}"]`).tap();if(last!==first)await page.locator(`[data-sentence="${last}"]`).tap();await page.locator('[data-primary]').tap();await oneAction(page);}
export async function proveQuestion(page,pack,q){for(const i of q.evidenceGroups?.[0]||[0])await selectSpan(page,pack,q.evidence[i]);await expect(page.locator('[data-primary]')).toHaveText('YES, I FOUND IT!');}
export const mainIdeaHeading=page=>page.getByRole('heading',{name:'What was this paragraph mostly about?'});
export async function answerMainIdea(page,mainIdea,wrong=false){
 await expect(mainIdeaHeading(page)).toBeVisible();
 const choices=page.locator('[data-main-idea]');
 await expect(choices).toHaveText(mainIdea.choices);
 if(wrong){
  await choices.nth((mainIdea.answer+1)%mainIdea.choices.length).tap();
  await expect(page.locator('.guided-scroll')).toContainText('whole paragraph');
 }
 await choices.nth(mainIdea.answer).tap();
 await expect(mainIdeaHeading(page)).toHaveCount(0);
}
export async function paperMission(page,q,{mainIdea,wrong=false,wrongMainIdea=false}={}){
 const action=page.locator('[data-primary]');
 await expect(action).toHaveText('YES, I FOUND IT!');
 await action.tap();
 if(q.worksheet?.type==='diagram_label'){
  if(wrong){
   for(const n of [1,0,2,3])await page.locator(`[data-layer="${n}"]`).tap();
   await action.tap();
  }
  for(const n of q.worksheet.order)await page.locator(`[data-layer="${n}"]`).tap();
  await action.tap();
 }else if(q.worksheet&&q.worksheet.type!=='short_answer'){
  if(wrong){
   await page.locator(`[data-connection="${(q.worksheet.answer+1)%q.worksheet.choices.length}"]`).tap();
   await action.tap();
  }
  await page.locator(`[data-connection="${q.worksheet.answer}"]`).tap();
  await action.tap();
 }
 if(q.reflection){
  await page.locator(`[data-connection="${q.reflection.answer}"]`).tap();
  await action.tap();
 }
 if(mainIdea)await answerMainIdea(page,mainIdea,wrongMainIdea);
 else await expect(mainIdeaHeading(page)).toHaveCount(0);
 await expect(action).toHaveText('I WROTE MY ANSWER');
 await expect(page.locator('.parchment')).toContainText('homework sheet');
 await oneAction(page);
 await action.tap();
 await expect(action).toHaveText(/CHECK MY KEYWORDS|BACK TO CASES/);
}
