import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {readFile} from 'node:fs/promises';
import {freshProgress} from '../dist/ari/vocabulary.js';
import {fresh} from '../dist/kal/science.js';
import {closeParentWorkshop,openParentWorkshop} from './reading/admin-fixture.mjs';
const noNames=async locator=>expect(await locator.innerText()).not.toMatch(/\b(?:ari|kal)\b/i);

test('the Arcade uses public profile names in navigation, parent settings, and backups',async({page})=>{
  await page.goto('/');
  const overlay=page.locator('#overlay');
  for (const [id,label] of [['ari','Emberia'],['kal','Luminara']]) {
    await expect(page.locator('#choose-'+id).locator('..')).toContainText(label,{ignoreCase:true});
    await noNames(overlay);
    await page.locator('#choose-'+id).tap();
    await expect(page.locator('.game-modes')).toBeVisible();
    await noNames(overlay);
    await page.locator('#home').tap();
  }
  await page.locator('#how').tap();
  await expect(overlay).toContainText('Emberia');
  await expect(overlay).toContainText('Luminara');
  await noNames(overlay);

  try {
    await openParentWorkshop(page);
    await noNames(overlay);
    const downloaded=page.waitForEvent('download');
    await page.locator('#backup').tap();
    const backup=JSON.parse(await readFile(await (await downloaded).path(),'utf8'));
    expect(Object.keys(backup.data.profiles).sort()).toEqual(['emberia','luminara']);
  } finally {
    await closeParentWorkshop(page);
  }
});
async function frame(page,id){await page.locator('#choose-'+id).click();const h=await page.locator('#adventure-frame').elementHandle(),f=await h.contentFrame();await expect(f.locator('#play')).toBeVisible();return f;}
test('fantasy worlds replace personal labels in menus, reports, intro speech and diagrams',async({page},info)=>{await page.addInitScript(()=>{window.spoken=[];Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{speak:u=>window.spoken.push(u.text),cancel(){}}});Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:class{constructor(text){this.text=text;}}});});await page.goto('/classic.html');await expect(page.locator('#choose-ari')).toContainText('EMBERIA');await expect(page.locator('#choose-kal')).toContainText('LUMINARA');await noNames(page.locator('body'));await mkdir('artifacts',{recursive:true});await page.screenshot({path:`artifacts/worlds-${info.project.name}.png`});for(const id of ['ari','kal']){const f=await frame(page,id);await expect(page).toHaveURL(new RegExp('#'+(id==='ari'?'emberia':'luminara')+'$'));await noNames(f.locator('body'));await f.locator(id==='ari'?'#parent-progress':'#parent').click();await noNames(f.locator('body'));await f.locator(id==='ari'?'#parent-back':'#home').click();await f.locator('#play').click();await noNames(f.locator('body'));if(id==='kal'){await f.locator('#read-intro').tap();const spoken=await f.evaluate(()=>window.spoken);expect(spoken.length).toBeGreaterThan(0);expect(spoken.join(' ')).not.toMatch(/\b(?:ari|kal)\b/i);const diagram=await f.evaluate(async()=>{const p=await import('./pictures.js');return p.demoMarkup('night',1);});expect(diagram).toContain('You');expect(diagram).not.toMatch(/\b(?:ari|kal)\b/i);}await page.locator('#back-arcade').tap();await expect(page.locator('#picker')).toBeVisible();}await page.locator('#saves-button').click();await noNames(page.locator('#save-tools'));});
test('existing points survive world renaming and refresh; new exports use world names',async({page})=>{const ari=freshProgress(),kal=fresh();ari.run={level:0,checkpoint:100,done:[],collected:[],crystals:31,score:620,answers:{},bossDone:0,bossTerms:[]};kal.run={level:0,checkpoint:100,done:[],taken:[],stars:17,score:330,crystals:[],observatory:0,answers:{}};await page.addInitScript(({ari,kal})=>{if(!localStorage.getItem('volcano-quest-v1'))localStorage.setItem('volcano-quest-v1',JSON.stringify(ari));if(!localStorage.getItem('star-quest-kal-v1'))localStorage.setItem('star-quest-kal-v1',JSON.stringify(kal));},{ari,kal});await page.goto('/classic.html');let f=await frame(page,'ari');await f.locator('#play').click();expect((await f.evaluate(()=>window.volcanoQuest)).progress.run.crystals).toBe(31);await page.locator('#back-arcade').tap();await expect(page.locator('#picker')).toBeVisible();f=await frame(page,'kal');await f.locator('#play').click();expect((await f.evaluate(()=>window.starQuest)).progress.run.stars).toBe(17);await page.locator('#back-arcade').tap();await expect(page.locator('#picker')).toBeVisible();await page.reload();await page.locator('#saves-button').click();const downloadPromise=page.waitForEvent('download');await page.locator('#export-kal').click();const file=await downloadPromise;expect(file.suggestedFilename()).toBe('science-arcade-luminara-save.json');await expect(page.locator('#save-message')).toContainText('Luminara');const saved=await page.evaluate(()=>({ari:JSON.parse(localStorage.getItem('volcano-quest-v1')),kal:JSON.parse(localStorage.getItem('star-quest-kal-v1'))}));expect(saved.ari.run.score).toBe(620);expect(saved.kal.run.score).toBe(330);});
test('old bookmarks redirect to generic world routes and legacy backups still import',async({page})=>{await page.goto('/classic.html#kal');await expect(page).toHaveURL(/#luminara$/);await expect(page.locator('#adventure-frame')).toBeVisible();await page.locator('#back-arcade').tap();await expect(page.locator('#picker')).toBeVisible();const save=fresh();await page.locator('#saves-button').click();await page.locator('#backup-file').setInputFiles({name:'old.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'science-adventure-arcade-save-v1',player:'kal',progress:save}))});await expect(page.locator('#import-label')).toContainText('Luminara');await page.locator('#confirm-import').click();await expect(page.locator('#save-message')).toContainText('Luminara');await noNames(page.locator('#save-tools'));});
