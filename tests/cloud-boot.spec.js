import {expect,test} from '@playwright/test';
import {freshData} from '../dist/runner/store.js';

test('a slow cloud save loads before a player can leave the Arcade home',async({page})=>{
  let releaseSave;
  const ready=new Promise(resolve=>{releaseSave=resolve;});
  await page.route('**/api/me',async route=>{
    await ready;
    await route.fulfill({json:{account:{id:'boot-check',username:'boot_check'},revision:0,data:freshData()}});
  });

  try{
    await page.goto('/');
    await expect(page.getByRole('heading',{name:'Getting your adventures ready…'})).toBeVisible();
    await expect(page.locator('#choose-ari')).toHaveCount(0);
  }finally{
    releaseSave();
  }

  await expect(page.locator('#sync-status')).toHaveText('Saved to cloud');
  await page.locator('#choose-ari').tap();
  await page.locator('#reading-play').tap();
  await expect(page.locator('#reading-back')).toBeVisible();
});
