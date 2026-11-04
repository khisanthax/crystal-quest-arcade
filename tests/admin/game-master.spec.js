import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const ownerKey = process.env.CQ_GAME_MASTER_TEST_KEY;
const maintenanceKey = 'disposable-game-master-maintenance-test-key';
test.skip(!ownerKey, 'Run this test with playwright.game-master.config.js.');

test('owner dashboard protects data and applies reviewed gifts and adjustments once', async ({page, browser, baseURL}) => {
  const child = await browser.newContext({baseURL, hasTouch: true, viewport: {width: 1024, height: 768}});
  const post = (ctx, route, data, headers = {}) => ctx.request.post('/api/' + route, {
    data, headers: {Origin: baseURL, ...headers}
  });
  const accounts = [];
  async function signup(ctx, role) {
    const username = 'qa_gm_' + role.slice(0,1) + '_' + Date.now().toString(36);
    const result = await post(ctx, 'signup', {username, pin: '5682'});
    expect(result.ok(), await result.text()).toBe(true);
    const account = (await result.json()).account;
    accounts.push(account);
    return account;
  }
  const gm = (ctx, data) => post(ctx, 'game-master', data, {'x-cq-game-master-key': ownerKey});
  const lookup = (name) => page.getByRole('button', {name: new RegExp(name)});
  const unlock = async () => {
    await page.getByLabel('Owner key').fill(ownerKey);
    await page.getByRole('button', {name: 'Unlock dashboard'}).tap();
    await expect(page.getByRole('navigation', {name: 'Game Master sections'})).toBeVisible();
  };
  const commit = async (form, reason, preview = 'Preview change') => {
    await form.getByLabel('Reason').fill(reason);
    await form.getByRole('button', {name: preview, exact: true}).tap();
    const request = page.waitForRequest(r => r.url().endsWith('/api/game-master') && ['mutate', 'package-save'].includes(r.postDataJSON()?.action));
    await page.getByRole('button', {name: 'Apply confirmed change'}).tap();
    const sent = await request;
    await expect(page.getByRole('status').first()).toContainText('Change saved.');
    await expect(page.getByRole('button', {name: 'Apply confirmed change'})).toHaveCount(0);
    return sent.postDataJSON();
  };

  try {
    const owner = await signup(page.context(), 'owner');
    const learner = await signup(child, 'learner');
    expect((await post(page.context(), 'admin', {
      action: 'designate-reading-admin', username: owner.username
    }, {'x-cq-admin-key': maintenanceKey})).ok()).toBe(true);
    expect((await child.request.get('/admin')).ok()).toBe(false);
    expect((await child.request.get('/admin/index.html')).ok()).toBe(false);
    expect((await gm(child, {action: 'list'})).status()).toBe(403);
    expect((await post(page.context(), 'game-master', {action: 'list'})).status()).toBe(403);
    await page.goto('/admin');
    await unlock();
    await page.getByLabel('Find an explorer').fill(learner.username);
    await lookup(learner.username).tap();
    await page.getByRole('button', {name: /Crystals/}).tap();
    const walletForm = page.locator('form[data-change="wallet"]');
    await walletForm.getByLabel('Crystals', {exact: true}).fill('500');
    const award = await commit(walletForm, 'Birthday gift');
    await expect(page.getByText('◆ 500')).toBeVisible();
    expect((await gm(page.context(), award)).ok()).toBe(true);
    const checkBalance = async () => (await (await child.request.get('/api/me')).json())
      .data.profiles.ari.collection.wallet;
    expect(await checkBalance()).toBe(500);
    await walletForm.getByLabel('Adjustment').selectOption('remove');
    await walletForm.getByLabel('Crystals', {exact: true}).fill('501');
    await walletForm.getByLabel('Reason').fill('Invalid deduction');
    await walletForm.getByRole('button', {name: 'Preview change'}).tap();
    await expect(page.getByRole('status').first()).toContainText('negative');
    await walletForm.getByLabel('Crystals', {exact: true}).fill('50');
    await commit(walletForm, 'Purchase correction');
    expect(await checkBalance()).toBe(450);

    await page.getByRole('button', {name: /Pets & Items/}).tap();
    const petForm = page.locator('form[data-change="pet"]');
    await petForm.getByLabel('Pet species').selectOption('dragon');
    await commit(petForm, 'Special pet');
    await expect(page.getByRole('listitem').filter({hasText: /Fire Dragon.*XP/})).toBeVisible();
    const items = page.locator('form[data-change="item"]');
    await items.locator('select[name=item]').selectOption('apple');
    await items.getByRole('spinbutton', {name: 'Quantity', exact: true}).fill('3');
    await commit(items, 'A few treats');
    await expect(page.getByText('Apple × 3', {exact: true})).toBeVisible();

    await page.getByRole('button', {name: /Activity History/}).tap();
    await expect(page.getByText('Birthday gift', {exact: true})).toHaveCount(1);
    await expect(page.getByText('Special pet', {exact: true})).toBeVisible();
    await page.getByRole('button', {name: /Backups & Recovery/}).tap();
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', {name: 'Export this explorer'}).tap();
    const backupText = await readFile(await (await downloaded).path(), 'utf8');
    expect(backupText).toContain(learner.username);
    expect(backupText).not.toContain(ownerKey);
    expect(backupText).not.toMatch(/pin_hash|recovery_hash|token_hash/);

    await page.reload();
    await unlock();
    await lookup(learner.username).tap();
    await page.getByRole('button', {name: /Crystals/}).tap();
    await expect(page.getByText('◆ 450')).toBeVisible();
    await page.getByRole('button', {name: /Activity History/}).tap();
    const deduction = page.getByRole('listitem').filter({hasText: 'Purchase correction'});
    await deduction.getByRole('button', {name: 'Reverse adjustment'}).tap();
    await commit(page.locator('form[data-change="wallet"]'), 'Reverse mistaken deduction');
    expect(await checkBalance()).toBe(500);
    await expect(page.locator('#audit-list').getByText('Crystal adjustment reversed', {exact: true})).toBeVisible();

    await page.getByRole('button', {name: /Special Rewards/}).tap();
    const packageForm = page.locator('form[data-change="package-save"]');
    await packageForm.getByLabel('Package name').fill('Birthday gift box');
    await packageForm.getByRole('spinbutton', {name: 'Crystals', exact: true}).fill('20');
    await packageForm.locator('select[name=food]').selectOption('carrot');
    await commit(packageForm, 'Build a reward bundle', 'Preview package changes');
    const packageGrant = page.locator('form[data-change="reward-package"]');
    await expect(packageGrant.locator('select[name=id]')).toContainText('Birthday gift box');
    await commit(packageGrant, 'Award the gift box', 'Preview package grant');
    expect(await checkBalance()).toBe(520);
    const inventory = (await (await child.request.get('/api/me')).json()).data.profiles.ari.collection;
    expect(inventory.food.carrot).toBe(1);
    const gift = page.locator('form[data-change="reward"]');
    await gift.getByRole('button', {name: 'Pick one at random'}).tap();
    await expect(page.getByRole('status').first()).toContainText('Review the gift');
    await gift.getByRole('spinbutton', {name: 'Crystals', exact: true}).fill('10');
    const drawAward = await commit(gift, 'Surprise gift', 'Preview gift');
    expect(drawAward.targets).toHaveLength(1);
    expect(drawAward.draw.signature).toMatch(/^[a-f0-9]{64}$/);
    expect((await gm(page.context(), drawAward)).ok()).toBe(true);
    const drawHistory = await (await gm(page.context(), {action: 'audit', account: drawAward.targets[0].account})).json();
    expect(drawHistory.entries.filter(row => row.action === 'reward:random')).toHaveLength(1);

    await page.getByRole('button', {name: /Crystals/}).tap();
    await page.screenshot({path: test.info().outputPath('game-master-1180.png')});
    await page.setViewportSize({width: 1024, height: 768});
    await expect(page.getByRole('button', {name: /Backups & Recovery/})).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: test.info().outputPath('game-master-1024.png')});
    await page.getByRole('button', {name: 'Lock dashboard'}).tap();
    await expect(page.getByRole('button', {name: 'Unlock dashboard'})).toBeVisible();
  } finally {
    for (const account of accounts) await post(page.context(), 'admin', {
      action: 'delete-qa', username: account.username, accountId: account.id
    }, {'x-cq-admin-key': maintenanceKey});
    await child.close().catch(() => {});
  }
});
