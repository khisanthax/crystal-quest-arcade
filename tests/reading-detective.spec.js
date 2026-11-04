import {keywordStep,proveQuestion,paperMission} from './reading/guided-browser.mjs';
import {test,expect} from '@playwright/test';
import {freshData,KEY} from '../dist/runner/store.js';import {assignHomework} from '../dist/reading/model.js';import {readingFixture} from './reading/fixture.mjs';import {adopt} from '../dist/runner/collection.js';
test('camera permission is requested only by Scan; denial keeps same-device PNG recovery available',async({page})=>{await page.addInitScript(()=>{window.cameraRequests=0;Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>{window.cameraRequests++;throw new DOMException('Denied','NotAllowedError');}},configurable:true});});await page.goto('/');await page.locator('#explorer-home').tap();await page.locator('#explorer-recover').tap();expect(await page.evaluate(()=>window.cameraRequests)).toBe(0);await page.locator('#camera-passport').tap();await expect(page.locator('#recovery-message')).toContainText('Photos or Files');expect(await page.evaluate(()=>window.cameraRequests)).toBe(1);await expect(page.locator('#choose-passport')).toBeVisible();});
const state=p=>p.evaluate(()=>window.crystalQuest);
const primary=page=>page.locator('[data-primary]');
const wallet=page=>page.locator('.reading-status b').innerText();
async function continueCase(page){
 await page.locator('#choose-ari').tap();
 await page.locator('#reading-play').tap();
 await page.locator('#continue-case').tap();
}
async function seed(page){
 const d=freshData();
 adopt(d.profiles.ari,'fox',true);
 assignHomework(d,'ari',readingFixture());
 await page.addInitScript(({d,KEY})=>{
  if(!localStorage.getItem(KEY))localStorage.setItem(KEY,JSON.stringify(d));
 },{d,KEY});
 await page.goto('/');
 await continueCase(page);
}
test('three illustrated modes and the empty case library fit iPad landscape without fabricated homework',async({page},info)=>{await page.goto('/');for(const id of ['ari','kal']){await page.locator('#choose-'+id).tap();await expect(page.locator('.mode-card')).toHaveCount(3);for(const size of [{width:1024,height:768},{width:1194,height:834},{width:844,height:390}]){await page.setViewportSize(size);for(const selector of ['#new-run','#original-play','#reading-play']){const b=await page.locator(selector).boundingBox();expect(b.height).toBeGreaterThanOrEqual(44);expect(b.y+b.height).toBeLessThanOrEqual(size.height+1);}await page.screenshot({path:info.outputPath(`reading-modes-${id==='ari'?'emberia':'luminara'}-${size.width}-${info.project.name}.png`)});}await page.locator('#reading-play').tap();await expect(page.locator('.case-empty')).toContainText('No homework has been invented');await page.locator('#reading-back').tap();await page.locator('#home').tap();}});
test('seven fictional missions preserve retries, optional keywords, evidence, pets and paper progress',async({page},info)=>{
 const pack=readingFixture();
 await seed(page);
 for(const q of pack.questions){
  if(q.id==='q2'){
   await expect(page.locator('[data-keyword][aria-pressed=true]')).toHaveCount(0);
   const before=await wallet(page);
   await primary(page).tap();
   await expect(primary(page)).toHaveText('DONE FINDING CLUES');
   expect(await wallet(page)).toBe(before);
  }else await keywordStep(page,q);

  if(q.id==='q1'){
   await primary(page).tap();
   await page.locator('[data-sentence="0"]').tap();
   await primary(page).tap();
   await expect(page.locator('#evidence-feedback')).toContainText('Keep it yellow');
   await expect(page.locator('[data-sentence="0"].pending')).toBeVisible();
   await page.locator('#guided-back').tap();
  }
  if(q.id==='q3'){
   await page.locator('#next-paragraph').tap();
   await expect(page.getByRole('heading',{name:'What was this paragraph mostly about?'})).toBeVisible();
   await page.locator('[data-main-idea="1"]').tap();
   await expect(page.locator('.guided-scroll')).toContainText('whole paragraph');
   await page.locator('[data-main-idea="0"]').tap();
   await expect(page.locator('.passage-heading')).toContainText('Paragraph 2');
   await page.locator('#previous-paragraph').tap();
   await page.locator('#next-paragraph').tap();
   await expect(page.locator('.passage-heading')).toContainText('Paragraph 2');
  }
  if(q.id==='q4'){
   await page.locator('[data-clue]').first().tap();
   await expect(page.locator('.clue-word.clued')).toHaveCount(1);
   await page.reload();
   await continueCase(page);
   await expect(page.locator('.guided')).toHaveAttribute('data-mission','q4');
   await expect(page.locator('.passage-heading')).toContainText('Paragraph 2');
   await expect(page.locator('.clue-word.clued')).toHaveCount(1);
  }

  await proveQuestion(page,pack,q);
  if(q.id==='q1'){
   const before=await wallet(page);
   await page.locator('#keep-looking').tap();
   await expect(page.locator('.current-verified')).toBeVisible();
   await proveQuestion(page,pack,q);
   expect(await wallet(page)).toBe(before);
  }
  await paperMission(page,q,q.id==='q7');
 }

 await expect(page.getByRole('heading',{name:'Case closed!'})).toBeVisible();
 await expect(page.locator('.reading-status')).toContainText('7/7 written');
 await page.screenshot({path:info.outputPath('seven-missions-complete.png')});
 const before=await wallet(page);
 await page.reload();
 await continueCase(page);
 await expect(page.getByRole('heading',{name:'Case closed!'})).toBeVisible();
 expect(await wallet(page)).toBe(before);
 const player=(await state(page)).data.profiles.ari;
 expect(player.collection.pets[0].species).toBe('fox');
 const completed=Object.values(player.homework.cases[pack.id][0].written);
 expect(completed).toHaveLength(7);
 expect(completed.every(x=>x.selfReported)).toBe(true);
});
