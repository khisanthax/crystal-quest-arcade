import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {newRun} from '../../dist/runner/model.js';
import {levelProgress} from '../../dist/runner/levels.js';

const ownerKey = process.env.CQ_GAME_MASTER_TEST_KEY;
const maintenanceKey = 'disposable-game-master-maintenance-test-key';
test.skip(!ownerKey, 'Run this test with playwright.game-master.config.js.');

test('owner dashboard protects data and applies reviewed gifts and adjustments once', async ({page, browser, baseURL}) => {
  const child = await browser.newContext({baseURL, hasTouch: true, viewport: {width: 1024, height: 768}});
  const post = (ctx, route, data, headers = {}) => ctx.request.post('/api/' + route, {
    data, headers: {Origin: baseURL, ...headers}
  });
  const accounts = [];
  const signupIP = '198.51.100.' + (20 + test.info().workerIndex % 200);
  async function signup(ctx, role) {
    const username = 'qa_gm_' + role.slice(0,1) + '_' + Date.now().toString(36);
    const result = await post(ctx, 'signup', {username, pin: '5682'}, {'CF-Connecting-IP': signupIP});
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
  const commit = async (form, reason, preview = 'Preview change', previewText) => {
    await form.getByLabel('Reason').fill(reason);
    await form.getByRole('button', {name: preview, exact: true}).tap();
    if (previewText) await expect(page.locator('#review')).toContainText(previewText);
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
    // Seed score records through the local maintenance API, then exercise the dashboard controls.
    const seeded = await (await child.request.get('/api/me')).json();
    const profile = seeded.data.profiles.ari;
    const runner = newRun('ari', 'earth-science', {theme: 'volcano'}, 42);
    runner.mode = 'paused';
    runner.score = 140;
    profile.stageCourses = {'earth-science~volcano~0': runner};
    profile.highScore = 320;
    const progress = levelProgress(profile, 'earth-science');
    progress.worlds.volcano = {stages: 1, finishes: 0, bestScore: 200, stageIds: [0]};
    progress.worlds.cosmic = {stages: 1, finishes: 0, bestScore: 55, stageIds: [0]};
    const seedResult = await post(page.context(), 'admin', {
      action: 'restore', username: learner.username, revision: seeded.revision, confirmed: true, data: seeded.data
    }, {'x-cq-admin-key': maintenanceKey});
    expect(seedResult.ok(), await seedResult.text()).toBe(true);
    expect((await child.request.get('/admin')).ok()).toBe(false);
    expect((await child.request.get('/admin/index.html')).ok()).toBe(false);
    expect((await gm(child, {action: 'list'})).status()).toBe(403);
    expect((await post(page.context(), 'game-master', {action: 'list'})).status()).toBe(403);
    const dashboard = await page.goto('/admin');
    expect(dashboard.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
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
    await petForm.locator('select[name=operation]').selectOption('xp');
    await petForm.getByLabel('Pet species').selectOption('dragon');
    await petForm.getByRole('spinbutton', {name: 'Pet XP'}).fill('240');
    await commit(petForm, 'Restore earned pet XP');
    await petForm.locator('select[name=operation]').selectOption('replace');
    await petForm.getByLabel('Pet species').selectOption('dragon');
    await petForm.locator('select[name=replacement]').selectOption('icedragon');
    await commit(petForm, 'Correct selected species', 'Preview change', 'Replace Fire Dragon with Ice Dragon. Transfer 240 XP');
    await expect(page.getByRole('listitem').filter({hasText: /Ice Dragon.*240 XP.*Equipped/s})).toBeVisible();
    expect(await checkBalance()).toBe(450);

    await page.getByRole('button', {name: /Worlds & Levels/}).tap();
    const scores = page.locator('form[data-change="high-score-reset"]');
    const stageReset = scores.filter({has: page.getByRole('button', {name: 'Preview stage score reset'})});
    await commit(stageReset, 'Correct a saved stage score', 'Preview stage score reset', 'Crystal Caverns');
    const recordReset = scores.filter({has: page.getByRole('button', {name: 'Preview best score reset'})});
    await commit(recordReset, 'Correct one recorded best', 'Preview best score reset', 'Emberia · 200 points');
    const corrected = (await (await child.request.get('/api/me')).json()).data.profiles.ari;
    expect(corrected.stageCourses['earth-science~volcano~0']).toMatchObject({score: 0, mode: 'paused'});
    expect(corrected.levelProgress['earth-science'].worlds.volcano).toMatchObject({bestScore: 0, stageIds: [0]});
    expect(corrected.levelProgress['earth-science'].worlds.cosmic.bestScore).toBe(55);
    expect(corrected.highScore).toBe(320);

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
    const savedWallet = await checkBalance();
    await page.getByRole('button', {name: /Players/}).tap();
    const accountForm = page.locator('form[data-change="account"]');
    await accountForm.locator('select[name=operation]').selectOption('rotate-recovery');
    await commit(accountForm, 'Replace lost recovery passport');
    const recoveryDownload = page.waitForEvent('download');
    await page.getByRole('link', {name: 'Download recovery QR PNG'}).tap();
    const recoveredFile = await recoveryDownload;
    const recoveryImage = await readFile(await recoveredFile.path());
    expect(recoveryImage.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');

    const recoveryContext = await browser.newContext({baseURL, hasTouch: true, viewport: {width: 1024, height: 768}});
    try {
      const recoveryPage = await recoveryContext.newPage();
      const selectPassport = async () => {
        await recoveryPage.goto('/');
        await recoveryPage.locator('#explorer-home').tap();
        await recoveryPage.locator('#explorer-recover').tap();
        await recoveryPage.locator('#passport-file').setInputFiles({
          name: 'private-explorer-passport.png', mimeType: 'image/png', buffer: recoveryImage
        });
      };
      await selectPassport();
      await expect(recoveryPage.locator('#passport-image')).toBeVisible();
      await recoveryPage.locator('#passport-done').tap();
      const recovered = await (await recoveryContext.request.get('/api/me')).json();
      expect(recovered.account.id).toBe(learner.id);
      expect(recovered.data.profiles.ari.collection.wallet).toBe(savedWallet);
      expect(recovered.data.profiles.ari.collection.pets[0]).toMatchObject({species: 'icedragon', xp: 240});
      await recoveryPage.locator('#explorer-home').tap();
      await recoveryPage.locator('#sign-out').tap();
      await selectPassport();
      await expect(recoveryPage.locator('#recovery-message')).toContainText('replaced');
    } finally {
      await recoveryContext.close();
    }
    await page.getByRole('button', {name: 'Lock dashboard'}).tap();
    await expect(page.getByRole('button', {name: 'Unlock dashboard'})).toBeVisible();
  } finally {
    for (const account of accounts) await post(page.context(), 'admin', {
      action: 'delete-qa', username: account.username, accountId: account.id
    }, {'x-cq-admin-key': maintenanceKey});
    await child.close().catch(() => {});
  }
});
