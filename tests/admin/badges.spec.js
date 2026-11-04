import {test,expect} from '@playwright/test';

const ownerKey=process.env.CQ_GAME_MASTER_TEST_KEY;
const maintenanceKey='disposable-game-master-maintenance-test-key';
test.skip(!ownerKey,'Run with playwright.game-master.config.js.');

test('owner creates, grants and retires a badge; only its recipient identity sees it',async({page,browser,baseURL})=>{
 const learner=await browser.newContext({baseURL,hasTouch:true,viewport:{width:1024,height:768}});
 const post=(context,route,data,headers={})=>context.request.post('/api/'+route,{data,headers:{Origin:baseURL,...headers}});
 const suffix=Date.now().toString(36);
 const accounts=[];
 const signup=async(context,role)=>{
  const result=await post(context,'signup',{username:'qa_badge_'+role+'_'+suffix,pin:'5682'},{'CF-Connecting-IP':'198.51.100.'+(test.info().workerIndex+1)});
  expect(result.ok(),await result.text()).toBe(true);
  const account=(await result.json()).account;
  accounts.push(account);
  return account;
 };
 const badgeName='Library Pathfinder '+suffix;
 const badgeDescription='A collectible for a curious reading explorer.';
 const editor=page.locator('[data-badge-edit]');
 const grant=page.locator('[data-badge-grant]');
 const commit=async(form,button,reason,status)=>{
  await form.getByLabel('Reason').fill(reason);
  await form.getByRole('button',{name:button}).tap();
  await expect(page.locator('[data-badge-review]')).toContainText(badgeName);
  await page.getByRole('button',{name:'Apply badge change'}).tap();
  await expect(page.locator('#status')).toContainText(status);
  await expect(page.locator('[data-badge-review]')).toHaveCount(0);
 };
 try{
  const owner=await signup(page.context(),'o');
  const recipient=await signup(learner,'r');
  const designated=await post(page.context(),'admin',{action:'designate-reading-admin',username:owner.username},{'x-cq-admin-key':maintenanceKey});
  expect(designated.ok(),await designated.text()).toBe(true);
  const denied=await post(learner,'game-master',{action:'badges'},{'x-cq-game-master-key':ownerKey});
  expect(denied.status()).toBe(403);

  await page.goto('/admin');
  await page.getByLabel('Owner key').fill(ownerKey);
  await page.getByRole('button',{name:'Unlock dashboard'}).tap();
  await page.getByRole('button',{name:new RegExp(recipient.username)}).tap();
  await page.getByRole('button',{name:/Special rewards/i}).tap();
  await editor.getByLabel('Badge name').fill(badgeName);
  await editor.getByLabel('Description').fill(badgeDescription);
  await editor.getByLabel('Icon').selectOption('trophy');
  await editor.getByLabel('Rarity').selectOption('RARE');
  await expect(editor.locator('[data-badge-preview]')).toContainText('🏆 '+badgeName+' · Rare');
  await commit(editor,'Preview badge changes','Create a demo collectible','Collectible badge saved.');
  await grant.getByLabel('Collectible badge').selectOption({label:'🏆 '+badgeName});
  await expect(grant.getByLabel(recipient.username)).toBeChecked();
  await expect(grant.getByLabel('Badge identity')).toHaveValue('emberia');
  await commit(grant,'Preview badge award','Reward a reading milestone','Collectible badge awarded.');

  const child=await learner.newPage();
  await child.goto('/');
  await expect(child.locator('#sync-status')).toContainText('Saved to cloud');
  await child.locator('#choose-ari').tap();
  await child.getByRole('button',{name:'Rewards',exact:false}).tap();
  const shelf=child.locator('#collectible-badges');
  await expect(shelf.getByText(badgeName)).toBeVisible();
  await expect(shelf.getByText(badgeDescription)).toBeVisible();
  await expect(shelf.getByText('Rare',{exact:true})).toBeVisible();

  await editor.getByLabel('Saved badge').selectOption({label:badgeName});
  await editor.getByLabel('Available to award').uncheck();
  await commit(editor,'Preview badge changes','Retire the demo collectible','Collectible badge saved.');
  await expect(grant).toHaveCount(0);

  await child.reload();
  await expect(child.locator('#sync-status')).toContainText('Saved to cloud');
  await child.locator('#choose-ari').tap();
  await child.getByRole('button',{name:'Rewards',exact:false}).tap();
  await expect(shelf.getByText(badgeName)).toHaveCount(1);
  await child.locator('#menu').tap();
  await child.locator('#home').tap();
  await child.locator('#choose-kal').tap();
  await child.getByRole('button',{name:'Rewards',exact:false}).tap();
  await expect(shelf).toContainText('Your special badges will appear here.');
  await expect(shelf.getByText(badgeName)).toHaveCount(0);
 }finally{
  for(const account of accounts)await post(page.context(),'admin',{
   action:'delete-qa',username:account.username,accountId:account.id,
  },{'x-cq-admin-key':maintenanceKey});
  await learner.close();
 }
});
