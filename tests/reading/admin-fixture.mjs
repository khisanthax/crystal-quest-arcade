import {expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
const sessions=new WeakMap();
export async function openParentWorkshop(page){
 await page.goto('/');await expect(page.locator('#choose-ari')).toBeVisible();
 const data=await page.evaluate(()=>window.crystalQuest.data),origin=new URL(page.url()).origin;
 const key=(await readFile('.local/maintenance-key','utf8')).trim();
 const db=new DatabaseSync(process.env.CQ_DB_PATH||'.local/explorers.sqlite');db.exec('DELETE FROM attempt_limits');db.close();
 const username='qa_parent_'+Date.now().toString(36),post=(path,data,privateCall=false)=>page.request.post('/api/'+path,{headers:{Origin:origin,...(privateCall?{'x-cq-admin-key':key}:{})},data});
 const created=await post('signup',{username,pin:'5682'});expect(created.ok()).toBe(true);
 const {account}=await created.json();sessions.set(page,()=>post('admin',{action:'delete-qa',username,accountId:account.id},true));
 expect((await post('admin',{action:'designate-reading-admin',username},true)).ok()).toBe(true);
 expect((await post('migrate',{data,revision:0,confirmed:true,requestId:'qa-seed'})).ok()).toBe(true);
 await page.reload();await expect.poll(()=>page.evaluate(()=>window.crystalQuest.cloudAccount?.id)).toBe(account.id);
 await page.locator('#parent-settings').tap();await expect(page.getByRole('heading',{name:'Parent Settings'})).toBeVisible();
}
export async function closeParentWorkshop(page){const dispose=sessions.get(page);if(dispose){expect((await dispose()).ok()).toBe(true);sessions.delete(page);}}
