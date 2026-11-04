import {openParentWorkshop,closeParentWorkshop} from './reading/admin-fixture.mjs';
import {test,expect} from '@playwright/test';
test.afterEach(async({page})=>closeParentWorkshop(page));
import {freshData,KEY} from '../dist/runner/store.js';
import {newRun,pattern} from '../dist/runner/model.js';
const labels={ari:'Emberia',kal:'Luminara'};
for(const id of ['ari','kal'])for(const type of ['low','full','break'])test(`${labels[id]} jump button clears a real approaching ${type} without protection`,async({page})=>{
 const d=freshData();let seed=0;while(!pattern(seed,0,d.profiles[id].settings.lanes,0,Math.floor(d.profiles[id].settings.lanes/2)).obstacles.some(o=>o.type===type))seed++;
 const pack=d.profiles[id].activePack,r=newRun(id,pack,{},seed);r.stock={shield:0,dash:0,blast:0};d.profiles[id].runs[pack]=r;
 await page.addInitScript(({key,d})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(d));},{key:KEY,d});await page.goto('/');await page.clock.install();await page.locator('#choose-'+id).tap();await page.locator('#continue-adventure').tap();await page.clock.runFor(100);
 let s=await page.evaluate(()=>window.crystalQuest.run);const group=s.groups[0],o=group.obstacles.find(o=>o.type===type);for(let lane=s.player.lane;lane<o.lane;lane++)await page.keyboard.press('ArrowRight');for(let lane=s.player.lane;lane>o.lane;lane--)await page.keyboard.press('ArrowLeft');
 const eta=(group.distance-s.distance)/s.settings.speed;await page.clock.runFor((eta-.85)*1000);await expect(page.locator('#obstacle-hint')).toContainText('JUMP NOW');await page.locator('[data-action="jump"]').tap();await page.clock.runFor(600);expect((await page.evaluate(()=>window.crystalQuest.run)).player.y).toBeGreaterThan(3);await page.clock.runFor(400);s=await page.evaluate(()=>window.crystalQuest.run);expect(s.groups.find(g=>g.id===group.id).passed).toBe(true);expect(s.hearts).toBe(3);expect(s.invulnerable).toBe(0);expect(s.active).toBeNull();
});
test('screens, parent messages, narration labels and exported backups contain no personal profile names',async({page})=>{
 const anonymous=async()=>expect(await page.locator('body').innerText()).not.toMatch(/\b(ari|kal)\b/i);
 await page.goto('/');await anonymous();await expect(page.locator('#choose-ari').locator('..')).toContainText('EMBERIA');await expect(page.locator('#choose-kal').locator('..')).toContainText('LUMINARA');await page.locator('#how').tap();await anonymous();await page.locator('#home').tap();for(const id of ['ari','kal']){await page.locator('#choose-'+id).tap();await anonymous();await page.locator('#rewards').tap();await anonymous();await page.locator('#menu').tap();await page.locator('#home').tap();}await openParentWorkshop(page);await anonymous();await page.locator('[data-settings="ari"]').tap();await anonymous();const dl=page.waitForEvent('download');await page.locator('#backup').tap();const file=await dl;const stream=await file.createReadStream();let raw='';for await(const chunk of stream)raw+=chunk.toString();expect(raw).not.toMatch(/\b(ari|kal)\b/i);expect(JSON.parse(raw).data.profiles.emberia).toBeTruthy();
});
