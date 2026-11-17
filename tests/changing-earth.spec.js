import {test,expect} from '@playwright/test';
import {question} from '../dist/changing-earth/content.js';
import {freshData,KEY} from '../dist/runner/store.js';
import {adopt,collection} from '../dist/runner/collection.js';
import {readFile} from 'node:fs/promises';

async function enter(page,id='ari'){
 await page.goto('/');await page.locator('#choose-'+id).tap();await page.locator('#earth-play').tap();
 await expect(page.getByRole('heading',{name:'A little adventure. A changing world.'})).toBeVisible();
 // Finish first-install cache activation before deliberately refreshing a run.
 // Windows WebKit exposes the API even when its worker process is unavailable.
 await page.evaluate(async()=>{if(navigator.serviceWorker)await Promise.race([navigator.serviceWorker.ready,new Promise(resolve=>setTimeout(resolve,4000))]);});
}
async function walkToGate(page){
 await page.keyboard.down('ArrowRight');
 for(let i=0;i<8&&await page.locator('#earth-scene').count();i++){
  await page.keyboard.press('Space');await page.clock.runFor(2200);
 }
 await page.keyboard.up('ArrowRight');await expect(page.locator('[data-challenge]')).toBeVisible();
}
async function choose(page,q,answer=q.answer){await page.locator(`[data-earth-answer="${answer}"]`).tap();if(q.type==='match')await page.locator('#earth-definition').tap();await page.locator('#earth-check').tap();}
test('Changing Earth is a full five-zone adventure with every interaction, retries, saved mastery and adaptive replay',async({page},info)=>{
 test.setTimeout(300000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const d=freshData();for(const p of Object.values(d.profiles))collection(p);adopt(d.profiles.ari,'dog',true);
 await page.addInitScript(({d,KEY})=>{if(!localStorage.getItem(KEY))localStorage.setItem(KEY,JSON.stringify(d));},{d,KEY});
 await enter(page);await page.clock.install();await page.locator('#earth-start').tap();
 await expect(page.locator('.earth-pet')).toBeVisible();await expect(page.locator('#earth-scene')).toBeVisible();
 const seen=new Set(),retry=new Set();let count=0;
 for(let zone=0;zone<5;zone++){
  await walkToGate(page);
  while(await page.locator('[data-challenge]').count()){
   const id=await page.locator('[data-question]').getAttribute('data-question'),q=question(id);seen.add(q.type);count++;
   if(!retry.has(q.type)){
    await page.setViewportSize({width:844,height:390});
    await expect(page.locator('#earth-check')).toBeInViewport({ratio:1});
    for(const button of await page.locator('[data-earth-answer]').all())await expect(button).toBeInViewport({ratio:1});
    await page.screenshot({path:info.outputPath('earth-short-'+q.type+'.png')});
    const wrong=q.choices.find(c=>c.id!==q.answer).id;await choose(page,q,wrong);await expect(page.locator('#earth-feedback')).toHaveClass(/hint/);await expect(page.locator('#earth-feedback')).toContainText(q.hint);await expect(page.locator('#earth-check')).toBeDisabled();retry.add(q.type);
    await expect(page.locator('#earth-feedback')).toBeInViewport({ratio:1});await expect(page.locator('#earth-check')).toBeInViewport({ratio:1});
    await page.screenshot({path:info.outputPath('earth-short-hint-'+q.type+'.png')});
    await page.setViewportSize({width:1180,height:820});
   }
   await choose(page,q);await expect(page.locator('[data-effect]')).toHaveClass(/activated/);await expect(page.locator('#earth-feedback')).toContainText(q.explanation);await expect(page.locator('#earth-next')).toBeInViewport({ratio:1});
   if(zone===0&&count===1){
    const before=await page.locator('#earth-wallet').innerText();await page.screenshot({path:info.outputPath('volcano-crystal-charged.png')});
    await page.reload();await page.locator('#choose-ari').tap();await page.locator('#earth-play').tap();await page.locator('#earth-continue').tap();await expect(page.locator('#earth-next')).toBeVisible();expect(await page.locator('#earth-wallet').innerText()).toBe(before);
   }
   await page.locator('#earth-next').tap();
  }
  if(zone<4){await expect(page.locator('#earth-zone-next')).toBeVisible();await page.locator('#earth-zone-next').tap();}
 }
 await expect(page.getByRole('heading',{name:'One last crystal challenge!'})).toBeVisible();await page.locator('#earth-zone-next').tap();
 for(let i=0;i<9;i++){const q=question(await page.locator('[data-question]').getAttribute('data-question'));await choose(page,q);await page.locator('#earth-next').tap();}
 await expect(page.getByRole('heading',{name:'You restored the Earth Crystal!'})).toBeVisible();await expect(page.locator('.earth-mastery-grid article')).toHaveCount(8);expect(seen.size).toBe(8);expect(retry.size).toBe(8);
 const s=await page.evaluate(()=>window.crystalQuest);expect(s.data.profiles.ari.changingEarth.active.phase).toBe('summary');expect(s.data.profiles.ari.collection.wallet).toBeGreaterThan(0);expect(s.data.profiles.ari.collection.wallet).toBeLessThanOrEqual(60);expect(s.data.profiles.kal.changingEarth).toBeUndefined();expect(s.data.profiles.kal.collection.wallet).toBe(0);expect(s.data.profiles.ari.collection.pets[0].xp).toBeGreaterThan(0);
 await page.screenshot({path:info.outputPath('earth-mastery-complete.png')});
 await page.locator('#earth-again').tap();await expect(page.locator('#earth-scene')).toBeVisible();await page.locator('#earth-back').tap();await expect(page.locator('.mode-card')).toHaveCount(3);expect(await page.evaluate(()=>window.crystalQuest.renderingRunner)).toBe(true);expect(errors).toEqual([]);
});

test('touch movement+jump, cancellation, pause, guide and both profile entrances fit landscape viewports',async({page},info)=>{
 await enter(page,'kal');await page.clock.install();
 for(const size of [{width:1024,height:768},{width:1180,height:820},{width:1366,height:1024},{width:844,height:390}]){
  await page.setViewportSize(size);for(const id of ['earth-start','earth-back'])await expect(page.locator('#'+id)).toBeInViewport({ratio:1});
 }
 await page.locator('#earth-start').tap();
 await page.clock.runFor(100);const initial=await page.evaluate(()=>window.crystalQuest.earthPlayer);
 const right=page.locator('#right');await right.dispatchEvent('pointerdown',{pointerId:9,pointerType:'touch',isPrimary:true});await page.locator('#jump').dispatchEvent('pointerdown',{pointerId:10,pointerType:'touch',isPrimary:false});await page.clock.runFor(250);await expect(right).toHaveClass(/held/);
 const moving=await page.evaluate(()=>window.crystalQuest.earthPlayer);expect(moving.x).toBeGreaterThan(initial.x+20);expect(moving.y).toBeLessThan(initial.y-10);
 await right.dispatchEvent('pointercancel',{pointerId:9,pointerType:'touch'});await page.locator('#jump').dispatchEvent('pointercancel',{pointerId:10,pointerType:'touch'});await expect(right).not.toHaveClass(/held/);
 const stopped=await page.evaluate(()=>window.crystalQuest.earthPlayer.x);await page.clock.runFor(250);expect(await page.evaluate(()=>window.crystalQuest.earthPlayer.x)).toBeCloseTo(stopped,1);
 // Visit another profile, then back out of this one's intro without resuming.
 // Opening a menu must not copy the previous explorer's canvas position.
 await page.locator('#earth-back').tap();await page.locator('#home').tap();await page.locator('#choose-ari').tap();await page.locator('#earth-play').tap();await page.locator('#earth-start').tap();await page.clock.runFor(200);await page.locator('#earth-back').tap();await page.locator('#home').tap();await page.locator('#choose-kal').tap();await page.locator('#earth-play').tap();await page.locator('#earth-back').tap();expect(await page.evaluate(()=>window.crystalQuest.data.profiles.kal.changingEarth.active.position)).toBeCloseTo(stopped,1);await page.locator('#earth-play').tap();await page.locator('#earth-continue').tap();
 await page.locator('#earth-pause').tap();await expect(page.locator('#earth-resume')).toBeVisible();await page.locator('#earth-resume').tap();
 await page.setViewportSize({width:768,height:1024});await expect(page.locator('#rotate')).toBeVisible();await page.setViewportSize({width:844,height:390});await expect(page.locator('#earth-resume')).toBeVisible();await page.locator('#earth-resume').tap();
 await walkToGate(page);
 for(const size of [{width:1024,height:768},{width:1180,height:820},{width:844,height:390}]){
  await page.setViewportSize(size);const q=question(await page.locator('[data-question]').getAttribute('data-question'));
  for(const b of await page.locator('[data-earth-answer]').all()){await expect(b).toBeInViewport({ratio:1});const box=await b.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);}
  await expect(page.locator('#earth-check')).toBeInViewport({ratio:1});await page.screenshot({path:info.outputPath('earth-challenge-'+size.width+'.png')});
 }
 await page.locator('#earth-help').tap();await expect(page.getByRole('heading',{name:'Changing Earth Field Guide'})).toBeVisible();await page.locator('#earth-guide-back').tap();await expect(page.locator('[data-challenge]')).toBeVisible();
 const pending=question(await page.locator('[data-question]').getAttribute('data-question'));await choose(page,pending,pending.choices.find(c=>c.id!==pending.answer).id);
 await page.reload();await page.locator('#choose-kal').tap();await page.locator('#earth-play').tap();await page.locator('#earth-continue').tap();await expect(page.locator('#earth-feedback')).toContainText(pending.hint);await choose(page,pending);
 const record=await page.evaluate(id=>window.crystalQuest.data.profiles.kal.changingEarth.learning.questions[id],pending.id);expect(record.firstCorrect).toBe(0);expect(record.laterCorrect).toBe(1);
 await page.locator('#earth-back').tap();await page.locator('#home').tap();await page.locator('#choose-ari').tap();await page.locator('#earth-play').tap();await expect(page.locator('#earth-continue')).toBeVisible();
});

