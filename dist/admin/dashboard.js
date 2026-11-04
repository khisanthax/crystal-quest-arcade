import {mountBadges} from './badges.js';
import {badgeIcon} from '/shared/badges.js';
import {createRecoveryPassport} from '/cloud/client.bundle.js?v=passport-1';
import {esc} from '/runner/parent.js';
import {WORLDS} from '/runner/worlds.js';
import {homeworkAdmin} from '/reading/admin.js';

const $ = id => document.getElementById(id);
const profiles = {emberia: 'Emberia', luminara: 'Luminara'};
const storedProfiles = {emberia: 'ari', luminara: 'kal'};
const sections = {
  players: '👤 Players', crystals: '◆ Crystals', pets: '🐾 Pets & Items',
  rewards: '🎁 Special Rewards', worlds: '🗺 Worlds & Levels',
  study: '📚 Study & Homework', progress: '📊 Progress & Reports',
  audit: '📋 Activity History', backup: '🛟 Backups & Recovery'
};
const date = value => value ? new Date(value).toLocaleString() : 'No activity yet';
const options = (rows, current) => rows.map(([value, label]) =>
  `<option value="${esc(value)}"${value === current ? ' selected' : ''}>${esc(label)}</option>`).join('');
const select = (label, name, rows, current) =>
  `<label>${label}<select name="${name}">${options(rows, current)}</select></label>`;
const field = (label, name, attributes = '') => `<label>${label}<input name="${name}" ${attributes}></label>`;
const card = (label, value) => `<span class="chip">${label} <strong>${esc(value)}</strong></span>`;
const state = {
  key: '', section: 'players', selected: null, profile: 'emberia', reportPack: null,
  players: [], catalog: {}, detail: null, snapshots: [], rewardBadges: [], draft: null, pending: false, load: 0, recovery: null
};

function clearRecovery() {
  if (state.recovery?.image) URL.revokeObjectURL(state.recovery.image);
  state.recovery = null;
}

async function showRecovery(token) {
  const selected = player();
  clearRecovery();
  state.recovery = {
    account: selected.id,
    url: location.origin + '/#cq-recover=' + encodeURIComponent(token),
    image: null
  };
  try {
    const png = await createRecoveryPassport(token, selected.username);
    state.recovery.image = URL.createObjectURL(png);
    return 'Change saved. Download the new private recovery passport.';
  } catch {
    return 'Change saved. The PNG could not be created. Save the private recovery link instead.';
  }
}

function message(text, error = false) {
  $('status').textContent = text;
  $('status').classList.toggle('error', error);
}

