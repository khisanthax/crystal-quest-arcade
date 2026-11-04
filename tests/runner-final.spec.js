import {test,expect} from '@playwright/test';
import {freshData,KEY} from '../dist/runner/store.js';
import {newRun} from '../dist/runner/model.js';
test('track powers activate from buttons, remain paused during a break, and rendered scene restores after refresh',async({page},info)=>{
 const d=freshData(),r=newRun('kal','patterns-sky');r.stock={shield:2,dash:2,blast:2};d.profiles.kal.runs[r.packId]=r;await page.addInitScript(({d,key})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(d));},{d,key:KEY});await page.goto('/');await page.screenshot({path:`artifacts/crystal-quest-home-${info.project.name}.png`});await page.clock.install();await page.locator('#choose-kal').tap();await page.locator('#continue-adventure').tap();await page.locator('[data-action="power"]').tap();expect((await page.evaluate(()=>window.crystalQuest.run)).active.kind).toBe('shield');await page.locator('#pause').tap();const time=(await page.evaluate(()=>window.crystalQuest.run)).active.left;await page.clock.runFor(2000);expect((await page.evaluate(()=>window.crystalQuest.run)).active.left).toBe(time);await page.locator('#resume').tap();await page.locator('[data-select="dash"]').tap();await page.locator('[data-action="power"]').tap();expect((await page.evaluate(()=>window.crystalQuest.run)).active.kind).toBe('dash');await page.locator('[data-select="blast"]').tap();await page.locator('[data-action="power"]').tap();expect((await page.evaluate(()=>window.crystalQuest.run)).projectiles).toHaveLength(1);await page.clock.runFor(180);expect((await page.evaluate(()=>window.crystalQuest.run)).projectiles[0].distance).toBeGreaterThan(5);await page.locator('#pause').tap();await page.reload();await page.locator('#choose-kal').tap();await page.locator('#continue-adventure').tap();expect((await page.evaluate(()=>window.crystalQuest)).webgl).toBe(true);expect((await page.evaluate(()=>window.crystalQuest.run)).stock.blast).toBe(1);
});
test('the single cached runner launches offline without fetching a game engine from a CDN',async({page,context,browserName,baseURL})=>{
 test.skip(browserName==='webkit','Windows WebKit harness does not expose service workers.');const external=[];page.on('request',r=>{if(!r.url().startsWith(baseURL+'/')&&!r.url().startsWith('data:'))external.push(r.url());});await page.goto('/');await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await context.setOffline(true);await page.reload();await expect(page.locator('#choose-ari')).toBeVisible();await page.locator('#choose-ari').tap();await page.locator('#new-run').tap();await page.locator('#map-next').tap();expect((await page.evaluate(()=>window.crystalQuest)).webgl).toBe(true);await page.locator('#pause').tap();await page.locator('#home').tap();await page.locator('#choose-kal').tap();await page.locator('#practice').tap();await page.locator('#all').tap();await expect(page.locator('#speak')).toBeVisible();expect(external).toEqual([]);await context.setOffline(false);
});
test('sky diagrams label sunrise east and sunset west during practice',async({page})=>{
 const d=freshData(),r=newRun('kal','patterns-sky');r.mode='question';r.pending={reason:'gate',packId:r.packId,keys:['east','west'],index:0,attempt:0,solved:false,begun:false,order:[]};d.profiles.kal.runs[r.packId]=r;await page.addInitScript(({d,key})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(d));},{d,key:KEY});await page.goto('/');await page.locator('#choose-kal').tap();await page.locator('#continue-adventure').tap();await expect(page.locator('.question-art')).toContainText('Sunrise');await page.locator('[data-choice="0"]').tap();await page.locator('#question-next').tap();await expect(page.locator('.question-art')).toContainText('Sunset');await expect(page.locator('.question-art')).toContainText('WEST');
});

test('collecting a track crystal removes it once and creates visible sparkle state',async({page})=>{
 await page.goto('/');
 await page.clock.install();
 await page.clock.pauseAt(new Date(Date.now()+1000));
 await page.locator('#choose-kal').tap();
 await page.locator('#new-run').tap();
 await page.locator('#map-next').tap();
 const run=()=>page.evaluate(()=>window.crystalQuest.run);
 let collected=false;
 for(let i=0;i<90;i++){
  const before=await run(),next=before.groups.find(g=>!g.passed);
  if(next){
   for(let lane=before.player.lane;lane<next.safe;lane++)await page.keyboard.press('ArrowRight');
   for(let lane=before.player.lane;lane>next.safe;lane--)await page.keyboard.press('ArrowLeft');
  }
  await page.clock.runFor(100);
  const first=await run();
  if(!first.crystals)continue;
  const taken=first.gems.filter(g=>g.taken);
  expect(taken.length).toBeGreaterThan(0);
  expect(first.crystals).toBe(taken.reduce((total,g)=>total+(g.rare?5:1),0));
  expect(first.bursts.length).toBeGreaterThan(0);
  const takenIds=new Set(taken.map(g=>g.id));
  await page.clock.runFor(60);
  const after=await run();
  const newlyTaken=after.gems.filter(g=>g.taken&&!takenIds.has(g.id));
  expect(after.crystals-first.crystals).toBe(newlyTaken.reduce((total,g)=>total+(g.rare?5:1),0));
  collected=true;
  break;
 }
 expect(collected).toBe(true);
});
