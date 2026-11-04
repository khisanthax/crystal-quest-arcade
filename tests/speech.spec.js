import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {freshProgress,recordAnswer} from '../dist/ari/vocabulary.js';
import {fresh,recordQuestion} from '../dist/kal/science.js';

async function setup(page,world,concept,available=true,run=null){
 const save=world==='ari'?freshProgress():fresh();
 if(run)save.run=run;
 if(world==='ari')recordAnswer(save.stats,concept,false,0);else recordQuestion(save,concept,false,0);
 const key=world==='ari'?'volcano-quest-v1':'star-quest-kal-v1';
 await page.addInitScript(({save,key,available})=>{
  if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(save));
  window.spoken=[];window.speechCancels=0;
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:available?{speak:u=>window.spoken.push(u.text),cancel:()=>window.speechCancels++}:undefined});
  Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:class{constructor(text){this.text=text;}}});
 },{save,key,available});
 await page.goto('/classic.html');await page.locator('#choose-'+world).tap();
 const f=await (await page.locator('#adventure-frame').elementHandle()).contentFrame();
 await f.locator(run?'#play':world==='ari'?'#practice':'#mistakes').tap();return f;
}

for(const world of ['ari','kal'])test(world+' mistake questions have a tappable Speak Aloud button that reads the prompt and choices',async({page},info)=>{
 await page.setViewportSize({width:1024,height:768});
 const f=await setup(page,world,world==='ari'?'fossil':'moonMaterial');
 const spoken=()=>f.evaluate(()=>window.spoken);
 expect(await spoken()).toEqual([]);await expect(f.getByRole('button',{name:'🔊 SPEAK ALOUD',exact:true})).toBeVisible();
 const before=await f.evaluate(w=>w==='ari'?window.volcanoQuest.progress:window.starQuest.progress,world);
 await f.locator('#read-question').tap();const reading=(await spoken()).at(-1);
 expect(reading).toContain(await f.locator('.question h2').innerText());
 for(const choice of await f.locator(world==='ari'?'[data-answer]':'[data-choice] span').allTextContents())expect(reading).toContain(choice);
 expect(await f.evaluate(w=>w==='ari'?window.volcanoQuest.progress:window.starQuest.progress,world)).toEqual(before);
 await f.locator('#read-question').tap();expect((await spoken()).length).toBe(2);
 await mkdir('artifacts',{recursive:true});await page.screenshot({path:`artifacts/mistake-speech-${world}-${info.project.name}.png`});
 await page.locator('#back-arcade').tap();await expect(page.locator('#picker')).toBeVisible();await expect(page.locator('iframe')).toHaveCount(0);
});

test('Luminara mistake demonstrations also have Speak Aloud and the following question keeps it',async({page})=>{
 const f=await setup(page,'kal','rotation');await expect(f.locator('#read-demo')).toHaveText('🔊 SPEAK ALOUD');await f.locator('#read-demo').tap();expect((await f.evaluate(()=>window.spoken)).at(-1)).toContain('Tap Earth to spin');
 await f.locator('#demo-tap').tap();await f.locator('#demo-next').tap();await expect(f.locator('#read-question')).toHaveText('🔊 SPEAK ALOUD');await f.locator('#read-question').tap();expect((await f.evaluate(()=>window.spoken)).at(-1)).toContain('What is rotation?');
});

test('Emberia missing speech support shows a helpful message and leaves mistake practice playable',async({page})=>{
 const f=await setup(page,'ari','fossil',false);await f.locator('#read-question').tap();await expect(f.locator('#speech-status')).toContainText('unavailable');await f.locator('[data-answer="fossil"]').tap();await expect(f.locator('#question-next')).toBeVisible();await f.locator('#question-next').tap();await expect(f.getByText('Your science powers are growing!')).toBeVisible();
});

test('Emberia layer questions read each placement instruction and choices',async({page})=>{
 const f=await setup(page,'ari','crust',true,{level:1,checkpoint:1100,done:[],collected:[],crystals:0,score:0,answers:{},bossDone:0,bossTerms:[]});
 await page.clock.install();await page.clock.runFor(500);await f.locator('#action').tap();
 for(const [term,position]of [['crust','outside'],['mantle','middle'],['core','center']]){
  await expect(f.locator('#read-question')).toBeVisible();await f.locator('#read-question').tap();
  const text=(await f.evaluate(()=>window.spoken)).at(-1);expect(text).toContain(`Tap the ${position} layer.`);for(const choice of ['CRUST','MANTLE','CORE'])expect(text).toContain(choice);
  if(term!=='core'){await f.locator(`[data-answer="${term}"]`).tap();await f.locator('#question-next').tap();}
 }
});