async function request(action, body = {}, key = state.key) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const result = await fetch('/api/game-master', {
      method: 'POST', cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
      headers: {'Content-Type': 'application/json', 'x-cq-game-master-key': key},
      body: JSON.stringify({action, ...body})
    });
    const data = await result.json().catch(() => ({}));
    if (!result.ok) throw Error(data.error || 'Game Master could not reach the Arcade server.');
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw Error('The server took too long to respond. You can retry this change.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const player = () => state.players.find(p => p.id === state.selected);
const summary = () => player()?.profiles[state.profile];
const profileData = () => state.detail?.data?.profiles?.[storedProfiles[state.profile]];
const catalogRows = (category, fallback = true) => [
  ...(fallback ? [['', 'Choose an item']] : []),
  ...(state.catalog[category] || []).map(item => [item.id, item.species || item.name])
];

function download(data, name) {
  const file = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showPlayers() {
  const query = $('search').value.trim().toLowerCase();
  const matches = state.players.filter(p => p.username.toLowerCase().includes(query));
  $('player-list').innerHTML = matches.length ? matches.map(p =>
    `<button data-account="${esc(p.id)}" aria-pressed="${p.id === state.selected}">
      ${esc(p.username)}<small>${p.disabled ? 'Disabled' : 'Active explorer'}</small>
    </button>`).join('') : '<p>No matching explorers.</p>';
}

function panel(html) {
  $('work').innerHTML = html;
}

function actionForm(type, fields, label = 'Preview change') {
  return `<form data-change="${type}">
    ${fields}
    ${field('Reason', 'reason', 'required maxlength="180" placeholder="Birthday gift, correction, or other reason"')}
    <button class="primary">${label}</button><p class="form-error" role="alert" hidden></p>
  </form>`;
}

function title(heading, body) {
  panel(`<h2>${heading}</h2>${body}`);
}

function profilePicker() {
  return select('Fantasy identity', 'profile', Object.entries(profiles), state.profile);
}

function accountPanel(p) {
  const choices = [
    ['rename', 'Rename username'], ['reset-pin', 'Reset PIN'],
    ['revoke-sessions', 'Revoke existing sessions'], ['rotate-recovery', 'Replace recovery credential'],
    p.disabled ? ['enable', 'Re-enable account'] : ['disable', 'Disable account']
  ];
  const info = summary();
  title(esc(p.username), `
    <div class="chips">${card('Status', p.disabled ? 'Disabled' : 'Active')}
    ${card('Created', date(p.created))}${card('Last activity', date(p.lastActivity))}</div>
    ${profilePicker()}
    <div class="chips">${card('Crystals', info.wallet)}${card('Owned pets', info.petCount)}
    ${card('Current test', info.packTitle || 'None')}
    ${card('Current world', WORLDS[info.world]?.name || 'None')}
    ${card('Stage', Number.isInteger(info.stage) ? info.stage + 1 : 'None')}</div>
    ${actionForm('account', select('Account action', 'operation', choices) +
      field('New username', 'value', 'required maxlength="20" autocomplete="off"'))}
    ${state.recovery?.account === p.id ? `<div class="review"><h3>New private recovery passport</h3>
      <p>Save this passport securely before leaving this screen. It can be used once.</p>
      <div class="actions">
        ${state.recovery.image ? `<a class="button primary" href="${esc(state.recovery.image)}"
          download="private-explorer-${esc(p.username)}-passport.png">Download recovery QR PNG</a>` : ''}
        <button data-action="hide-recovery">Close passport</button>
      </div>
      <details><summary>Use a private link instead</summary>
        <label>Recovery link<input readonly value="${esc(state.recovery.url)}"></label>
      </details></div>` : ''}`);
}

function crystalPanel() {
  title('Crystal balance', `<p>Current balance <strong>◆ ${summary().wallet}</strong></p>${profilePicker()}
    ${actionForm('wallet', `<div class="fields">${select('Adjustment', 'operation',
      [['add', 'Add crystals'], ['remove', 'Remove crystals'], ['set', 'Set crystal balance']])}
      ${field('Crystals', 'amount', 'type="number" inputmode="numeric" min="1" step="1" required')}</div>`)}`);
}

function petPanel() {
  const collection = profileData()?.collection;
  const pets = collection?.pets || [];
  const petName = id => state.catalog.pets?.find(p => p.id === id)?.species || id;
  const owned = pets.length ? `<ul class="list">${pets.map(pet =>
    `<li><strong>${esc(pet.name)}</strong> · ${esc(petName(pet.species))} · ${pet.xp} XP
    ${collection.equipped === pet.id ? ' · Equipped' : ''}</li>`).join('')}</ul>` : '<p>No pets owned.</p>';
  title('Pets & items', `${profilePicker()}
    <h3>Owned pets</h3>${owned}
    <h3 class="section-gap">Manage a pet</h3>
    ${actionForm('pet', `<div class="fields">${select('Pet action', 'operation',
      [['grant', 'Grant pet'], ['revoke', 'Revoke pet'], ['restore', 'Restore pet'], ['xp', 'Set pet XP'],
        ...(pets.length ? [['replace', 'Replace pet']] : [])])}
      ${select('Pet species', 'item', catalogRows('pets'))}
      <div id="replacement-field" hidden>${select('Replacement species', 'replacement', [])}</div></div>
      <div id="xp-field" hidden>${field('Pet XP', 'xp', 'type="number" min="0" max="6000" step="1" disabled')}</div>`)}
    <h3 class="section-gap">Manage an item</h3>
    ${actionForm('item', `<div class="fields">${select('Item action', 'operation',
      [['grant', 'Grant item'], ['remove', 'Remove item'], ['set', 'Set quantity']])}
      ${select('Category', 'category', [['food', 'Food & treats'], ['accessories', 'Accessories']])}
      ${select('Item', 'item', catalogRows('food'))}
      ${field('Quantity', 'quantity', 'type="number" min="0" step="1" value="1" required')}</div>`)}
    <h3 class="section-gap">Current inventory</h3>
    <p>${esc(Object.entries(collection?.food || {}).filter(([, qty]) => qty > 0)
      .map(([id, qty]) => (state.catalog.food?.find(f => f.id === id)?.name || id) + ' × ' + qty).join(', ') || 'No treats')}</p>
    <p>${esc((collection?.accessories || []).map(id =>
      state.catalog.accessories?.find(a => a.id === id)?.name || id).join(', ') || 'No accessories')}</p>`);
  updatePetFields($('work').querySelector('form[data-change="pet"]'));
}

function badgeChoices(includeRetired) {
  return [['', 'None'], ...state.rewardBadges.filter(badge => badge.active || badge.id === includeRetired)
    .map(badge => [badge.id, badgeIcon(badge.icon) + ' ' + badge.name + (badge.active ? '' : ' (retired)')])];
}

function rewardItems() {
  return `<div class="fields">
    ${field('Crystals', 'crystals', 'type="number" min="0" step="1" value="0" required')}
    ${select('Pet', 'pet', [['', 'None'], ...catalogRows('pets', false)])}
    ${select('Treat', 'food', [['', 'None'], ...catalogRows('food', false)])}
    ${field('Treat quantity', 'foodQuantity', 'type="number" min="1" step="1" value="1" required')}
    ${select('Accessory', 'accessory', [['', 'None'], ...catalogRows('accessories', false)])}
    ${select('Collectible badge', 'badge', badgeChoices())}
  </div>`;
}

async function rewardPanel(token) {
  title('Special rewards', '<p>Loading reward packages…</p>');
  const result = await request('packages');
  if (token !== state.load) return;
  state.packages = result.packages;
  state.rewardBadges = result.badges || [];
  const recipients = state.players.filter(p => !p.disabled);
  const enabled = state.packages.filter(p => p.active);
  const active = enabled.filter(p => !p.change.badge || state.rewardBadges.some(badge => badge.id === p.change.badge && badge.active));
  const recipientFields = random => `<fieldset><legend>Recipients</legend>
      ${recipients.map(p => `<label class="check"><input name="recipients" type="checkbox" value="${esc(p.id)}"
        ${p.id === state.selected ? 'checked' : ''}> ${esc(p.username)}</label>`).join('')}
    </fieldset><div class="actions"><button type="button" data-action="all">Select all</button>
    ${random ? '<button type="button" data-action="random">Pick one at random</button>' : ''}</div>`;
  title('Special rewards', `${profilePicker()}
    <h3>Give a gift</h3>
    ${actionForm('reward', recipientFields(true) + rewardItems(), 'Preview gift')}
    ${active.length ? '<h3 class="section-gap">Award a saved package</h3>' +
      actionForm('reward-package', recipientFields(false) + select('Package', 'id', active.map(p => [p.id, p.name])), 'Preview package grant') : ''}
    ${active.length !== enabled.length ? '<p>Packages with retired badges need editing before they can be awarded.</p>' : ''}
    <h3 class="section-gap">Create or edit a reward package</h3>
    <div class="fields">${select('Saved package', 'edit-package', [['', 'New package'],
      ...state.packages.map(p => [p.id, p.name + (p.active ? '' : ' (inactive)')])])}
      <button data-action="duplicate-package" disabled>Duplicate package</button></div>
    ${actionForm('package-save', field('Package name', 'name', 'required maxlength="70"') +
      '<label class="check"><input name="active" type="checkbox" checked> Available to award</label>' +
      rewardItems(), 'Preview package changes')}
    <section id="badge-host" class="section-gap"><h3>Collectible badges</h3><p data-badge-status>Loading badges…</p></section>`);
  await mountBadges({host:$('badge-host'),request,players:state.players,selected:state.selected,
    profile:state.profile,refresh:refreshPlayers,message});
}

function editPackage(id, duplicate = false) {
  const form = $('work').querySelector('form[data-change="package-save"]');
  const p = state.packages.find(x => x.id === id);
  form.reset();
  form.elements.badge.innerHTML = options(badgeChoices(p?.change.badge), p?.change.badge);
  form.dataset.id = p && !duplicate ? p.id : '';
  const duplicateButton = $('work').querySelector('[data-action="duplicate-package"]');
  duplicateButton.disabled = !p || duplicate;
  if (!p) return;
  form.elements.name.value = duplicate ? (p.name + ' copy').slice(0, 70) : p.name;
  form.elements.active.checked = !!p.active;
  for (const field of ['crystals', 'pet', 'food', 'foodQuantity', 'accessory']) {
    if (p.change[field] !== undefined) form.elements[field].value = p.change[field];
  }
  if (duplicate) {
    $('work').querySelector('[name="edit-package"]').value = '';
    form.elements.name.focus();
  }
}

function worldsPanel() {
  const profile = profileData();
  const packs = state.detail?.data?.packs || {};
  const seenRunnerSaves = new Set();
  const saves = ['stageCourses', 'originalCourses', 'courses', 'runs'].flatMap(field =>
    Object.entries(profile?.[field] || {}).flatMap(([key, record]) => {
      const run = record.ledger || record;
      const original = field === 'originalCourses';
      const runnerKey = run.sessionId && run.sessionId + '|' + run.stage;
      if (!original && runnerKey && seenRunnerSaves.has(runnerKey)) return [];
      if (!original && runnerKey) seenRunnerSaves.add(runnerKey);
      const world = run.theme || run.world;
      const mode = original ? 'Original Adventure' : 'Temple Run';
      const stage = WORLDS[world]?.stages[run.stage];
      const label = [mode, WORLDS[world]?.name, stage, packs[run.packId]?.title].filter(Boolean).join(' · ');
      const score = Math.max(run.score || 0, record.progress?.run?.score || 0);
      return [{id: field + '|' + key, label, score}];
    }));
  const scoredSaves = saves.filter(s => s.score > 0).map(s => [s.id, s.label + ' · ' + s.score + ' points']);
  const recordedBests = Object.entries(profile?.levelProgress || {}).flatMap(([packId, entry]) =>
    Object.entries(entry.worlds || {}).filter(([, world]) => world.bestScore > 0).map(([world, record]) => [
      JSON.stringify([packId, world]), (packs[packId]?.title || packId) + ' · ' + WORLDS[world]?.name + ' · ' + record.bestScore + ' points'
    ]));
  const completed = Object.entries(profile?.journeys || {}).flatMap(([mode, worlds]) =>
    Object.entries(worlds).filter(([, record]) => record.completed.length).map(([world, record]) =>
      `<li>${mode === 'original' ? 'Original Adventure' : 'Temple Run'} · ${esc(WORLDS[world]?.name || world)} ·
        ${esc(record.completed.map(stage => WORLDS[world]?.stages[stage] || stage + 1).join(', '))}</li>`));
  title('Worlds & levels', `${profilePicker()}
    <h3>Completed stages</h3>
    ${completed.length ? `<ul class="list">${completed.join('')}</ul>` : '<p>No completed stages recorded.</p>'}
    <h3>Correct stage completion</h3>
    ${actionForm('stage-status', '<div class="fields">' +
      select('Game mode', 'mode', [['runner', 'Temple Run'], ['original', 'Original Adventure']]) +
      select('World', 'world', Object.entries(WORLDS).map(([id, world]) => [id, world.name])) +
      select('Stage', 'stage', WORLDS.volcano.stages.map((name, index) => [index, name])) +
      select('Completion', 'completed', [['true', 'Mark complete'], ['false', 'Mark incomplete']]) + '</div>')}
    <h3 class="section-gap">Reset a saved course</h3>
    ${saves.length ? actionForm('run-reset', '<p>Clear a saved course to start that course again. Study history is kept separately.</p>' +
      select('Saved course', 'course', saves.map(s => [s.id, s.label]))) : '<p>This profile has no saved courses.</p>'}
    <h3 class="section-gap">Reset a score</h3>
    ${scoredSaves.length ? actionForm('high-score-reset', '<p>Reset points for a saved stage and keep its progress.</p>' +
      select('Saved stage score', 'course', scoredSaves), 'Preview stage score reset') : '<p>No saved stages have points to reset.</p>'}
    ${recordedBests.length ? actionForm('high-score-reset', '<p>Reset a recorded best score for one test in one world.</p>' +
      select('Test and world best score', 'record', recordedBests), 'Preview best score reset') : '<p>No test and world best scores to reset.</p>'}`);
}

function reportStats(coverage) {
  const stats = [
    ['Questions shown', coverage.attempted + ' / ' + coverage.totalQuestions],
    ['First-attempt accuracy', coverage.accuracy === null ? 'No attempts yet' : coverage.accuracy + '%'],
    ['Concepts assessed', coverage.assessedConcepts + ' / ' + coverage.totalConcepts],
    ['Concepts mastered', coverage.mastered + ' / ' + coverage.totalConcepts],
    ['Concepts to practice', coverage.needsPractice],
    ['Study sessions', coverage.sessions],
    ['Latest session', coverage.lastSession ? date(coverage.lastSession) : 'No sessions yet']
  ];
  return `<dl class="report-stats">${stats.map(([label, value]) =>
    `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>
    ${coverage.presented ? `<p>${coverage.firstCorrect} first-try correct out of ${coverage.presented} prompts shown.</p>` : ''}`;
}

function missedConcepts(missed) {
  if (!missed.length) return '<p>No concepts flagged for practice on this test.</p>';
  return `<ul class="list">${missed.map(concept => `<li>
    <strong>${esc(concept.label)}</strong>
    <p>${concept.incorrect} incorrect ${concept.incorrect === 1 ? 'attempt' : 'attempts'}${concept.latest ? ' · Last seen ' + esc(date(concept.latest)) : ''}</p>
  </li>`).join('')}</ul>`;
}

function readingReport(cases) {
  if (!cases.length) return '<p>No reading cases recorded for this identity.</p>';
  return `<ul class="list">${cases.map(record => `<li>
    <strong>${esc(record.title)}</strong>
    <p>${record.written} of ${record.total} written · ${record.completedAt ? 'Completed' : record.attempts ? 'In progress' : 'Not started'}
    ${record.active ? ' · Current case' : ''} · ${record.attempts} ${record.attempts === 1 ? 'case attempt' : 'case attempts'}</p>
  </li>`).join('')}</ul>`;
}

function worldReport(worlds) {
  const played = worlds.filter(world =>
    world.runnerCompleted.length || world.originalCompleted.length || world.packStagesCompleted.length ||
    world.bestScore || world.finishes);
  if (!played.length) return '<p>No course progress recorded for this identity.</p>';
  return `<ul class="list">${played.map(world => `<li>
    <strong>${esc(world.name)}</strong>
    <p>Temple Run ${world.runnerCompleted.length}/3 · Original Adventure ${world.originalCompleted.length}/3</p>
    <small>Selected test · ${world.packStagesCompleted.length}/3 stages · ${world.bestScore === null ? 'No best score yet' : world.bestScore + ' best points'} ·
      ${world.finishes} ${world.finishes === 1 ? 'course finish' : 'course finishes'}</small>
  </li>`).join('')}</ul>`;
}

async function progressPanel(token) {
  title('Progress & reports', '<p>Loading the selected explorer’s report…</p>');
  const report = await request('progress-report', {
    account: state.selected, profile: state.profile, packId: state.reportPack || undefined
  });
  if (token !== state.load) return;
  state.reportPack = report.pack.id;
  const cases = report.homework.cases;
  const missions = cases.filter(record => record.attempts > 0).flatMap(record => (record.missions || []).map(mission =>
    [record.id + '|' + mission.id, record.title + ' · Mission ' + mission.number]));
  const needsPractice = report.missed.filter(concept => concept.review > 0);
  const priorMisses = report.missed.filter(concept => concept.review === 0);
  const packOptions = report.packs.map(p => [p.id, p.title + (p.archived ? ' (past test)' : '')]);
  const location = report.location;
  const activeWorld = location && WORLDS[location.world];
  const locationLabel = activeWorld && [activeWorld.name, activeWorld.stages[location.stage]].filter(Boolean).join(' · ');
  title('Progress & reports', `
    <p>Learning and game records for <strong>${esc(player().username)}</strong>.</p>
    <div class="report-filters">${profilePicker()}${select('Study pack', 'report-pack', packOptions, report.pack.id)}</div>
    <h3>Learning coverage</h3>
    ${reportStats(report.coverage)}
    <h3 class="section-gap">Concepts to practice</h3>
    ${missedConcepts(needsPractice)}
    ${priorMisses.length ? `<details><summary>Earlier missed concepts</summary>${missedConcepts(priorMisses)}</details>` : ''}
    <h3 class="section-gap">Reading Detective</h3>
    ${readingReport(cases)}
    <h3 class="section-gap">Worlds & courses</h3>
    ${locationLabel ? `<p>Last played ${esc(locationLabel)}.</p>` : ''}
    ${worldReport(report.worlds)}
    ${missions.length ? `<details class="section-gap"><summary>Reopen a reading mission</summary>
      ${actionForm('mission-reset', '<p>Reset this mission in the most recent case attempt.</p>' +
        select('Mission', 'mission', missions))}</details>` : ''}`);
}

function verificationFields() {
  return field('Type the explorer’s username', 'username', 'required maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false"');
}

function snapshotLabel(snapshot) {
  return 'Revision ' + snapshot.revision + ' · ' + date(snapshot.created);
}

function verifiedSnapshots() {
  const current = state.snapshots.find(snapshot => snapshot.current);
  const past = state.snapshots.filter(snapshot => !snapshot.current);
  const username = player().username;
  return `<section class="section-gap">
    <h3>Verified account backups</h3>
    <p>Each verified backup covers both Emberia and Luminara for ${esc(username)}. It includes crystals,
      pets, rewards, worlds, study progress, and Reading Detective cases.</p>
    ${current
      ? `<p>Current backup <strong>${esc(snapshotLabel(current))}</strong>.</p>`
      : actionForm('snapshot-create', '<p>Create a verified backup of the current cloud save.</p>' +
        verificationFields(), 'Preview verified backup')}
    ${state.snapshots.length ? `<ul class="list">${state.snapshots.map(snapshot => `<li>
      <strong>${esc(snapshotLabel(snapshot))}</strong>${snapshot.current ? ' · Current' : ''}
      <small> · Check ${esc(snapshot.digest.slice(0, 12))}</small>
      <div class="actions"><button data-action="snapshot-download" data-snapshot-id="${esc(snapshot.id)}">
        Download revision ${snapshot.revision}</button></div></li>`).join('')}</ul>` : ''}
    </section>
    <details class="review section-gap" id="whole-account">
      <summary>Reset or restore the whole explorer</summary>
      <h3 class="section-gap">Change both fantasy identities</h3>
      <p>These tools affect all saved game progress for ${esc(username)}. After a reset or restore,
        load the updated cloud save on any iPad before playing.</p>
      ${current ? actionForm('account-reset', '<h3>Reset explorer progress</h3><p>Start over with both identities. ' +
        'The verified backup stays available for restoration.</p>' + verificationFields(), 'Preview whole-explorer reset')
        : '<p>Create a verified backup of the current revision before resetting or restoring this explorer.</p>'}
      ${current && past.length ? actionForm('snapshot-restore', '<h3>Restore a verified backup</h3>' +
        '<p>Replace both identities with an earlier verified backup. Keep the current verified backup in case you need to undo the restore.</p>' +
        select('Earlier verified backup', 'snapshotId', past.map(snapshot => [snapshot.id, snapshotLabel(snapshot)])) +
        verificationFields(), 'Preview whole-explorer restore') : ''}
    </details>`;
}

function backupPanel() {
  const rows = (state.detail?.backups || []).map(b => [b.revision, 'Revision ' + b.revision + ' · ' + date(b.created)]);
  title('Backups & recovery', `${profilePicker()}<p>Keep downloaded saves private. They include learning and purchase history.</p>
    <div class="actions"><button data-action="backup-one">Export this explorer</button>
    <button data-action="backup-all">Export all explorers</button></div>
    ${rows.length ? actionForm('restore', '<h3>Restore a saved revision</h3><p>This restores the selected identity’s gameplay and study progress. Its wallet, pets, and Reading Detective cases stay current.</p>' +
      select('Available backups', 'revision', rows)) : '<p>No previous save revisions available.</p>'}
    ${verifiedSnapshots()}`);
}

const auditLabels = {
  'wallet:add': 'Crystals added', 'wallet:remove': 'Crystals removed',
  'wallet:set': 'Balance set', 'wallet:reverse': 'Crystal adjustment reversed',
  'pet:grant': 'Pet granted', 'pet:revoke': 'Pet revoked', 'pet:restore': 'Pet restored',
  'pet:xp': 'Pet XP changed', 'pet:replace': 'Pet replaced', 'item:grant': 'Item granted', 'item:remove': 'Item removed',
  'item:set': 'Item quantity set', reward: 'Gifts awarded', 'run-reset': 'Course save cleared',
  'stage-status': 'Stage completion changed', 'high-score-reset': 'Score reset', 'mission-reset': 'Reading mission reopened',
  'study-pack:assign': 'Study pack assigned', 'study-pack:archive': 'Study pack archived',
  restore: 'Profile progress restored', 'snapshot:create': 'Verified backup created',
  'snapshot-create': 'Verified backup created', 'account-reset': 'Explorer progress reset', 'snapshot-restore': 'Explorer backup restored', 'reward:random': 'Surprise gift awarded',
  'reward-package': 'Reward package awarded', 'package:save': 'Reward package saved', badge: 'Collectible badge awarded', 'badge:save': 'Collectible badge saved'
};

function auditDetail(entry) {
  const before = entry.previous || {};
  const after = entry.updated || {};
  const changes = [];
  if (Number.isInteger(after.wallet)) changes.push('◆ ' + before.wallet + ' → ◆ ' + after.wallet);
  if (entry.action === 'pet:replace' && before.pet && after.pet) {
    const names = [before.pet.species, after.pet.species].map(id => state.catalog.pets.find(p => p.id === id)?.species || id);
    changes.push(names.join(' → ') + ' · ' + after.pet.xp + ' XP');
  } else if (after.pet) changes.push(after.pet.name + ' · ' + after.pet.xp + ' XP');
  if (before.pet && after.pet === null) changes.push(before.pet.name + ' removed');
  if (after.item) changes.push((state.catalog.food.find(p => p.id === after.item) ||
    state.catalog.accessories.find(p => p.id === after.item))?.name + ' · ' + before.quantity + ' → ' + after.quantity);
  if (after.username) changes.push(after.username);
  if (entry.action === 'high-score-reset') {
    const beforeScore = before.score ?? before.bestScore;
    if (beforeScore !== undefined) changes.push(beforeScore + ' → 0 points');
  }
  if (after.randomDraw) changes.push('Recipient selected by draw');
  if (after.package?.name) changes.push(after.package.name);
  if (after.badge?.name) changes.push(after.badge.name);
  if (after.reversalOf) changes.push('Reverses adjustment ' + after.reversalOf);
  return changes.join(' · ');
}

async function auditPanel(token) {
  title('Activity history', '<p>Loading history…</p>');
  const data = await request('audit', {account: state.selected});
  if (token !== state.load) return;
  state.audit = data.entries;
  title('Activity history', `<p>Recorded administrative changes for ${esc(player().username)}.</p>
    <div class="fields">
      ${select('Filter by action', 'audit-filter', [['', 'All actions'],
        ...[...new Set(state.audit.map(e => e.action))].map(action => [action, auditLabels[action] || action])])}
      ${field('On or after', 'audit-date', 'type="date"')}
    </div>
    <div id="audit-list"></div>`);
  renderAudit();
}

function renderAudit() {
  const action = $('work').querySelector('[name="audit-filter"]').value;
  const since = $('work').querySelector('[name="audit-date"]').value;
  const filtered = state.audit.filter(e => (!action || action === e.action) &&
    (!since || e.created >= new Date(since + 'T00:00').getTime()));
  const reversed = new Set(state.audit.map(e => e.updated?.reversalOf));
  $('audit-list').innerHTML = filtered.length ? `<ul class="list">${filtered.map(entry => {
    const actor = state.players.find(p => p.id === entry.actor)?.username || 'Owner';
    const canReverse = ['wallet:add', 'wallet:remove', 'wallet:set'].includes(entry.action) &&
      entry.updated?.wallet !== entry.previous?.wallet && !reversed.has(entry.id);
    return `<li><strong>${esc(auditLabels[entry.action] || entry.action)}</strong> · ${esc(date(entry.created))}
      <p>${esc(profiles[entry.profile] || 'Account')} · ${esc(actor)}</p>
      <p>${esc(entry.reason || '')}</p>
      <p>${esc(auditDetail(entry))}</p>
      ${canReverse ? `<button data-action="reverse" data-audit-id="${entry.id}">Reverse adjustment</button>` : ''}</li>`;
  }).join('')}</ul>` : '<p>No matching administrative changes.</p>';
}

function studyPanel() {
  const packs = Object.values(state.detail?.data?.packs || {});
  title('Study packs & homework', `<div class="actions">
    <button data-action="workshop" class="primary">Homework Workshop</button>
    <a href="/" class="button">Arcade study-pack settings</a></div>
    <p>Open Homework Workshop to import, review, and publish Reading Detective cases.</p>
    ${packs.length ? profilePicker() + actionForm('study-pack', '<h3>Manage a test for this player</h3>' +
      select('Action', 'operation', [['assign', 'Assign as current test'], ['archive', 'Archive test']]) +
      select('Study pack', 'packId', packs.map(p => [p.id, p.title]), summary().packId)) :
      '<p>Select an explorer to change their current test.</p>'}`);
}

async function render() {
  const token = ++state.load;
  state.draft = null;
  state.detail = null;
  state.snapshots = [];
  const p = player();
  $('sections').innerHTML = Object.entries(sections).map(([id, label]) =>
    `<button data-section="${id}" aria-pressed="${state.section === id}">${label}</button>`).join('');
  showPlayers();
  if (!p && state.section === 'study') return studyPanel();
  if (!p) return title('Choose an explorer', '<p>Select an account from the player list to get started.</p>');
  try {
    if (state.section === 'audit') return await auditPanel(token);
    if (state.section === 'rewards') return await rewardPanel(token);
    if (state.section === 'progress') return await progressPanel(token);
    if (['pets', 'worlds', 'backup', 'study'].includes(state.section)) {
      title('Loading player details', '<p>Fetching the current save…</p>');
      const account = p.id;
      const [detail, snapshotResult] = await Promise.all([
        request('detail', {account}),
        state.section === 'backup' ? request('snapshots', {account}) : null
      ]);
      if (token !== state.load) return;
      state.detail = detail;
      state.snapshots = snapshotResult?.snapshots || [];
    }
    ({
      players: accountPanel, crystals: crystalPanel, pets: petPanel,
      worlds: worldsPanel, backup: backupPanel, study: studyPanel
    })[state.section](p);
  } catch (e) {
    if (token !== state.load) return;
    title('Could not load this section', `<p>${esc(e.message)}</p><button data-action="retry">Try again</button>`);
  }
}

function changeText(change, recipients, form) {
  switch (change.type) {
    case 'wallet': {
      const before = summary().wallet;
      const audit = change.operation === 'reverse' && state.audit.find(row => row.id === change.auditId);
      const after = audit ? before - (audit.updated.wallet - audit.previous.wallet) :
        change.operation === 'set' ? change.amount :
        before + (change.operation === 'remove' ? -change.amount : change.amount);
      if (after < 0) throw Error('That would make the crystal balance negative.');
      return `Crystal balance will change from ◆ ${before} to ◆ ${after}.`;
    }
    case 'pet': {
      const pet = state.catalog.pets.find(p => p.id === change.item);
      if (!pet) throw Error('Choose a pet species.');
      if (change.operation === 'replace') {
        const collection = profileData()?.collection;
        const existing = collection?.pets.find(p => p.species === change.item);
        const replacement = state.catalog.pets.find(p => p.id === change.replacement);
        if (!existing || !replacement) throw Error('Choose an owned pet and a replacement species.');
        const equipped = collection.equipped === existing.id;
        const customName = existing.name !== pet.name ? ' Custom name: ' + existing.name + '.' : '';
        return `Replace ${pet.species} with ${replacement.species}. Transfer ${existing.xp} XP and compatible accessories.${customName}${equipped ? ' The replacement will be equipped.' : ''}`;
      }
      if (change.operation === 'xp') return `Set ${pet.species} to ${change.xp} XP.`;
      if (change.operation === 'revoke') {
        const collection = profileData()?.collection;
        const equipped = collection?.equipped === change.item;
        return `Remove ${pet.species} from this collection.${equipped ? ' The equipped companion will be removed.' : ''}
          The pet’s XP and equipped accessories leave the active pet record.`;
      }
      return `${change.operation === 'restore' ? 'Restore' : 'Grant'} ${pet.species} without a crystal charge.`;
    }
    case 'item': {
      const item = state.catalog[change.category]?.find(p => p.id === change.item);
      if (!item) throw Error('Choose an inventory item.');
      return `Item change: ${change.operation} ${item.name} (quantity ${change.quantity}).`;
    }
    case 'high-score-reset': {
      const record = (form.elements.course || form.elements.record).selectedOptions[0].textContent;
      return 'Reset to 0 points: ' + record + '.';
    }
    case 'run-reset': return 'Clear this saved course: ' + form.elements.course.selectedOptions[0].textContent + '.';
    case 'stage-status': return (change.completed ? 'Mark complete: ' : 'Mark incomplete: ') +
      WORLDS[change.world].name + ' · ' + WORLDS[change.world].stages[change.stage] + '.';
    case 'mission-reset': return 'Reopen ' + form.elements.mission.selectedOptions[0].textContent + '.';
    case 'study-pack': return (change.operation === 'assign' ? 'Assign ' : 'Archive ') +
      state.detail?.data?.packs[change.packId]?.title + '.';
    case 'account-reset': return 'Reset crystals, pets and items, world stages, learning, reading cases, and badges for Emberia and Luminara. Verified backup ' +
      snapshotLabel(state.snapshots.find(snapshot => snapshot.id === change.snapshotId)) + '.';
    case 'snapshot-restore': return 'Replace progress for Emberia and Luminara with ' +
      snapshotLabel(state.snapshots.find(snapshot => snapshot.id === change.snapshotId)) +
      '. Your current verified backup will still be available.';
    case 'restore': return 'Restore this identity’s gameplay and study progress to revision ' + change.revision + '.';
    case 'account': {
      const action = change.operation.replaceAll('-', ' ');
      return change.operation === 'rename' ? 'Rename the explorer to ' + change.value + '.' :
        'Account change: ' + action + '.';
    }
    case 'reward': return `Give each of ${recipients.length} selected explorers ${rewardText(change)}.`;
    case 'reward-package': {
      const p = state.packages.find(x => x.id === change.id && x.active);
      if (!p) throw Error('Choose an active reward package.');
      return `Grant ${p.name} to each selected explorer. Contents: ${rewardText(p.change)}.`;
    }
  }
  return 'Apply this change.';
}

function rewardText(change) {
  const pet = state.catalog.pets.find(p => p.id === change.pet);
  const food = state.catalog.food.find(p => p.id === change.food);
  const accessory = state.catalog.accessories.find(p => p.id === change.accessory);
  const badge = state.rewardBadges.find(p => p.id === change.badge);
  const gifts = [change.crystals > 0 && '◆ ' + change.crystals, pet?.species,
    food && food.name + ' × ' + change.foodQuantity, accessory?.name,
    badge && badge.name + ' collectible badge' + (badge.active ? '' : ' (retired)')].filter(Boolean);
  if (!gifts.length) throw Error('Choose at least one gift.');
  return gifts.join(', ');
}

function updatePetFields(form) {
  const owned = new Set((profileData()?.collection?.pets || []).map(pet => pet.species));
  const operation = form.elements.operation.value;
  const replacement = operation === 'replace';
  const existing = ['revoke', 'xp', 'replace'].includes(operation);
  const rows = catalogRows('pets');
  const selected = form.elements.item.value;
  form.elements.item.innerHTML = options(rows.filter(([id]) => !id || existing === owned.has(id)), selected);
  const replaceField = form.elements.replacement;
  replaceField.innerHTML = options(rows.filter(([id]) => !owned.has(id)));
  replaceField.disabled = !replacement;
  replaceField.required = replacement;
  $('replacement-field').hidden = !replacement;
}

function requireActiveBadge(id) {
  const badge = state.rewardBadges.find(item => item.id === id && item.active);
  if (!badge) throw Error('Choose an available badge before continuing.');
  return badge;
}

function prepare(form) {
  const values = new FormData(form);
  const change = {type: form.dataset.change};
  const reason = String(values.get('reason') || '').trim();
  if (!reason) throw Error('Enter a reason for this change.');
  for (const [name, value] of values) {
    if (!['reason', 'recipients'].includes(name) && value !== '') {
      change[name] = ['amount', 'crystals', 'foodQuantity', 'xp', 'quantity', 'revision', 'auditId', 'stage'].includes(name)
        ? Number(value) : name === 'username' ? String(value) : String(value).trim();
    }
  }
  if (change.course) {
    const divider = change.course.indexOf('|');
    change.courseField = change.course.slice(0, divider);
    change.courseKey = change.course.slice(divider + 1);
    delete change.course;
  }
  if (change.record) {
    [change.packId, change.world] = JSON.parse(change.record);
    delete change.record;
  }
  if (change.mission) {
    [change.packId, change.questionId] = change.mission.split('|');
    delete change.mission;
  }
  if (change.completed !== undefined) change.completed = change.completed === 'true';
  const verifiedAction = ['snapshot-create', 'account-reset', 'snapshot-restore'].includes(change.type);
  if (verifiedAction && change.username !== player().username) throw Error('Type the exact explorer username before continuing.');
  if (change.type === 'account-reset' || change.type === 'snapshot-restore') {
    const current = state.snapshots.find(snapshot => snapshot.current);
    if (!current) throw Error('Create a verified backup of the current save first.');
    if (change.type === 'account-reset') change.snapshotId = current.id;
    else change.safetySnapshotId = current.id;
  }
  const ids = ['reward', 'reward-package'].includes(change.type) ? values.getAll('recipients') : [state.selected];
  if (!ids.length) throw Error('Choose at least one explorer.');
  const recipients = state.players.filter(p => ids.includes(p.id));
  const targets = recipients.map(p => ({
    account: p.id,
    revision: verifiedAction ? state.snapshots.find(snapshot => snapshot.current)?.revision ?? p.revision : p.revision,
    profile: state.profile
  }));
  const requestId = crypto.randomUUID();
  let action = 'mutate';
  let body = {requestId, confirmed: true, reason, targets, change};
  let description;
  if (change.type === 'snapshot-create') {
    action = 'snapshot-create';
    body = {account: player().id, revision: state.detail.player.revision, requestId, confirmed: true,
      username: change.username, reason};
    description = 'Verify and save cloud revision ' + body.revision + ' for both Emberia and Luminara.';
  } else if (change.type === 'package-save') {
    const {name, active, ...items} = change;
    const reward = {...items, type: 'reward'};
    if (!name) throw Error('Give the package a name.');
    if (values.has('active') && reward.badge) requireActiveBadge(reward.badge);
    action = 'package-save';
    body = {requestId, confirmed: true, reason, name, active: values.has('active'), change: reward};
    if (form.dataset.id) {
      const saved = state.packages.find(p => p.id === form.dataset.id);
      body.id = saved.id;
      body.version = saved.version;
    }
    description = (body.id ? 'Update ' : 'Create ') + name + ' (' + (body.active ? 'active' : 'inactive') +
      '). Contents: ' + rewardText(reward) + '.';
  } else {
    if (change.type === 'reward-package') {
      const saved = state.packages.find(p => p.id === change.id);
      change.version = saved?.version;
      if (saved?.change.badge) change.badgeVersion = requireActiveBadge(saved.change.badge).version;
    }
    if (change.type === 'reward' && change.badge) change.badgeVersion = requireActiveBadge(change.badge).version;
    if (form.draw && targets.length === 1 && targets[0].account === form.draw.account) body.draw = form.draw.value;
    description = changeText(change, recipients, form);
  }
  const confirmationLabel = {
    'snapshot-create': 'Create verified backup', 'account-reset': 'Reset both identities',
    'snapshot-restore': 'Restore both identities'
  }[change.type] || 'Apply confirmed change';
  state.draft = {form, action, body};
  form.hidden = true;
  form.insertAdjacentHTML('afterend', `<section id="review" class="review" tabindex="-1">
    <h3>Confirm change</h3>
    <p>${esc(description)}</p>
    <p>${change.type === 'package-save' ? 'Reusable reward package' : 'For ' + esc(recipients.map(p => p.username).join(', '))}
      ${change.type === 'account' || verifiedAction ? '' : ' · ' + profiles[state.profile]}</p>
    <p>Reason: ${esc(reason)}</p>
    <div class="actions"><button data-action="confirm" class="${change.type === 'account-reset' ? 'danger' : 'primary'}">${confirmationLabel}</button>
    <button data-action="cancel">Cancel</button></div><p id="review-error" role="alert" hidden></p></section>`);
  $('review').focus();
  message('');
}

function cancel() {
  const form = state.draft?.form;
  $('review')?.remove();
  if (form) {
    form.hidden = false;
    form.querySelector('button[type="submit"], button.primary')?.focus();
  }
  state.draft = null;
  message('');
}

async function refreshPlayers() {
  const data = await request('list');
  state.players = data.players;
  state.catalog = data.catalog;
  if (!player()) state.selected = state.players[0]?.id || null;
  await render();
}

async function confirmChange(button) {
  if (!state.draft || state.pending) return;
  state.pending = true;
  button.disabled = true;
  $('review-error').hidden = true;
  try {
    const result = await request(state.draft.action, state.draft.body);
    const isRotation = state.draft.body.change?.operation === 'rotate-recovery';
    let outcome = state.draft.action === 'snapshot-create' ? 'Verified backup created.' : 'Change saved.';
    if (result.recovery) outcome = await showRecovery(result.recovery);
    else if (isRotation && result.duplicate) {
      outcome = 'The passport was replaced. If you missed the download, create a new passport.';
    }
    state.draft = null;
    message(outcome);
    try {
      await refreshPlayers();
    } catch {
      title('Change saved', '<p>Refresh the dashboard to load the latest account data.</p>');
    }
  } catch (e) {
    $('review-error').textContent = e.message;
    $('review-error').hidden = false;
    message(e.message, true);
  } finally {
    button.disabled = false;
    state.pending = false;
  }
}

async function chooseRecipients(button, random) {
  const inputs = [...button.form.querySelectorAll('input[name="recipients"]')];
  if (!inputs.length) return;
  if (!random) {
    button.form.draw = null;
    inputs.forEach(input => { input.checked = true; });
    return;
  }
  const checked = inputs.filter(input => input.checked);
  const accounts = (checked.length > 1 ? checked : inputs).map(input => input.value);
  button.disabled = true;
  try {
    const result = await request('random-recipient', {profile: state.profile, accounts});
    if (!button.isConnected) return;
    inputs.forEach(input => { input.checked = input.value === result.target.account; });
    button.form.draw = {account: result.target.account, value: result.draw};
    message('Selected ' + result.username + '. Review the gift before applying it.');
  } finally {
    button.disabled = false;
  }
}

function showWorkshop() {
  if (state.pending) return;
  const token = ++state.load;
  state.draft = null;
  $('work').classList.add('workshop');
  homeworkAdmin({
    screen: html => { if (token === state.load) panel(html); },
    on: (id, handler, event = 'click') => $(id)?.addEventListener(event, handler),
    back: () => { $('work').classList.remove('workshop'); render(); },
    getProfile: () => storedProfiles[state.profile]
  }).workshop();
}

$('unlock').addEventListener('submit', async event => {
  event.preventDefault();
  if (state.pending) return;
  const form = event.currentTarget;
  const button = form.querySelector('button');
  state.pending = true;
  button.disabled = true;
  state.key = form.elements.key.value.trim();
  try {
    await refreshPlayers();
    form.reset();
    form.hidden = true;
    $('lock').hidden = false;
    $('dashboard').hidden = false;
    message('Dashboard unlocked.');
  } catch (e) {
    state.key = '';
    message(e.message, true);
  } finally {
    state.pending = false;
    button.disabled = false;
  }
});

$('lock').addEventListener('click', async () => {
  if (state.pending) return;
  const key = state.key;
  ++state.load;
  state.key = '';
  state.players = [];
  state.catalog = {};
  state.audit = [];
  state.packages = [];
  state.rewardBadges = [];
  state.snapshots = [];
  state.selected = null;
  state.reportPack = null;
  $('search').value = '';
  state.detail = null;
  state.draft = null;
  clearRecovery();
  $('dashboard').hidden = true;
  $('work').replaceChildren();
  $('player-list').replaceChildren();
  $('lock').hidden = true;
  $('unlock').hidden = false;
  $('unlock').elements.key.focus();
  try {
    await request('lock', {}, key);
    message('Dashboard locked.');
  } catch {
    message('Dashboard closed. Sign out of the Arcade to end the owner session.', true);
  }
});

$('search').addEventListener('input', showPlayers);
$('dashboard').addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button || state.pending) return;
  const {account, section, action} = button.dataset;
  if (account || section) {
    clearRecovery();
    if (account && account !== state.selected) {
      state.selected = account;
      state.reportPack = null;
    }
    if (section) state.section = section;
    $('work').classList.remove('workshop');
    message('');
    await render();
    return;
  }
  try {
    switch (action) {
      case 'confirm': return await confirmChange(button);
      case 'cancel': return cancel();
      case 'reverse': {
        const entry = state.audit.find(row => row.id === Number(button.dataset.auditId));
        if (!entry) return;
        state.profile = entry.profile;
        title('Reverse crystal adjustment', `<p>Reversing adjustment ${entry.id} for ${esc(profiles[entry.profile])}.</p>
          ${actionForm('wallet', '<input type="hidden" name="operation" value="reverse">' +
            '<input type="hidden" name="auditId" value="' + entry.id + '">')}
          <button data-action="retry">Back to activity</button>`);
        return;
      }
      case 'retry': return await render();
      case 'random': return await chooseRecipients(button, true);
      case 'duplicate-package': return editPackage($('work').querySelector('[name="edit-package"]').value, true);
      case 'all': return chooseRecipients(button, false);
      case 'workshop': return showWorkshop();
      case 'hide-recovery': clearRecovery(); return await render();
      case 'snapshot-download': {
        button.disabled = true;
        try {
          const data = await request('snapshot-download', {account: state.selected, id: button.dataset.snapshotId});
          download(data, 'crystal-quest-verified-revision-' + data.snapshot.revision + '.json');
          message('Verified private backup downloaded.');
        } finally {
          button.disabled = false;
        }
        break;
      }
      case 'backup-one':
      case 'backup-all': {
        button.disabled = true;
        try {
          const data = await request('backup', action === 'backup-one' ? {account: state.selected} : {});
          download(data, 'crystal-quest-private-backup.json');
          message('Private backup downloaded.');
        } finally {
          button.disabled = false;
        }
      }
    }
  } catch (e) {
    message(e.message, true);
  }
});

$('work').addEventListener('change', async event => {
  if (state.pending) return;
  const input = event.target;
  if (input.name === 'recipients') input.form.draw = null;
  if (input.name === 'edit-package') return editPackage(input.value);
  if (['audit-filter', 'audit-date'].includes(input.name)) return renderAudit();
  if (input.name === 'world' && input.form?.dataset.change === 'stage-status') {
    input.form.elements.stage.innerHTML = options(WORLDS[input.value].stages.map((name, index) => [index, name]));
  }
  if (input.name === 'report-pack') {
    state.reportPack = input.value;
    return render();
  }
  if (input.name === 'profile' && profiles[input.value]) {
    state.reportPack = null;
    clearRecovery();
    state.profile = input.value;
    message('');
    await render();
  }
  const form = input.form;
  if (form?.dataset.change === 'account' && input.name === 'operation') {
    const field = form.elements.value;
    const pin = input.value === 'reset-pin';
    const rename = input.value === 'rename';
    field.closest('label').hidden = !(pin || rename);
    field.closest('label').firstChild.textContent = pin ? 'New four-digit PIN' : 'New username';
    field.disabled = !(pin || rename);
    field.type = pin ? 'password' : 'text';
    field.inputMode = pin ? 'numeric' : 'text';
    field.pattern = pin ? '[0-9]{4}' : '[a-zA-Z][a-zA-Z0-9_-]{2,19}';
    field.maxLength = pin ? 4 : 20;
    field.value = '';
  }
  if (form?.dataset.change === 'pet' && input.name === 'operation') {
    const showXP = input.value === 'xp';
    $('xp-field').hidden = !showXP;
    form.elements.xp.disabled = !showXP;
    form.elements.xp.required = showXP;
    updatePetFields(form);
  }
  if (form?.dataset.change === 'item' && input.name === 'category') {
    form.elements.item.innerHTML = options(catalogRows(input.value));
  }
});

$('work').addEventListener('submit', event => {
  if (!event.target.matches('form[data-change]')) return;
  event.preventDefault();
  if (state.pending || state.draft) return;
  const feedback = event.target.querySelector('.form-error');
  feedback.hidden = true;
  try { prepare(event.target); } catch (e) {
    feedback.textContent = e.message;
    feedback.hidden = false;
    message(e.message, true);
  }
});