test('an Explorer plays Changing Earth and its learning rewards actually sync and resume in the cloud',async({page,baseURL})=>{
 test.setTimeout(80000);const username='qa_earth_'+Date.now().toString(36),key=(await readFile('.local/maintenance-key','utf8')).trim();let account;
 const post=(path,data,headers={})=>page.request.post('/api/'+path,{headers:{Origin:baseURL,...headers},data});
 try{
  const signed=await post('signup',{username,pin:'5682'},{'CF-Connecting-IP':'198.51.100.213'});expect(signed.ok(),await signed.text()).toBe(true);account=(await signed.json()).account;
  await enter(page);await page.locator('#earth-start').tap();await page.keyboard.down('ArrowRight');await page.keyboard.press('Space');await expect(page.locator('[data-challenge]')).toBeVisible({timeout:20000});await page.keyboard.up('ArrowRight');
  const q=question(await page.locator('[data-question]').getAttribute('data-question'));await choose(page,q);
  await expect(page.locator('#sync-status')).toHaveText('Saved to cloud',{timeout:15000});
  const saved=await(await page.request.get('/api/me')).json();expect(saved.data.profiles.ari.changingEarth.learning.questions[q.id].firstCorrect).toBe(1);expect(saved.data.profiles.ari.collection.wallet).toBeGreaterThan(0);expect(saved.data.profiles.kal.changingEarth).toBeUndefined();
  const wallet=await page.locator('#earth-wallet').innerText();await page.reload();await page.locator('#choose-ari').tap();await page.locator('#earth-play').tap();await page.locator('#earth-continue').tap();await expect(page.locator('#earth-next')).toBeVisible();expect(await page.locator('#earth-wallet').innerText()).toBe(wallet);
 }finally{if(account)expect((await post('admin',{action:'delete-qa',username,accountId:account.id},{'x-cq-admin-key':key})).ok()).toBe(true);}
});
