import {DatabaseSync} from 'node:sqlite';
import {test,expect} from '@playwright/test';import {readFile} from 'node:fs/promises';
import {freshData,history,KEY} from '../dist/runner/store.js';
import {adopt,purchase} from '../dist/runner/collection.js';
import {presentRecord,answerRecord} from '../dist/runner/packs.js';

test('real account migration, PNG passport recovery from same-device Files, cross-device collections, offline queue and session switching',async({page,browser,baseURL})=>{
test.setTimeout(120000);
if(baseURL.startsWith('http://localhost:')){
  const db=new DatabaseSync(process.env.CQ_DB_PATH||'.local/explorers.sqlite');
  db.exec('DELETE FROM attempt_limits');
  db.close();
}
const data=freshData(),guest=data.profiles.ari,pack=data.packs[guest.activePack];
guest.crystals=343;
data.profiles.kal.crystals=41;
adopt(guest,'fox',true);
purchase(guest,'food','carrot');
const learning=history(data,'ari',pack.id),question=pack.questions[0];
presentRecord(learning,question);
answerRecord(learning,question,true,0);
const username='qa_ui_'+Date.now().toString(36),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(({data,KEY})=>{if(!localStorage.getItem(KEY))localStorage.setItem(KEY,JSON.stringify(data));},{data,KEY});
let accountId,other;
page.on('response',async r=>{if(r.url().endsWith('/api/signup')&&r.status()===200)accountId=(await r.json()).account.id;});
try{
await page.goto('/');
await page.locator('#explorer-home-create').tap();
await page.locator('#explorer-username').fill(username);
await page.locator('#explorer-pin').fill('5682');
await page.locator('#explorer-create').tap();
await expect(page.locator('#passport-image')).toBeVisible({timeout:15000});
const qrDownload=page.waitForEvent('download',{timeout:15000});
await page.locator('#download-passport').tap();
const passport=await qrDownload,qrPath=await passport.path(),png=await readFile(qrPath);
expect(png.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
await page.locator('#passport-done').tap();
await expect(page.locator('#confirm-migration')).toBeDisabled();
// Simulate the account request failing on reload while the app shell loads.
// Windows WebKit does not consistently cache the app shell for offline navigation.
await page.addInitScript(()=>{
  if(!sessionStorage.getItem('qa-block-cloud-boot'))return;
  const request=window.fetch.bind(window);
  window.fetch=(input,options)=>new URL(input instanceof Request?input.url:input,location.href).pathname==='/api/me'
    ?Promise.reject(new TypeError('Test network interruption'))
    :request(input,options);
});
await page.evaluate(()=>sessionStorage.setItem('qa-block-cloud-boot','1'));
await page.reload();
await expect(page.locator('#confirm-migration')).toBeDisabled();
await expect(page.locator('#choose-ari')).toHaveCount(0);
const backupDownload=page.waitForEvent('download',{timeout:15000});
await page.locator('#migration-backup').tap();
const backup=await backupDownload;
const backupText=await readFile(await backup.path(),'utf8');
expect(backupText).toContain('fox');
expect(backupText).not.toContain('5682');
await page.locator('#migrate-emberia').check();
await page.context().setOffline(true);
await page.locator('#confirm-migration').tap();
await expect(page.locator('#migration-message')).toHaveText('Connect to the internet to attach this device’s progress.');
await page.context().setOffline(false);
await page.evaluate(()=>sessionStorage.removeItem('qa-block-cloud-boot'));
await page.locator('#confirm-migration').tap();
await expect(page.locator('#choose-ari')).toBeVisible();
await expect(page.locator('#explorer-home-name')).toHaveText(username);
await expect(page.locator('#explorer-home-sync')).toHaveText(/^saved to cloud$/i);
let cloud=await(await page.request.get('/api/me')).json();
const migrated=cloud.data.profiles.ari;
expect(migrated.crystals).toBe(guest.crystals);
expect(migrated.collection).toMatchObject({wallet:333,food:{carrot:1},pets:[{species:'fox'}]});
expect(migrated.learning[pack.id].questions[question.id].firstCorrect).toBe(1);
const deviceCrystals=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).profiles.kal.crystals,KEY);
expect(deviceCrystals).toBe(41);
// Real store actions must be acknowledged by the server, not merely change a local counter.
await page.locator('#choose-ari').tap();
await page.locator('#store').tap();
for (const [tab, item] of [['food', 'apple'], ['accessories', 'cap']]) {
  await page.locator(`[data-tab="${tab}"]`).tap();
  await page.locator(`[data-buy="${item}"]`).tap();
  await page.locator('#confirm-buy').tap();
}
await page.locator('[data-tab="owned"]').tap();
await page.locator('[data-pet]').tap();
await page.locator('[data-feed="apple"]').tap();
await page.locator('[data-dress="cap"]').tap();
const savedCollection = async (browserPage) => {
  const response = await browserPage.request.get('/api/me');
  return (await response.json()).data.profiles.ari.collection;
};
await expect.poll(() => savedCollection(page), {timeout:15000}).toMatchObject({
  wallet:273,
  pets:[{species:'fox',xp:18,accessories:{head:'cap'}}],
});
expect((await savedCollection(page)).food.apple ?? 0).toBe(0);
await page.locator('#back').tap();
await page.locator('#home').tap();
await page.reload();
await expect(page.locator('#explorer-home-name')).toHaveText(username);
await expect(page.locator('#explorer-home-sync')).toHaveText(/^saved to cloud$/i);
// A fresh context has no enrollment. Its uploaded QR establishes this explorer's identity.
other=await browser.newContext({baseURL,viewport:{width:1024,height:768},hasTouch:true});const p=await other.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('/');await p.locator('#explorer-home').tap();await p.locator('#explorer-recover').tap();await p.locator('#passport-file').setInputFiles({name:'private-explorer-passport.png',mimeType:'image/png',buffer:png});await expect(p.locator('#passport-image')).toBeVisible();const updatedDownload=p.waitForEvent('download',{timeout:15000});await p.locator('#download-passport').tap();const updated=await updatedDownload;expect((await readFile(await updated.path())).equals(png)).toBe(false);await p.locator('#passport-done').tap();await expect(p.locator('#choose-ari')).toBeVisible();cloud=(await(await p.request.get('/api/me')).json());expect(cloud.account.id).toBe(accountId);
const recovered=cloud.data.profiles.ari.collection;
expect(recovered).toMatchObject({wallet:273,food:{carrot:1},pets:[{species:'fox',xp:18,accessories:{head:'cap'}}]});
expect(cloud.data.profiles.ari.learning[pack.id].questions[question.id].firstCorrect).toBe(1);
expect(recovered.equipped).toBe(recovered.pets[0].id);
expect(recovered.food.apple ?? 0).toBe(0);
expect(cloud.data.profiles.kal.crystals).toBe(0);
expect((await(await page.request.get('/api/me')).json()).account).toBeNull();
// Re-using the old PNG must fail; it is not a reusable password.
await p.locator('#explorer-home').tap();await p.locator('#sign-out').tap();await expect(p.locator('#explorer-recover')).toBeVisible();await p.locator('#explorer-recover').tap();await p.locator('#passport-file').setInputFiles({name:'old-passport.png',mimeType:'image/png',buffer:png});await expect(p.locator('#recovery-message')).toContainText('replaced');await p.locator('#recover-back').tap();await p.locator('#explorer-username').fill(username);await p.locator('#explorer-pin').fill('5682');await p.locator('#explorer-login').tap();await expect(p.locator('#choose-ari')).toBeVisible();
await p.locator('#choose-ari').tap();await p.locator('#new-run').tap();await p.locator('[data-stage]').first().tap();await other.setOffline(true);await p.locator('#pause').tap();await p.locator('#menu').tap();await expect(p.locator('#sync-status')).toContainText('Offline');await other.setOffline(false);await expect(p.locator('#sync-status')).toContainText('Saved to cloud',{timeout:15000});await p.reload();await expect.poll(async()=>p.evaluate(()=>window.crystalQuest.cloudAccount?.username)).toBe(username);expect((await p.evaluate(()=>window.crystalQuest)).data.profiles.ari.collection.pets[0].species).toBe('fox');expect(errors).toEqual([]);
}finally{if(other)await other.close();if(accountId){const secret=(await readFile('.local/maintenance-key','utf8')).trim();const r=await page.request.post('/api/admin',{headers:{Origin:baseURL,'x-cq-admin-key':secret},data:{action:'delete-qa',username,accountId}});expect(r.ok()).toBe(true);}}});
