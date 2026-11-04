import {expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const sessions = new WeakMap();
let nextTestAddress = 0;

export async function unlockGameMaster(page, navigate = true) {
  const key = process.env.CQ_GAME_MASTER_TEST_KEY;
  if (!key) throw Error('Start the browser suite with its disposable Game Master key.');
  if (navigate) await page.goto('/admin');
  await page.getByLabel('Owner key').fill(key);
  await page.getByRole('button', {name: 'Unlock dashboard'}).tap();
  await expect(page.getByRole('navigation', {name: 'Game Master sections'})).toBeVisible();
}

export async function openParentWorkshop(page) {
  await page.goto('/');
  await expect(page.locator('#choose-ari')).toBeVisible();
  const data = await page.evaluate(() => window.crystalQuest.data);
  const origin = new URL(page.url()).origin;
  const key = (await readFile('.local/maintenance-key', 'utf8')).trim();
  const username = 'qa_parent_' + Date.now().toString(36);
  const post = (path, data, headers = {}) => page.request.post('/api/' + path, {
    headers: {Origin: origin, ...headers}, data
  });
  const maintenance = body => post('admin', body, {'x-cq-admin-key': key});
  const signupIP = '198.51.100.' + (1 + nextTestAddress++ % 240);
  const created = await post('signup', {username, pin: '5682'}, {'CF-Connecting-IP': signupIP});
  expect(created.ok(), await created.text()).toBe(true);
  const {account} = await created.json();
  sessions.set(page, () => maintenance({action: 'delete-qa', username, accountId: account.id}));
  expect((await maintenance({action: 'designate-reading-admin', username})).ok()).toBe(true);
  await unlockGameMaster(page);
  expect((await post('migrate', {data, revision: 0, confirmed: true, requestId: 'qa-seed'})).ok()).toBe(true);
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.crystalQuest.cloudAccount?.id)).toBe(account.id);
  await page.locator('#parent-settings').tap();
  await expect(page.getByRole('heading', {name: 'Parent Settings'})).toBeVisible();
}

export async function closeParentWorkshop(page) {
  const dispose = sessions.get(page);
  if (dispose) {
    expect((await dispose()).ok()).toBe(true);
    sessions.delete(page);
  }
}
