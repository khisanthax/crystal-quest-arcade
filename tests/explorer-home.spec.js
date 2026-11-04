import {expect,test} from '@playwright/test';
import {freshData} from '../dist/runner/store.js';

// Keep the synthetic cloud responses under Playwright routing in both engines.
test.use({serviceWorkers:'block'});

test('Explorer entry points and both guest adventures fit iPad landscape',async({page})=>{
  await page.goto('/');
  const signIn=page.getByRole('button',{name:'Sign in to My Explorer'});
  const create=page.getByRole('button',{name:'Create My Explorer'});

  await expect(page.getByRole('region',{name:'My Explorer'})).toBeVisible();
  await expect(page.getByText('Save your crystals, pets, and adventures!')).toBeVisible();
  await expect(page.getByText('An Explorer account keeps purchases, rewards, and progress saved in the cloud.')).toBeVisible();
  await expect(page.getByText('Guest progress stays on this device. Create an Explorer to keep it safe!')).toBeVisible();
  await expect(page.getByText('New Explorer?',{exact:false})).toBeVisible();
  await expect(page.getByText(/^saved to cloud$/i)).toHaveCount(0);

  for(const size of [{width:1024,height:768},{width:1180,height:820},{width:1366,height:1024}]){
    await page.setViewportSize(size);
    for(const button of [signIn,create,page.locator('#choose-ari'),page.locator('#choose-kal')]){
      const box=await button.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(43.99);
      expect(box.height).toBeGreaterThanOrEqual(43.99);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x+box.width).toBeLessThanOrEqual(size.width+1);
      expect(box.y+box.height).toBeLessThanOrEqual(size.height+1);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
  }

  await signIn.tap();
  await expect(page.getByRole('heading',{name:'Sign in to My Explorer'})).toBeVisible();
  await expect(page.getByLabel('Explorer username')).toBeVisible();
  await expect(page.getByLabel('Four-digit PIN')).toBeVisible();
  await expect(page.locator('#remember-explorer')).toBeChecked();
  await expect(page.locator('#explorer-recover')).toBeVisible();
  await page.locator('#account-back').tap();

  await create.tap();
  await expect(page.getByRole('heading',{name:'Create My Explorer'})).toBeVisible();
  await expect(page.getByLabel('Explorer username')).toBeVisible();
  await expect(page.getByLabel('Four-digit PIN')).toBeVisible();
  await page.locator('#account-back').tap();

  for(const profile of ['ari','kal']){
    await page.locator('#choose-'+profile).tap();
    await expect(page.locator('.game-modes .mode-card')).toHaveCount(3);
    await page.locator('#home').tap();
  }
});

test('Explorer home distinguishes syncing, failed and offline saves from a cloud acknowledgment',async({page,context})=>{
  const account={id:'status-check',username:'star_ranger'};
  let failSave=true;
  let releaseSave;
  const allowFirstSave=new Promise(resolve=>{releaseSave=resolve;});

  await page.route('**/api/me',route=>route.fulfill({json:{account,revision:0,data:freshData()}}));
  await page.route('**/api/save',async route=>{
    if(failSave){
      await allowFirstSave;
      await route.fulfill({status:503,json:{error:'Temporarily unavailable'}});
    }else{
      await route.fulfill({json:{revision:1}});
    }
  });
  await page.goto('/');

  const status=page.locator('#explorer-home-sync');
  const username=page.locator('#explorer-home-name');
  await expect(username).toHaveText(account.username);
  await expect(status).toHaveText(/^saved to cloud$/i);
  await expect(page.getByRole('button',{name:'Sign in to My Explorer'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Create My Explorer'})).toHaveCount(0);

  await context.setOffline(true);
  await expect(status).toContainText(/offline/i);
  await expect(status).not.toHaveText(/^saved to cloud$/i);
  await context.setOffline(false);
  await expect(status).toHaveText(/^saved to cloud$/i);

  try{
    const saveRequested=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/save');
    await page.locator('#choose-ari').tap();
    await page.locator('#home').tap();
    await saveRequested;
    await expect(status).toBeVisible();
    await expect(status).not.toHaveText(/^saved to cloud$/i);
  }finally{
    releaseSave();
  }
  await expect(status).toContainText(/not synced|retry pending/i);

  await context.setOffline(true);
  await page.locator('#choose-ari').tap();
  await page.locator('#home').tap();
  await expect(status).toContainText(/offline/i);
  await expect(status).not.toHaveText(/^saved to cloud$/i);
  await expect(username).toHaveText(account.username);

  failSave=false;
  await context.setOffline(false);
  await expect(status).toHaveText(/^saved to cloud$/i,{timeout:15000});
});
