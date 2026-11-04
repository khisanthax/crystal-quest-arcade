import {test,expect} from '@playwright/test';
import {unlockGameMaster} from '../reading/admin-fixture.mjs';

const maintenanceKey='disposable-game-master-maintenance-test-key';

test('Arcade home links to Game Master without changing who can unlock it',async({page,baseURL})=>{
 const adminLink=page.locator('#arcade-admin-link');
 const openAdminFromHome=async()=>{
  const [response]=await Promise.all([
   page.waitForResponse(r=>r.request().isNavigationRequest()&&new URL(r.url()).pathname==='/admin'),
   adminLink.tap(),
  ]);
  await expect(page).toHaveURL('/admin');
  return response.status();
 };
 const expectDenied=async()=>{
  expect(await openAdminFromHome()).toBe(403);
  await expect(page.locator('body')).toContainText('Sign in to the designated administrator Explorer');
  await expect(page.getByLabel('Owner key')).toHaveCount(0);
 };
 const maintenance=data=>page.request.post('/api/admin',{
  headers:{Origin:baseURL,'x-cq-admin-key':maintenanceKey},data,
 });

 await page.goto('/');
 await expect(adminLink).toHaveAttribute('href','/admin');
 for(const [width,height] of [[1024,768],[1180,820],[1366,1024]]){
  await page.setViewportSize({width,height});
  await expect(adminLink).toBeInViewport({ratio:1});
  const bounds=await adminLink.boundingBox();
  expect(bounds.width).toBeGreaterThanOrEqual(44);
  expect(bounds.height).toBeGreaterThanOrEqual(44);
 }
 await expectDenied();

 const username='qa_gm_home_'+Date.now().toString(36);
 const signup=await page.request.post('/api/signup',{
  headers:{Origin:baseURL,'CF-Connecting-IP':'198.51.100.249'},
  data:{username,pin:'5682'},
 });
 expect(signup.ok(),await signup.text()).toBe(true);
 const {account}=await signup.json();
 try{
  await page.goto('/');
  await expect(page.locator('#explorer-home-name')).toHaveText(username);
  await expectDenied();

  const designated=await maintenance({action:'designate-reading-admin',username});
  expect(designated.ok(),await designated.text()).toBe(true);
  await page.goto('/');
  expect(await openAdminFromHome()).toBe(200);
  await expect(page.getByRole('heading',{name:'Game Master',exact:true})).toBeVisible();
  await expect(page.getByLabel('Owner key')).toBeVisible();
  await expect(page.getByRole('navigation',{name:'Game Master sections'})).toBeHidden();
  await unlockGameMaster(page,false);
 }finally{
  const removed=await maintenance({action:'delete-qa',username,accountId:account.id});
  expect(removed.ok(),await removed.text()).toBe(true);
 }
});
