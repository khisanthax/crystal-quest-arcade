import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {freshData,KEY,history} from '../dist/runner/store.js';
import {newRun} from '../dist/runner/model.js';
const state=p=>p.evaluate(()=>window.crystalQuest);
async function start(p,id){await p.goto('/');await p.clock.install();await p.locator('#choose-'+id).tap();await p.locator('#new-run').tap();await p.locator('#map-next').tap();await p.clock.runFor(100);}
async function answer(p,wrong=false){let s=await state(p),pending=s.question,q=s.data.packs[pending.packId].questions.find(q=>q.id===pending.keys[pending.index]);if(pending.reward){await p.locator('[data-reward="shield"]').tap();return;}if(!pending.solved){if(wrong&&q.type!=='order'){await p.locator(`[data-choice]:not([data-choice="${q.answer}"])`).first().tap();s=await state(p);expect(s.question.attempt).toBe(1);}if(q.type==='order'){for(const id of q.answer)await p.locator(`[data-choice="${id}"]`).tap();}else await p.locator(`[data-choice="${q.answer}"]`).tap();}await p.locator('#question-next').tap();}

test('both third-person worlds render, run automatically, accept smooth swipes, buttons, jump and slide',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await start(page,'ari');expect((await state(page)).webgl).toBe(true);expect((await state(page)).camera.type).toBe('PerspectiveCamera');expect((await state(page)).camera.position[2]).toBeGreaterThan(0);await mkdir('artifacts',{recursive:true});await page.screenshot({path:`artifacts/crystal-runner-volcano-${info.project.name}.png`});
 const before=(await state(page)).run;await page.locator('[data-action="right"]').tap();const switched=(await state(page)).run;expect(switched.player.lane).toBe(before.player.lane+1);expect(switched.player.x).toBeLessThan(switched.player.lane);await page.clock.runFor(250);expect((await state(page)).run.distance).toBeGreaterThan(before.distance);await page.locator('[data-action="jump"]').tap();await page.clock.runFor(150);expect((await state(page)).run.player.y).toBeGreaterThan(.5);await page.clock.runFor(1500);await page.locator('[data-action="slide"]').tap();await page.clock.runFor(80);expect((await state(page)).run.player.slide).toBeGreaterThan(0);
 await page.locator('#pause').tap();const paused=(await state(page)).run;await page.clock.runFor(1500);expect((await state(page)).run.distance).toBe(paused.distance);await page.locator('#home').tap();await page.locator('#choose-kal').tap();await page.locator('#new-run').tap();await page.locator('#map-next').tap();await page.clock.runFor(100);expect((await state(page)).run.settings.lanes).toBe(4);await page.screenshot({path:`artifacts/crystal-runner-cosmic-${info.project.name}.png`});const lane=(await state(page)).run.player.lane;
 await page.locator('#scene').dispatchEvent('pointerdown',{pointerId:21,clientX:400,clientY:350});await page.locator('#scene').dispatchEvent('pointermove',{pointerId:21,clientX:330,clientY:350});await page.locator('#scene').dispatchEvent('pointerup',{pointerId:21,clientX:330,clientY:350});expect((await state(page)).run.player.lane).toBe(lane-1);await page.locator('[data-action="right"]').dispatchEvent('pointerdown',{pointerId:9});await page.locator('[data-action="right"]').dispatchEvent('pointercancel',{pointerId:9});expect((await state(page)).held).toBe(0);expect(errors).toEqual([]);
});

