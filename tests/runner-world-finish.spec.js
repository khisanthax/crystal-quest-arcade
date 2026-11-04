import {test,expect} from '@playwright/test';
import {freshData,KEY} from '../dist/runner/store.js';
import {WORLDS} from '../dist/runner/worlds.js';

const worlds=['jungle','underwater','castle','haunted','frozen'];
const stepState=page=>page.evaluate(()=>{
 const {mode,run}=window.crystalQuest;
 return {
  mode,lane:run.player.lane,safe:run.groups.find(group=>!group.passed)?.safe,
 };
});

async function answer(page){
 const q=await page.evaluate(()=>{
  const {question,data}=window.crystalQuest;
  const item=data.packs[question.packId].questions.find(q=>q.id===question.keys[question.index]);
  return {reason:question.reason,choices:item.type==='order'?item.answer:[item.answer]};
 });
 for(const choice of q.choices)await page.locator('[data-choice="'+choice+'"]').tap();
 await page.locator('#question-next').tap();
 return q.reason;
}

for(const [index,world] of worlds.entries()){
 const identity=index%2?'kal':'ari';
 const first=WORLDS[world].stages[0];
 const next=WORLDS[world].stages[1];

 test(WORLDS[world].name+' runner earns a stage crystal and resumes the next stage',async({page})=>{
  test.setTimeout(180000);
  await page.setViewportSize({width:844,height:390});
  await page.emulateMedia({reducedMotion:'reduce'});
  // A short checkpoint interval keeps the browser run focused; all gates and finish lines are earned in play.
  const seed=freshData();
  seed.profiles[identity].settings.interval=2;
  await page.addInitScript(({key,seed})=>{
   if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));
  },{key:KEY,seed});
  await page.goto('/');
  await page.clock.install();
  await page.locator('#choose-'+identity).tap();
  await page.locator('#new-run').tap();
  const destination=page.locator('[data-destination="'+world+'"]');
  await destination.tap();
  await expect(destination).toContainText('0/3 stages complete');
  await page.locator('[data-stage="0"]').tap();
  await expect(page.locator('#stage-name')).toContainText(first);
  await expect(page.locator('#controls')).toBeVisible();
  await page.clock.pauseAt(new Date(Date.now()+1000));

  let gates=0;
  let finished=false;
  for(let i=0;i<200;i++){
   const state=await stepState(page);
   if(state.mode==='stage'){finished=true;break;}
   if(state.mode==='question'){
    if(await answer(page)==='gate')gates++;
    continue;
   }
   if(state.mode==='reward'){
    await page.locator('[data-reward="shield"]').tap();
    continue;
   }
   expect(state.mode).toBe('play');
   if(state.safe!==undefined){
    for(let lane=state.lane;lane<state.safe;lane++)await page.locator('#controls [data-action="right"]').tap();
    for(let lane=state.lane;lane>state.safe;lane--)await page.locator('#controls [data-action="left"]').tap();
   }
   await page.clock.runFor(650);
  }
  expect(finished,'Cross the finish line using the runner controls').toBe(true);
  expect(gates).toBe(4);
  await expect(page.getByRole('heading',{name:first+' complete!'})).toBeVisible();
  const earned=await page.evaluate(({identity,first})=>{
   const {data,run}=window.crystalQuest;
   const player=data.profiles[identity];
   return {
    world:run.theme,wallet:player.collection.wallet,
    stageAwards:player.rewards.filter(r=>r.kind==='stage'&&r.title===first+' Crystal').length,
   };
  },{identity,first});
  expect(earned.world).toBe(world);
  expect(earned.wallet).toBeGreaterThan(0);
  expect(earned.stageAwards).toBe(1);

  await page.locator('#stage-map').tap();
  await expect(destination).toContainText('1/3 stages complete');
  await expect(page.locator('[data-stage="0"]')).toContainText('Complete');
  await expect(page.locator('#map-next')).toHaveAttribute('data-next','1');
  await page.locator('#map-next').tap();
  await expect(page.locator('#stage-name')).toContainText(next);
  await page.clock.runFor(650);
  const distance=await page.evaluate(()=>window.crystalQuest.run.distance);
  expect(distance).toBeGreaterThan(0);
  await page.locator('#leave').tap();
  await page.reload();
  await page.locator('#choose-'+identity).tap();
  await expect(page.locator('#continue-adventure')).toContainText('Stage 2');
  await page.locator('#continue-adventure').tap();
  await expect(page.locator('#stage-name')).toContainText(next);
  const restored=await page.evaluate(({identity,first})=>{
   const {data,run}=window.crystalQuest;
   const player=data.profiles[identity];
   return {
    world:run.theme,stage:run.stage,distance:run.distance,wallet:player.collection.wallet,
    completed:player.journeys.runner[run.theme].completed,
    stageAwards:player.rewards.filter(r=>r.kind==='stage'&&r.title===first+' Crystal').length,
   };
  },{identity,first});
  expect(restored).toMatchObject({world,stage:1,wallet:earned.wallet,completed:[0],stageAwards:1});
  expect(restored.distance).toBeGreaterThanOrEqual(distance);
 });
}
