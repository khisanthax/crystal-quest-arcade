import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test.skip(process.env.PW_DISABLE_OWNER_KEY !== '1', 'Run with PW_DISABLE_OWNER_KEY=1 to verify secure setup.');

test('missing owner key locks workshops while explorer gameplay and ordinary saves remain available', async ({page, browser, baseURL}) => {
  const child = await browser.newContext({baseURL, hasTouch: true});
  const key = (await readFile('.local/maintenance-key', 'utf8')).trim();
  const post = (context, route, data, headers = {}) => context.request.post('/api/' + route, {
    headers: {Origin: baseURL, ...headers}, data
  });
  const accounts = [];
  async function signup(ctx, role) {
    const username = 'qa_nokey_' + role + '_' + Date.now().toString(36);
    const response = await post(ctx, 'signup', {username, pin: '5682'}, {'CF-Connecting-IP': '203.0.113.77'});
    expect(response.ok(), await response.text()).toBe(true);
    const account = (await response.json()).account;
    accounts.push(account);
    return account;
  }

  try {
    const owner = await signup(page.context(), 'o');
    await signup(child, 'c');
    const designation = await post(page.context(), 'admin', {
      action: 'designate-reading-admin', username: owner.username
    }, {'x-cq-admin-key': key});
    expect(designation.ok(), await designation.text()).toBe(true);

    await page.goto('/');
    await page.locator('#parent-settings').tap();
    await expect(page.getByRole('heading', {name: 'Owner setup required'})).toBeVisible();
    await expect(page.getByRole('link', {name: 'Open Game Master'})).toHaveCount(0);
    await expect(page.locator('#manage')).toHaveCount(0);
    await page.locator('#admin-back').tap();
    await page.locator('#choose-ari').tap();
    await page.locator('#reading-play').tap();
    await page.locator('#new-case').tap();
    await expect(page.getByRole('heading', {name: 'Owner setup required'})).toBeVisible();
    await expect(page.locator('#homework-file')).toHaveCount(0);
    expect((await post(page.context(), 'reading-admin', {})).status()).toBe(403);

    const learner = await child.newPage();
    await learner.goto('/');
    await learner.locator('#parent-settings').tap();
    await expect(learner.getByRole('heading', {name: 'Administrator access'})).toBeVisible();
    await learner.locator('#admin-back').tap();
    await learner.locator('#choose-kal').tap();
    await expect(learner.locator('.mode-card')).toHaveCount(3);
    expect((await post(child, 'reading-admin', {})).status()).toBe(403);

    const save = await (await page.request.get('/api/me')).json();
    const allowed = await post(page.context(), 'save', {
      data: save.data, revision: save.revision, requestId: 'ordinary-save-without-owner-key'
    });
    expect(allowed.ok(), await allowed.text()).toBe(true);
    save.data.packs['earth-science'].title = 'Unauthorized study edit';
    expect((await post(page.context(), 'save', {
      data: save.data, revision: save.revision + 1, requestId: 'owner-key-required'
    })).status()).toBe(403);
  } finally {
    for (const account of accounts) await post(page.context(), 'admin', {
      action: 'delete-qa', username: account.username, accountId: account.id
    }, {'x-cq-admin-key': key});
    await child.close().catch(() => {});
  }
});