async function steer(p,lane){const r=(await state(p)).run;for(let i=r.player.lane;i<lane;i++)await p.keyboard.press('ArrowRight');for(let i=r.player.lane;i>lane;i--)await p.keyboard.press('ArrowLeft');}
async function seed(p,data){await p.addInitScript(({key,data})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(data));},{key:KEY,data});}
for(const id of ['ari','kal'])test(`${id==='ari'?'Emberia':'Luminara'} completes a full three-stage runner through real controls and questions`,async({page},info)=>{
 // A short landscape viewport and reduced motion keep software WebGL responsive for this long playthrough.
 await page.setViewportSize({width:844,height:390});
 await page.emulateMedia({reducedMotion:'reduce'});
 const d=freshData();d.profiles[id].settings.interval=2;await seed(page,d);await start(page,id);await page.clock.pauseAt(new Date(Date.now()+1000));let won=false,questions=0,stages=new Set();
 for(let i=0;i<900;i++){
  const s=await page.evaluate(()=>{
   const {mode,run}=window.crystalQuest;
   return {mode,stage:run.stage,lane:run.player.lane,safe:run.groups.find(g=>!g.passed)?.safe};
  });
  if(s.mode==='victory'){won=true;break;}
  if(s.mode==='question'){questions++;await answer(page);continue;}
  if(s.mode==='reward'){await page.locator('[data-reward="blast"]').tap();continue;}
  if(s.mode==='stage'){stages.add(s.stage);await page.locator('#next-stage').tap();continue;}
  expect(s.mode).toBe('play');
  if(s.safe!==undefined){
   for(let lane=s.lane;lane<s.safe;lane++)await page.keyboard.press('ArrowRight');
   for(let lane=s.lane;lane>s.safe;lane--)await page.keyboard.press('ArrowLeft');
  }
  await page.clock.runFor(650);
 }
 expect(won).toBe(true);expect([...stages]).toEqual([0,1,2]);expect(questions).toBeGreaterThanOrEqual(12);const s=await state(page);expect(s.run.crystals).toBeGreaterThan(0);expect(s.data.profiles[id].rewards.filter(r=>r.kind==='stage')).toHaveLength(3);expect(s.data.profiles[id].sessions).toBe(1);await page.screenshot({path:`artifacts/crystal-runner-victory-${id}-${info.project.name}.png`});await page.reload();await page.locator('#choose-'+id).tap();await page.locator('#continue-adventure').tap();expect((await state(page)).mode).toBe('victory');
});

test('losing hearts triggers one paused question; retry restores three hearts without false mastery',async({page})=>{
 const d=freshData(),r=newRun('kal','patterns-sky',{},21);r.hearts=1;d.profiles.kal.runs[r.packId]=r;await seed(page,d);await page.goto('/');await page.clock.install();await page.locator('#choose-kal').tap();await page.locator('#continue-adventure').tap();let triggered=false;
 for(let i=0;i<250;i++){const s=await state(page);if(s.mode==='question'){expect(s.question.reason).toBe('hearts');triggered=true;break;}const group=s.run.groups.find(g=>!g.passed&&g.obstacles.length);if(group)await steer(page,group.obstacles[0].lane);await page.clock.runFor(250);}
 expect(triggered).toBe(true);const before=(await state(page)).run;expect(before.hearts).toBe(0);await expect(page.locator('#controls')).toBeHidden();await page.clock.runFor(5000);const paused=(await state(page)).run;expect(paused.distance).toBe(before.distance);expect(paused.time).toBe(before.time);const qid=(await state(page)).question.keys[0];await answer(page,true);const after=await state(page);expect(after.mode).toBe('play');expect(after.run.hearts).toBe(3);expect(after.run.invulnerable).toBeGreaterThan(2);const rec=after.data.profiles.kal.learning['patterns-sky'].questions[qid];expect(rec.firstCorrect).toBe(0);expect(rec.laterCorrect).toBe(1);expect(rec.review).toBeGreaterThan(0);await page.locator('#pause').tap();await page.locator('#home').tap();await page.locator('#choose-kal').tap();await page.locator('#practice').tap();await page.locator('#missed').tap();expect((await state(page)).question.keys).toEqual([qid]);
});

