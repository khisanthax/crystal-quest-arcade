import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {adopt, collection} from '../../dist/runner/collection.js';

const ownerKey = process.env.CQ_GAME_MASTER_TEST_KEY;
const maintenanceKey = 'disposable-game-master-maintenance-test-key';
test.skip(!ownerKey, 'Run with playwright.game-master.config.js.');

test('verified backup gates a whole-explorer reset and restores both identities', async ({page, browser, baseURL}) => {
  const child = await browser.newContext({baseURL, hasTouch: true, viewport: {width: 1024, height: 768}});
  const post = (ctx, route, data, headers = {}) => ctx.request.post('/api/' + route, {
    data, headers: {Origin: baseURL, ...headers}
  });
  const maintenance = body => post(page.context(), 'admin', body, {'x-cq-admin-key': maintenanceKey});
  const accounts = [];
  const signupIP = '203.0.113.' + (20 + test.info().workerIndex % 200);
  async function signup(ctx, label) {
    const username = 'qa_ss_' + label + '_' + Date.now().toString(36);
    const response = await post(ctx, 'signup', {username, pin: '5682'}, {'CF-Connecting-IP': signupIP});
    expect(response.ok(), await response.text()).toBe(true);
    const account = (await response.json()).account;
    accounts.push(account);
    return account;
  }
  const cloud = async () => (await child.request.get('/api/me')).json();
  const wallet = profile => profile.collection?.wallet ?? profile.crystals;

  try {
    const owner = await signup(page.context(), 'o');
    const explorer = await signup(child, 'e');
    expect((await maintenance({action: 'designate-reading-admin', username: owner.username})).ok()).toBe(true);
    const seed = await cloud();
    const emberia = seed.data.profiles.ari;
    const luminara = seed.data.profiles.kal;
    emberia.crystals = collection(emberia).wallet = 340;
    luminara.crystals = collection(luminara).wallet = 125;
    adopt(emberia, 'dog', true).xp = 245;
    luminara.highScore = 32;
    const seeded = await maintenance({
      action: 'restore', username: explorer.username, revision: seed.revision, confirmed: true, data: seed.data
    });
    expect(seeded.ok(), await seeded.text()).toBe(true);
    const before = await cloud();

    await page.goto('/admin');
    await page.getByLabel('Owner key').fill(ownerKey);
    await page.getByRole('button', {name: 'Unlock dashboard'}).tap();
    await page.getByRole('button', {name: new RegExp(explorer.username)}).tap();
    await page.getByRole('button', {name: /Backups & Recovery/}).tap();
    const backup = page.locator('form[data-change="snapshot-create"]');
    const danger = page.locator('#whole-account');
    const openDanger = () => danger.locator('summary').tap();
    const confirmation = page.locator('#review');

    async function createBackup(reason) {
      await backup.getByLabel('Type the explorer’s username').fill(explorer.username);
      await backup.getByLabel('Reason').fill(reason);
      await backup.getByRole('button', {name: 'Preview verified backup'}).tap();
      await expect(confirmation).toContainText('Emberia and Luminara');
      await confirmation.getByRole('button', {name: 'Create verified backup'}).tap();
      await expect(page.locator('#status')).toContainText('Verified backup created.');
      await expect(confirmation).toHaveCount(0);
    }

    await openDanger();
    await expect(danger.getByText('Create a verified backup of the current revision', {exact: false})).toBeVisible();
    await expect(danger.locator('form[data-change="account-reset"]')).toHaveCount(0);
    await createBackup('Verify the current explorer save');
    const snapshotDownload = page.waitForEvent('download');
    await page.getByRole('button', {name: 'Download revision ' + before.revision}).tap();
    const download = await snapshotDownload;
    const backupText = await readFile(await download.path(), 'utf8');
    const verified = JSON.parse(backupText);
    expect(verified.format).toBe('crystal-quest-verified-snapshot-v1');
    expect(verified.snapshot.revision).toBe(before.revision);
    expect(verified.snapshot.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(backupText).not.toMatch(/pin_hash|recovery_hash|token_hash/);

    await openDanger();
    const reset = danger.locator('form[data-change="account-reset"]');
    await reset.getByLabel('Type the explorer’s username').fill('another-explorer');
    await reset.getByLabel('Reason').fill('Restart both game saves');
    await reset.getByRole('button', {name: 'Preview whole-explorer reset'}).tap();
    await expect(reset.getByRole('alert')).toContainText('exact explorer username');
    await expect(confirmation).toHaveCount(0);
    await reset.getByLabel('Type the explorer’s username').fill(explorer.username);
    await reset.getByRole('button', {name: 'Preview whole-explorer reset'}).tap();
    await expect(confirmation).toContainText('crystals, pets and items');
    await expect(confirmation).toContainText('Emberia and Luminara');
    await expect(confirmation).toContainText('Revision ' + before.revision);
    await confirmation.getByRole('button', {name: 'Reset both identities'}).tap();
    await expect(page.locator('#status')).toContainText('Change saved.');
    await expect(confirmation).toHaveCount(0);

    const cleared = await cloud();
    expect(cleared.account.id).toBe(explorer.id);
    expect(cleared.revision).toBeGreaterThan(before.revision);
    expect(wallet(cleared.data.profiles.ari)).toBe(0);
    expect(wallet(cleared.data.profiles.kal)).toBe(0);
    expect(cleared.data.profiles.ari.collection?.pets || []).toHaveLength(0);
    expect(cleared.data.profiles.kal.highScore).toBe(0);
    const stale = await post(child, 'save', {
      data: before.data, revision: before.revision, requestId: 'stale-before-reset'
    });
    expect(stale.status()).toBe(409);

    await createBackup('Verify the reset save before restoring');
    await openDanger();
    const restore = danger.locator('form[data-change="snapshot-restore"]');
    await restore.locator('select[name=snapshotId]').selectOption(verified.snapshot.id);
    await restore.getByLabel('Type the explorer’s username').fill(explorer.username);
    await restore.getByLabel('Reason').fill('Restore the original game saves');
    await restore.getByRole('button', {name: 'Preview whole-explorer restore'}).tap();
    await expect(confirmation).toContainText('Revision ' + before.revision);
    await confirmation.getByRole('button', {name: 'Restore both identities'}).tap();
    await expect(page.locator('#status')).toContainText('Change saved.');
    await expect(confirmation).toHaveCount(0);

    const restored = await cloud();
    expect(restored.account.id).toBe(explorer.id);
    expect(wallet(restored.data.profiles.ari)).toBe(340);
    expect(wallet(restored.data.profiles.kal)).toBe(125);
    expect(restored.data.profiles.ari.collection.pets[0]).toMatchObject({species: 'dog', xp: 245});
    expect(restored.data.profiles.kal.highScore).toBe(32);
    await page.getByRole('button', {name: /Activity History/}).tap();
    await expect(page.locator('#audit-list').getByText('Explorer progress reset', {exact: true})).toBeVisible();
    await expect(page.locator('#audit-list').getByText('Explorer backup restored', {exact: true})).toBeVisible();
  } finally {
    for (const account of accounts) await maintenance({
      action: 'delete-qa', username: account.username, accountId: account.id
    });
    await child.close().catch(() => {});
  }
});
