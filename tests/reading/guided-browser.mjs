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
export async function paperMission(page,q,wrong=false){await page.locator('[data-primary]').tap();if(q.worksheet?.type==='diagram_label'){if(wrong){for(const n of [1,0,2,3])await page.locator(`[data-layer="${n}"]`).tap();await page.locator('[data-primary]').tap();}for(const n of q.worksheet.order)await page.locator(`[data-layer="${n}"]`).tap();await page.locator('[data-primary]').tap();}else if(q.worksheet&&q.worksheet.type!=='short_answer'){if(wrong){await page.locator(`[data-connection="${(q.worksheet.answer+1)%q.worksheet.choices.length}"]`).tap();await page.locator('[data-primary]').tap();}await page.locator(`[data-connection="${q.worksheet.answer}"]`).tap();await page.locator('[data-primary]').tap();}if(q.reflection){await page.locator(`[data-connection="${q.reflection.answer}"]`).tap();await page.locator('[data-primary]').tap();}await expect(page.locator('[data-primary]')).toHaveText('I WROTE MY ANSWER');await expect(page.locator('.parchment')).toContainText('homework sheet');await oneAction(page);await page.locator('[data-primary]').tap();await expect(page.locator('[data-primary]')).toHaveText(/CHECK MY KEYWORDS|BACK TO CASES/);}