test('a side entrance asks exactly two questions and awards one chosen bonus only after both',async({page},info)=>{
 await start(page,'kal');let entered=false;
 for(let i=0;i<400;i++){const s=await state(page);if(s.mode==='question'){if(s.question.reason==='explore'){entered=true;break;}await answer(page);continue;}const portal=s.run.portals.find(p=>!p.passed&&p.distance-s.run.distance<s.run.settings.speed*1.6);const next=s.run.groups.find(g=>!g.passed);if(portal)await steer(page,portal.lane);else if(next)await steer(page,next.safe);await page.clock.runFor(250);}
 expect(entered).toBe(true);expect((await state(page)).question.keys).toHaveLength(2);const before=(await state(page)).run.crystals;await page.screenshot({path:`artifacts/crystal-runner-treasure-${info.project.name}.png`});await answer(page);expect((await state(page)).mode).toBe('question');expect((await state(page)).run.crystals).toBe(before);await answer(page);expect((await state(page)).mode).toBe('reward');await page.locator('[data-reward="blast"]').tap();expect((await state(page)).run.crystals).toBe(before+15);expect((await state(page)).run.stock.blast).toBeGreaterThan(0);expect((await state(page)).mode).toBe('play');
});

test('question refresh resumes the same attempt and optional touch controls work simultaneously',async({page,browserName})=>{
 const d=freshData(),r=newRun('ari','earth-science');r.mode='question';r.pending={reason:'gate',packId:r.packId,keys:['fossil'],index:0,attempt:0,solved:false,begun:false,order:[]};d.profiles.ari.runs[r.packId]=r;await seed(page,d);await page.goto('/');await page.locator('#choose-ari').tap();await page.locator('#continue-adventure').tap();const q=d.packs[r.packId].questions.find(q=>q.id==='fossil');await page.locator(`[data-choice]:not([data-choice="${q.answer}"])`).first().tap();await page.reload();await page.locator('#choose-ari').tap();await page.locator('#continue-adventure').tap();expect((await state(page)).question.attempt).toBe(1);await answer(page);expect((await state(page)).data.profiles.ari.learning[r.packId].questions.fossil.firstCorrect).toBe(0);
 if(browserName==='chromium'){await page.clock.install();const cdp=await page.context().newCDPSession(page),right=await page.locator('[data-action="right"]').boundingBox(),j=await page.locator('[data-action="jump"]').boundingBox();const pt=(id,b)=>({id,x:b.x+b.width/2,y:b.y+b.height/2});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[pt(1,right),pt(2,j)]});await page.clock.runFor(130);expect((await state(page)).run.player.y).toBeGreaterThan(0);expect((await state(page)).held).toBe(1);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});expect((await state(page)).held).toBe(0);}
});

test('landscape iPad layouts fit, rotate pauses safely, cached restoration and repeated swipes release cleanly',async({page})=>{
 await start(page,'kal');for(const size of [{width:1024,height:768},{width:1194,height:834},{width:1366,height:1024},{width:844,height:390}]){await page.setViewportSize(size);expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);for(const action of ['left','right','jump','slide','power']){const b=await page.locator(`[data-action="${action}"]`).boundingBox();expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(size.width);expect(b.y+b.height).toBeLessThanOrEqual(size.height);}}
 const lane=(await state(page)).run.player.lane;await page.locator('#scene').dispatchEvent('pointerdown',{pointerId:2,clientX:500,clientY:250});for(const x of [440,350,200])await page.locator('#scene').dispatchEvent('pointermove',{pointerId:2,clientX:x,clientY:250});await page.locator('#scene').dispatchEvent('pointercancel',{pointerId:2});expect((await state(page)).run.player.lane).toBe(lane-1);await page.setViewportSize({width:768,height:1024});await expect(page.locator('#rotate')).toBeVisible();await expect.poll(async()=>{await page.clock.runFor(32);return (await state(page)).mode;}).toBe('pause');const dist=(await state(page)).run.distance;await page.clock.runFor(2000);expect((await state(page)).run.distance).toBe(dist);await page.setViewportSize({width:1024,height:768});await page.locator('#resume').tap();await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));expect((await state(page)).mode).toBe('pause');await page.locator('#resume').tap();await page.clock.runFor(300);expect((await state(page)).run.distance).toBeGreaterThan(dist);expect((await state(page)).loops).toBe(1);
});
