import {test, expect} from '@playwright/test';
import {history} from '../../dist/runner/store.js';
import {presentRecord, answerRecord} from '../../dist/runner/packs.js';
import {levelProgress} from '../../dist/runner/levels.js';
import {assignHomework, caseState} from '../../dist/reading/model.js';
import {readingFixture} from '../reading/fixture.mjs';

const ownerKey = process.env.CQ_GAME_MASTER_TEST_KEY;
const maintenanceKey = 'disposable-game-master-maintenance-test-key';
test.skip(!ownerKey, 'Run with playwright.game-master.config.js.');

test('owner report switches identity and test while keeping learning, homework, and world measures separate', async ({page, browser, baseURL}) => {
  const child = await browser.newContext({baseURL, hasTouch: true, viewport: {width: 1024, height: 768}});
  const post = (ctx, route, data, headers = {}) => ctx.request.post('/api/' + route, {
    data, headers: {Origin: baseURL, ...headers}
  });
  const maintenance = body => post(page.context(), 'admin', body, {'x-cq-admin-key': maintenanceKey});
  const accounts = [];
  const signupIP = '192.0.2.' + (120 + test.info().workerIndex % 100);
  async function signup(ctx, label) {
    const username = 'qa_pr_' + label + '_' + Date.now().toString(36);
    const response = await post(ctx, 'signup', {username, pin: '5682'}, {'CF-Connecting-IP': signupIP});
    expect(response.ok(), await response.text()).toBe(true);
    const account = (await response.json()).account;
    accounts.push(account);
    return account;
  }

  try {
    const owner = await signup(page.context(), 'o');
    const explorer = await signup(child, 'e');
    expect((await maintenance({action: 'designate-reading-admin', username: owner.username})).ok()).toBe(true);
    const seeded = await (await child.request.get('/api/me')).json();
    const data = seeded.data;
    const earth = data.packs['earth-science'];
    const sky = data.packs['patterns-sky'];
    const first = earth.questions[0];
    const retry = earth.questions.find(q => q.concepts.every(id => !first.concepts.includes(id)));
    const term = [...earth.vocabulary, ...earth.facts].find(c => c.id === retry.concepts[0]);
    const earthHistory = history(data, 'ari', earth.id);
    presentRecord(earthHistory, first);
    answerRecord(earthHistory, first, true, 0);
    presentRecord(earthHistory, retry);
    answerRecord(earthHistory, retry, false, 0);
    answerRecord(earthHistory, retry, true, 1);
    earthHistory.sessions = 1;
    earthHistory.lastSession = new Date().toISOString();
    const skyHistory = history(data, 'ari', sky.id);
    presentRecord(skyHistory, sky.questions[0]);
    answerRecord(skyHistory, sky.questions[0], true, 0);

    const sample = readingFixture();
    const totalMissions = sample.questions.length;
    const assigned = assignHomework(data, 'ari', sample);
    const reading = caseState(assigned, sample);
    for (const question of sample.questions) reading.written[question.id] = true;
    reading.completed = new Date().toISOString();
    const p = data.profiles.ari;
    p.journeys = {runner: {volcano: {completed: [0, 1]}}, original: {volcano: {completed: [0]}}};
    p.lastAdventure = {mode: 'runner', world: 'volcano', stage: 1, packId: earth.id};
    levelProgress(p, earth.id).worlds.volcano = {stages: 2, stageIds: [0, 1], bestScore: 144, finishes: 0};
    const setup = await maintenance({
      action: 'restore', username: explorer.username, revision: seeded.revision, confirmed: true, data
    });
    expect(setup.ok(), await setup.text()).toBe(true);
    const denied = await post(child, 'game-master', {
      action: 'progress-report', account: explorer.id, profile: 'emberia'
    }, {'x-cq-game-master-key': ownerKey});
    expect(denied.status()).toBe(403);

    await page.goto('/admin');
    await page.getByLabel('Owner key').fill(ownerKey);
    await page.getByRole('button', {name: 'Unlock dashboard'}).tap();
    await page.getByRole('button', {name: new RegExp(explorer.username)}).tap();
    await page.getByRole('button', {name: /Progress & Reports/}).tap();
    const pack = page.locator('select[name=report-pack]');
    const stats = page.locator('.report-stats');
    const readingRow = page.getByRole('listitem').filter({hasText: sample.title});
    const course = page.getByRole('listitem').filter({hasText: 'Temple Run 2/3'});
    await expect(pack).toHaveValue(earth.id);
    await expect(stats).toContainText('2 / ' + earth.questions.length);
    await expect(stats).toContainText('50%');
    await expect(page.getByRole('listitem').filter({hasText: term.term || term.definition}))
      .toContainText('1 incorrect attempt');
    await expect(readingRow).toContainText(`${totalMissions} of ${totalMissions} written · Completed`);
    await expect(course).toContainText('Original Adventure 1/3');
    await expect(course).toContainText('144 best points');

    await pack.selectOption(sky.id);
    await expect(stats).toContainText('100%');
    await expect(page.getByText('No concepts flagged for practice on this test.')).toBeVisible();
    await expect(course).toContainText('No best score yet');
    await expect(readingRow).toContainText(`${totalMissions} of ${totalMissions} written · Completed`);

    await page.locator('select[name=profile]').selectOption('luminara');
    await expect(pack).toHaveValue(sky.id);
    await expect(stats).toContainText('No attempts yet');
    await expect(page.getByText('No reading cases recorded for this identity.')).toBeVisible();

    await page.locator('select[name=profile]').selectOption('emberia');
    await expect(pack).toHaveValue(earth.id);
    await page.getByText('Reopen a reading mission', {exact: true}).tap();
    const repair = page.locator('form[data-change=mission-reset]');
    await repair.getByLabel('Reason').fill('Review the first mission again');
    await repair.getByRole('button', {name: 'Preview change'}).tap();
    await expect(page.locator('#review')).toContainText('Mission 1');
    await page.getByRole('button', {name: 'Apply confirmed change'}).tap();
    await expect(page.getByRole('status').first()).toContainText('Change saved.', {timeout: 15000});
    await expect(readingRow).toContainText(`${totalMissions - 1} of ${totalMissions} written · In progress`, {timeout: 15000});
    await page.setViewportSize({width: 1024, height: 768});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: test.info().outputPath('progress-report-1024.png')});
  } finally {
    for (const account of accounts) await maintenance({
      action: 'delete-qa', username: account.username, accountId: account.id
    });
    await child.close().catch(() => {});
  }
});
