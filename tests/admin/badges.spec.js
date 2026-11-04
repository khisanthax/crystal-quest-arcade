import {test,expect} from '@playwright/test';

const ownerKey=process.env.CQ_GAME_MASTER_TEST_KEY;
const maintenanceKey='disposable-game-master-maintenance-test-key';
test.skip(!ownerKey,'Run with playwright.game-master.config.js.');

test('owner grants standalone and mixed badges, rejects duplicate grants, and retires a badge',async({page,browser,baseURL})=>{
 const learner=await browser.newContext({baseURL,hasTouch:true,viewport:{width:1024,height:768}});
 const post=(context,route,data,headers={})=>context.request.post('/api/'+route,{data,headers:{Origin:baseURL,...headers}});
 const suffix=Date.now().toString(36);
 const accounts=[];
 const signupIP='192.0.2.'+(20+test.info().workerIndex%200);
 const signup=async(context,role)=>{
  const result=await post(context,'signup',{username:'qa_badge_'+role+'_'+suffix,pin:'5682'},{'CF-Connecting-IP':signupIP});
  expect(result.ok(),await result.text()).toBe(true);
  const account=(await result.json()).account;
  accounts.push(account);
  return account;
 };
 const badgeName='Library Pathfinder '+suffix;
 const badgeDescription='A collectible for a curious reading explorer.';
 const occasion='Library Reading Week';
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
  await editor.getByLabel('Occasion (optional)').fill(occasion);
  await editor.getByLabel('Last day to award (UTC)').fill('2099-12-31');
  await expect(editor.locator('[data-badge-preview]')).toContainText('🏆 '+badgeName+' · Rare');
  await expect(editor.locator('[data-badge-preview]')).toContainText(occasion+' · available through 2099-12-31 UTC');
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
  await expect(shelf.getByText(occasion,{exact:true})).toBeVisible();
  await expect(shelf.getByText('Rare',{exact:true})).toBeVisible();

 const mixedPackage=page.locator('form[data-change="package-save"]');
 const packageName='Library gift box '+suffix;
 await mixedPackage.getByLabel('Package name').fill(packageName);
 await mixedPackage.getByRole('spinbutton',{name:'Crystals',exact:true}).fill('30');
 await mixedPackage.locator('select[name=food]').selectOption('apple');
 await mixedPackage.locator('select[name=badge]').selectOption({label:'🏆 '+badgeName});
 const preview=page.locator('#review');
 const apply=async(form,label,reason)=>{
  await form.getByLabel('Reason').fill(reason);
  await form.getByRole('button',{name:label,exact:true}).tap();
  await expect(preview).toContainText(badgeName+' collectible badge');
 };
 const confirm=async()=>{
  await preview.getByRole('button',{name:'Apply confirmed change'}).tap();
  await expect(page.locator('#status')).toContainText('Change saved.');
  await expect(preview).toHaveCount(0);
 };
 await apply(mixedPackage,'Preview package changes','Save a mixed gift box');
 await expect(preview).toContainText('◆ 30');
 await expect(preview).toContainText('Apple × 1');
 await confirm();

 const packageGrant=page.locator('form[data-change="reward-package"]');
 const chooseOwner=async form=>{
  await form.getByLabel(recipient.username).uncheck();
  await form.getByLabel(owner.username).check();
 };
 const prepareGrant=async reason=>{
  await packageGrant.locator('select[name=id]').selectOption({label:packageName});
  await chooseOwner(packageGrant);
  await apply(packageGrant,'Preview package grant',reason);
 };
 await prepareGrant('Award the mixed gift box');
 await expect(preview).toContainText('Apple × 1');
 await confirm();
 const ownerCloud=async()=> (await (await page.request.get('/api/me')).json()).data;
 const badgeList=async profile=> (await (await post(page.context(),'collectible-badges',{profile})).json()).badges;
 let ownerData=await ownerCloud();
 expect(ownerData.profiles.ari.collection.wallet).toBe(30);
 expect(ownerData.profiles.ari.collection.food.apple).toBe(1);
 expect((await badgeList('emberia')).map(b=>b.name)).toContain(badgeName);
 await prepareGrant('Verify duplicate ownership cannot pay twice');
 await preview.getByRole('button',{name:'Apply confirmed change'}).tap();
 await expect(preview.getByRole('alert')).toContainText(/already|owned/i);
 ownerData=await ownerCloud();
 expect(ownerData.profiles.ari.collection.wallet).toBe(30);
 expect(ownerData.profiles.ari.collection.food.apple).toBe(1);
 await preview.getByRole('button',{name:'Cancel'}).tap();

 await page.locator('select[name=profile]').selectOption('luminara');
 const gift=page.locator('form[data-change="reward"]');
 await chooseOwner(gift);
 await gift.getByRole('spinbutton',{name:'Crystals',exact:true}).fill('7');
 await gift.locator('select[name=badge]').selectOption({label:'🏆 '+badgeName});
 await apply(gift,'Preview gift','Give a one-time mixed gift');
 await expect(preview).toContainText('◆ 7');
 await confirm();
 expect((await ownerCloud()).profiles.kal.collection.wallet).toBe(7);
 expect((await badgeList('luminara')).map(b=>b.name)).toContain(badgeName);

  await editor.getByLabel('Saved badge').selectOption({label:badgeName});
  await expect(editor.getByLabel('Occasion (optional)')).toHaveValue(occasion);
  await editor.getByLabel('Last day to award (UTC)').fill('2001-01-01');
  await expect(editor.locator('[data-badge-preview]')).toContainText('award window ended');
  await commit(editor,'Preview badge changes','Close the award window','Collectible badge saved.');
  await expect(grant).toHaveCount(0);
  await expect(gift.locator('select[name=badge] option').filter({hasText:badgeName})).toHaveCount(0);
  await editor.getByLabel('Saved badge').selectOption({label:badgeName+' (award window ended)'});
  await expect(editor.getByLabel('Enable awards')).toBeChecked();
  await editor.getByLabel('Enable awards').uncheck();
  await commit(editor,'Preview badge changes','Retire the demo collectible','Collectible badge saved.');
  await expect(grant).toHaveCount(0);
  await expect(page.getByText('Packages with unavailable badges need editing before they can be awarded.')).toBeVisible();
  await expect(packageGrant.locator('option').filter({hasText:packageName})).toHaveCount(0);

  await child.reload();
  await expect(child.locator('#sync-status')).toContainText('Saved to cloud');
  await child.locator('#choose-ari').tap();
  await child.getByRole('button',{name:'Rewards',exact:false}).tap();
  await expect(shelf.getByText(badgeName)).toHaveCount(1);
  await expect(shelf.getByText(occasion,{exact:true})).toBeVisible();
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
