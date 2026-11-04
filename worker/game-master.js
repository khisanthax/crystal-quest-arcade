import {ACCESSORIES, FOOD, PETS, collection, petLevel} from '../dist/runner/collection.js';
import {progressReport} from './game-master-reports.js';
import {badgeStampSql,fullAccountChange,snapshotAction} from './game-master-snapshots.js';
import {badgeView,listBadges,playerBadges,saveBadge} from './game-master-badges.js';
import {exportBackup} from '../dist/runner/store.js';
import {assignLevel, archiveLevel} from '../dist/runner/levels.js';
import {STAGES} from '../dist/reading/workflow.js';
import {THEMES} from '../dist/runner/model.js';

const profiles = {emberia:'ari', luminara:'kal'};
const has = (object, key) => Object.hasOwn(object || {}, key);
const catalog = {pets:PETS, food:FOOD, accessories:ACCESSORIES};
const drawText = (actor,target,until,nonce) => JSON.stringify(['draw',actor,target.account,target.profile,target.revision,until,nonce]);
const requestGate = 'EXISTS (SELECT 1 FROM game_master_requests WHERE id=? AND marker=?)';

export async function gameMasterSignature(key, text) {
 const encoder = new TextEncoder();
 const hmac = await crypto.subtle.importKey('raw', encoder.encode(key), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
 const bytes = await crypto.subtle.sign('HMAC', hmac, encoder.encode(text));
 return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2,'0')).join('');
}

function overview(account, data = JSON.parse(account.payload)) {
 const summaries = {};
 for (const [identity, key] of Object.entries(profiles)) {
  const p = data.profiles[key];
  const location = p.lastAdventure;
  summaries[identity] = {
   wallet:p.collection?.wallet ?? p.crystals ?? 0,
   petCount:p.collection?.pets.length ?? 0,
   packId:p.activePack,
   packTitle:data.packs[p.activePack]?.title,
   world:location?.world ?? p.theme,
   stage:location?.stage ?? null,
  };
 }
 return {
  id:account.id, username:account.username, revision:account.revision,
  created:account.created, lastActivity:account.last_activity ?? account.created,
  disabled:!!account.disabled, profiles:summaries,
 };
}

function amount(n, minimum, maximum, fail) {
 if (!Number.isSafeInteger(n) || n < minimum || n > maximum) fail(400, 'Enter a whole number in the allowed range.');
 return n;
}

function editWallet(p, change, fail) {
 const c = collection(p), old = c.wallet;
 const {operation} = change;
 if (!['add','remove','set'].includes(operation)) fail(400,'Choose an adjustment.');
 const n = amount(change.amount, operation === 'set' ? 0 : 1, Number.MAX_SAFE_INTEGER, fail);
 const next = operation === 'set' ? n : old + (operation === 'add' ? n : -n);
 if (!Number.isSafeInteger(next) || next < 0) fail(400,'The resulting crystal balance is outside the allowed range.');
 c.wallet = p.crystals = next;
 return {previous:{wallet:old}, updated:{wallet:next}};
}

async function editPet(p, change, db, target, fail) {
 const c = collection(p);
 const type = PETS.find(pet => pet.id === change.item);
 if (!type) fail(400,'Choose a pet from the catalog.');
 const existing = c.pets.find(pet => pet.id === type.id);
 const previous = {pet:existing ? structuredClone(existing) : null, equipped:c.equipped};
 let updatedId = type.id;
 const {operation} = change;
 if (operation === 'grant' || operation === 'restore') {
  if (existing) fail(409,'This player already owns that pet.');
  let pet = {id:type.id,species:type.id,name:type.name,xp:0,accessories:{}};
  if (operation === 'restore') {
   const row = await db.prepare("SELECT previous FROM game_master_audit WHERE account_id=? AND profile=? AND action='pet:revoke' AND json_extract(previous,'$.pet.id')=? ORDER BY id DESC LIMIT 1")
    .bind(target.account,target.profile,type.id).first();
   if (!row) fail(404,'No prior revocation was found for this pet.');
   pet = JSON.parse(row.previous).pet;
   for (const [slot,id] of Object.entries(pet.accessories)) if (!c.accessories.includes(id)) delete pet.accessories[slot];
  }
  c.pets.push(pet);
  c.equipped ??= pet.id;
 } else {
  if (!existing) fail(404,'This player does not own that pet.');
  if (operation === 'revoke') {
   c.pets = c.pets.filter(pet => pet !== existing);
   if (c.equipped === existing.id) c.equipped = null;
  } else if (operation === 'replace') {
   const replacement = PETS.find(pet => pet.id === change.replacement);
   if (!replacement || replacement.id === existing.id) fail(400,'Choose a different pet from the catalog.');
   if (c.pets.some(pet => pet.id === replacement.id)) fail(409,'This player already owns the replacement pet.');
   const accessories = Object.fromEntries(Object.entries(existing.accessories).filter(([slot,id]) =>
    c.accessories.includes(id) && ACCESSORIES.some(item => item.id === id && item.slot === slot && item.level <= petLevel(existing.xp))));
   const name = existing.name === type.name ? replacement.name : existing.name;
   const pet = {id:replacement.id,species:replacement.id,name,xp:existing.xp,accessories};
   c.pets[c.pets.indexOf(existing)] = pet;
   if (c.equipped === existing.id) c.equipped = pet.id;
   updatedId = pet.id;
  } else if (operation === 'xp') {
   existing.xp = amount(change.xp,0,6000,fail);
   for (const [slot,id] of Object.entries(existing.accessories)) {
    if (ACCESSORIES.some(a => a.id === id && a.level > petLevel(existing.xp))) delete existing.accessories[slot];
   }
  } else fail(400,'Choose a pet action.');
 }
 return {previous,updated:{pet:c.pets.find(pet => pet.id === updatedId) ?? null,equipped:c.equipped}};
}

function editItem(p, change, fail) {
 const c = collection(p), {category,item,operation} = change;
 if (!['food','accessories'].includes(category) || !catalog[category].some(x => x.id === item)) fail(400,'Choose an item from the catalog.');
 if (!['grant','remove','set'].includes(operation)) fail(400,'Choose an item action.');
 const old = category === 'food' ? c.food[item] || 0 : Number(c.accessories.includes(item));
 const n = amount(change.quantity ?? 1, operation === 'set' ? 0 : 1, category === 'food' ? 10000 : 1, fail);
 const next = operation === 'set' ? n : old + (operation === 'grant' ? n : -n);
 if (next < 0 || next > (category === 'food' ? 10000 : 1)) fail(409,'This player cannot hold that item quantity.');
 if (category === 'food') {
  if (next) c.food[item] = next;
  else delete c.food[item];
 } else if (next !== old) {
  if (next) c.accessories.push(item);
  else {
   c.accessories = c.accessories.filter(id => id !== item);
   for (const pet of c.pets) for (const [slot,id] of Object.entries(pet.accessories)) if (id === item) delete pet.accessories[slot];
  }
 }
 return {previous:{item,quantity:old},updated:{item,quantity:next}};
}

const runnerCourseFields = ['stageCourses','courses','runs'];

function savedCourse(p,{courseKey,courseField},fail) {
 const fields = [...runnerCourseFields,'originalCourses'];
 const matches = fields.filter(field => (!courseField || courseField === field) && has(p[field],courseKey));
 if (matches.length !== 1) fail(404,'Choose one saved course.');
 const field = matches[0], saved = p[field][courseKey];
 const ledger = field === 'originalCourses' ? saved.ledger : saved;
 return {field,saved,ledger};
}

function sameRunnerStage(left,right) {
 if (left.stage !== right.stage || left.packId !== right.packId || left.theme !== right.theme) return false;
 if (left.sessionId && right.sessionId) return left.sessionId === right.sessionId;
 return Number.isFinite(left.seed) && left.seed === right.seed;
}

function resetCourseScore(p,change,fail) {
 if (change.courseKey !== undefined) {
  const {field,saved,ledger} = savedCourse(p,change,fail);
  const context = {courseField:field,courseKey:change.courseKey,packId:ledger.packId,world:ledger.theme,stage:ledger.stage};
  const previous = {...context,score:ledger.score};
  const activeAdventure = field === 'originalCourses' && saved.progress.run?.level === ledger.stage ? saved.progress.run : null;
  if (activeAdventure) {
   previous.playScore = activeAdventure.score;
   activeAdventure.score = 0;
  }
  ledger.score = 0;
  if (field !== 'originalCourses') {
   for (const source of runnerCourseFields) for (const run of Object.values(p[source] || {})) {
    if (sameRunnerStage(run,ledger)) run.score = 0;
   }
  }
  return {previous,updated:{...context,score:0,...(activeAdventure ? {playScore:0} : {})}};
 }
 const {packId,world} = change;
 if (!has(p.levelProgress,packId) || !has(p.levelProgress[packId]?.worlds,world)) fail(404,'Choose a study pack and world with a recorded high score.');
 const record = p.levelProgress[packId].worlds[world], previous = {packId,world,bestScore:record.bestScore};
 record.bestScore = 0;
 return {previous,updated:{packId,world,bestScore:0}};
}

async function editProfile({db,data,target,change,fail}) {
 const p = data.profiles[profiles[target.profile]];
 switch (change.type) {
 case 'wallet': {
  if (change.operation !== 'reverse') return editWallet(p,change,fail);
  const auditId = amount(change.auditId,1,Number.MAX_SAFE_INTEGER,fail);
  const row = await db.prepare("SELECT previous,updated FROM game_master_audit WHERE id=? AND account_id=? AND profile=? AND action IN ('wallet:add','wallet:remove','wallet:set')")
   .bind(auditId,target.account,target.profile).first();
  if (!row) fail(404,'Choose an earlier crystal adjustment for this player.');
  if (await db.prepare("SELECT 1 FROM game_master_audit WHERE action='wallet:reverse' AND json_extract(updated,'$.reversalOf')=?").bind(auditId).first()) fail(409,'This adjustment was already reversed.');
  const delta = JSON.parse(row.updated).wallet - JSON.parse(row.previous).wallet;
  if (!delta) fail(409,'There is no adjustment to reverse.');
  const r = editWallet(p,{operation:delta > 0 ? 'remove' : 'add',amount:Math.abs(delta)},fail);
  r.updated.reversalOf = auditId;
  return r;
 }
 case 'pet': return editPet(p,change,db,target,fail);
 case 'item': return editItem(p,change,fail);
 case 'reward': {
  const previous = {}, updated = {};
  const edits = [];
  if (change.crystals !== undefined && change.crystals !== 0) edits.push(editWallet(p,{operation:'add',amount:change.crystals},fail));
  if (change.pet) edits.push(await editPet(p,{operation:'grant',item:change.pet},db,target,fail));
  if (change.food) {
   const r = editItem(p,{operation:'grant',category:'food',item:change.food,quantity:change.foodQuantity},fail);
   previous.food = r.previous; updated.food = r.updated;
  }
  if (change.accessory) {
   const r = editItem(p,{operation:'grant',category:'accessories',item:change.accessory},fail);
   previous.accessory = r.previous; updated.accessory = r.updated;
  }
  if (!edits.length && !Object.keys(updated).length) fail(400,'Choose one or more rewards.');
  for (const edit of edits) { Object.assign(previous,edit.previous); Object.assign(updated,edit.updated); }
  return {previous,updated};
 }
 case 'high-score-reset': return resetCourseScore(p,change,fail);
 case 'run-reset': {
  const {courseKey} = change;
  const {field,ledger} = savedCourse(p,change,fail);
  const previous = {courseKey,collection:field,stage:ledger.stage,world:ledger.theme};
  // A runner snapshot may also be reachable from older continue buttons.
  for (const field of ['stageCourses','courses','runs']) {
   for (const [key,value] of Object.entries(p[field] || {})) {
    if (ledger.sessionId && value.sessionId === ledger.sessionId && value.stage === ledger.stage) delete p[field][key];
   }
  }
  delete p[field][courseKey];
  return {previous,updated:{courseKey,reset:true}};
 }
 case 'stage-status': {
  const {mode,world,stage,completed} = change;
  if (!['runner','original'].includes(mode) || !has(THEMES,world) || ![0,1,2].includes(stage) || typeof completed !== 'boolean') fail(400,'Choose a valid stage.');
  p.journeys ??= {runner:{},original:{}};
  p.journeys[mode] ??= {};
  const status = p.journeys[mode][world] ??= {completed:[]};
  const previous = {mode,world,completed:[...status.completed]};
  status.completed = status.completed.filter(n => n !== stage);
  if (completed) status.completed.push(stage);
  else if (mode === 'runner') {
   for (const field of ['stageCourses','courses','runs']) for (const run of Object.values(p[field] || {})) {
    if (run.theme === world && Array.isArray(run.claimedStages)) run.claimedStages = run.claimedStages.filter(n => n !== stage);
   }
  }
  status.completed.sort();
  p.journeyMigrated = true;
  return {previous,updated:{mode,world,completed:status.completed}};
 }
 case 'mission-reset': {
  const {packId,questionId} = change;
  if (!has(data.homeworkPacks,packId) || !has(p.homework?.cases,packId)) fail(404,'Choose a saved case.');
  const pack = data.homeworkPacks[packId], attempts = p.homework.cases[packId];
  const state = attempts.at(-1);
  const index = pack.questions.findIndex(q => q.id === questionId);
  if (!state || index < 0 || change.attempt !== undefined && change.attempt !== state.attempt) fail(404,'Choose a mission from the latest case attempt.');
  const previous = {packId,questionId,attempt:state.attempt,written:!!state.written?.[questionId],verified:!!state.evidence?.[questionId],completed:!!state.completed};
  for (const map of ['missions','written','evidence','activities','keywords','reflections','hints']) if (state[map]) delete state[map][questionId];
  state.checks = (state.checks || []).filter(check => check.questionId !== questionId && check.question !== questionId);
  state.completed = null;
  state.workflowStage = STAGES.KEYWORDS;
  state.mission = index;
  state.selection = null;
  state.transition = null;
  p.homework.active = packId;
  // Reward IDs and learning from every other mission are intentionally retained.
  return {previous,updated:{packId,questionId,attempt:state.attempt,reset:true}};
 }
 case 'study-pack': {
  const {packId, operation} = change;
  if (!has(data.packs,packId)) fail(404,'Choose an existing study pack.');
  const previous = {activePack:p.activePack};
  if (operation === 'assign') assignLevel(data,profiles[target.profile],packId);
  else if (operation === 'archive') {
   if (!archiveLevel(p,packId,data.packs)) fail(409,'Select a different current test before archiving this one.');
  } else fail(400,'Choose a study pack action.');
  return {previous,updated:{activePack:p.activePack,packId,operation}};
 }
 default: return fail(400,'Choose a supported action.');
 }
}

const queryAccounts = "SELECT id,username,created,last_activity,disabled,revision,payload FROM explorers";
const safePin = pin => /^\d{4}$/.test(pin) && !/^(\d)\1{3}$/.test(pin) &&
 !['1234','4321','0123','9876','2580'].includes(pin) && !(Number(pin) >= 1900 && Number(pin) <= 2100);


function rewardContents(change,fail) {
 if (!change || typeof change !== 'object') fail(400,'Choose package rewards.');
 const reward = {type:'reward'};
 if (change.crystals !== undefined) reward.crystals = amount(change.crystals,0,1000000,fail);
 for (const [field, items] of [['pet',PETS],['food',FOOD],['accessory',ACCESSORIES]]) {
  if (!change[field]) continue;
  if (!items.some(i=>i.id===change[field])) fail(400,'Choose valid catalog items for the package.');
  reward[field] = change[field];
 }
 if (reward.food) reward.foodQuantity = amount(change.foodQuantity ?? 1,1,10000,fail);
 if (!reward.crystals && !reward.pet && !reward.food && !reward.accessory) fail(400,'Choose at least one package reward.');
 return reward;
}

function packageView(row) {
 return {id:row.id,name:row.name,active:!!row.active,change:JSON.parse(row.payload),version:row.version,updated:row.updated};
}

async function savePackage(body,{db,a,env,fail,response,randomToken}) {
 const {requestId} = body;
 const name = typeof body.name === 'string' ? body.name.trim() : '';
 if (body.confirmed !== true || !/^[a-z0-9-]{16,80}$/i.test(requestId ?? '') || !name || name.length > 80 || typeof body.active !== 'boolean') {
  fail(400,'Confirm the package name and status.');
 }
 const fingerprint = await gameMasterSignature(env.CQ_GAME_MASTER_KEY,JSON.stringify(body));
 const existing = () => db.prepare('SELECT actor,fingerprint,result FROM game_master_requests WHERE id=?').bind(requestId).first();
 const replay = prior => {
  if (prior.actor !== a.id || prior.fingerprint !== fingerprint) fail(409,'This request ID was already used for another change.');
  return response({...JSON.parse(prior.result),duplicate:true});
 };
 const prior = await existing();
 if (prior) return replay(prior);

 const editing = body.id !== undefined;
 const id = editing ? body.id : requestId;
 if (typeof id !== 'string' || !/^[a-z0-9-]{16,80}$/i.test(id)) fail(400,'Choose an existing package.');
 const old = editing ? await db.prepare('SELECT * FROM game_master_packages WHERE id=?').bind(id).first() : null;
 if (editing && (!old || body.version !== old.version)) fail(409,'Reload the package before editing it.');
 const change = rewardContents(body.change,fail);
 const marker = randomToken(), now = Date.now();
 const next = {id,name,active:body.active,change,version:(old?.version ?? 0)+1,updated:now};
 const result = {package:next};
 const gate = editing ? 'EXISTS (SELECT 1 FROM game_master_packages WHERE id=? AND version=?)' : 'NOT EXISTS (SELECT 1 FROM game_master_packages WHERE id=?)';
 const args = editing ? [id,old.version] : [id];
 const applied = await db.batch([
  db.prepare('INSERT OR IGNORE INTO game_master_requests (id,actor,fingerprint,marker,result,created) SELECT ?,?,?,?,?,? WHERE '+gate)
   .bind(requestId,a.id,fingerprint,marker,JSON.stringify(result),now,...args),
  db.prepare('INSERT INTO game_master_packages(id,name,active,payload,version,updated) SELECT ?,?,?,?,?,? WHERE '+requestGate+' ON CONFLICT(id) DO UPDATE SET name=excluded.name,active=excluded.active,payload=excluded.payload,version=excluded.version,updated=excluded.updated')
   .bind(id,name,Number(body.active),JSON.stringify(change),next.version,now,requestId,marker),
  db.prepare("INSERT INTO game_master_audit (request_id,actor,account_id,profile,action,reason,previous,updated,created) SELECT ?,?,?,NULL,'package:save',?,?,?,? WHERE "+requestGate)
   .bind(requestId,a.id,a.id,'Reward package configuration',JSON.stringify(old ? packageView(old) : null),JSON.stringify(next),now,requestId,marker),
 ]);
 if (!applied[0].meta.changes) {
  const duplicate = await existing();
  if (duplicate) return replay(duplicate);
  fail(409,'The package changed. Reload it and try again.');
 }
 return response(result);
}

export async function gameMasterAction(body, {db,a,env,fail,response,checkedData,randomToken,digest,pinHash,recoveryExpiry}) {
 if (!body || typeof body !== 'object') fail(400,'Choose a Game Master action.');
 const accounts = () => db.prepare(queryAccounts+' ORDER BY username').all().then(x => x.results);
 const findAccount = id => db.prepare(queryAccounts+' WHERE id=?').bind(String(id ?? '')).first();
 const requireAccount = async id => {
  const account = await findAccount(id);
  if (!account) fail(404,'Explorer not found.');
  return account;
 };
 if (['snapshots','snapshot-create','snapshot-download'].includes(body.action)) {
  return snapshotAction(body,{db,a,env,fail,response,randomToken,digest,signature:gameMasterSignature,checkedData,requestGate});
 }
 if (body.action === 'badges') return response(await listBadges(db));
 if (body.action === 'badge-save') return saveBadge(body,{db,a,env,fail,response,randomToken,signature:gameMasterSignature,requestGate});
 if (body.action === 'packages') {
  const rows = (await db.prepare('SELECT * FROM game_master_packages ORDER BY name').all()).results;
  return response({packages:rows.map(packageView)});
 }
 if (body.action === 'package-save') return savePackage(body,{db,a,env,fail,response,randomToken});
 if (body.action === 'random-recipient') {
  if (!has(profiles,body.profile) || body.accounts !== undefined && (!Array.isArray(body.accounts) || body.accounts.length > 4)) fail(400,'Choose eligible explorers.');
  const pool = (await accounts()).filter(p => !p.disabled && (!body.accounts || body.accounts.includes(p.id)));
  if (!pool.length) fail(404,'No eligible active explorer was found.');
  const roll = crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000;
  const player = pool[Math.floor(roll*pool.length)];
  const target = {account:player.id,profile:body.profile,revision:player.revision};
  const until = Date.now()+5*60000, nonce = randomToken();
  const signature = await gameMasterSignature(env.CQ_GAME_MASTER_KEY,drawText(a.id,target,until,nonce));
  return response({target,username:player.username,draw:{until,nonce,signature}});
 }
 if (body.action === 'list') return response({players:(await accounts()).map(x => overview(x)),catalog});
 if (body.action === 'progress-report') return response(await progressReport(db,await requireAccount(body.account),body,fail));
 if (body.action === 'detail') {
  const account = await requireAccount(body.account);
  const backups = (await db.prepare('SELECT revision,created FROM save_history WHERE account_id=? ORDER BY revision DESC LIMIT 30').bind(account.id).all()).results;
  return response({player:overview(account),data:JSON.parse(account.payload),backups});
 }
 if (body.action === 'backup') {
  const players = body.account ? [await requireAccount(body.account)] : await accounts();
  const copies = await Promise.all(players.map(async ({id,username,revision,payload}) => ({
   id,username,revision,data:exportBackup(JSON.parse(payload)).data,
   badges:{emberia:await playerBadges(db,id,'emberia'),luminara:await playerBadges(db,id,'luminara')},
  })));
  return response({format:'crystal-quest-game-master-backup-v1',players:copies});
 }
 if (body.action === 'audit') {
  const rows = (await db.prepare('SELECT id,request_id AS requestId,actor,account_id AS account,profile,action,reason,previous,updated,created FROM game_master_audit WHERE (? IS NULL OR account_id=?) ORDER BY id DESC LIMIT 200')
   .bind(body.account ?? null, body.account ?? null).all()).results;
  return response({entries:rows.map(row => ({...row,previous:JSON.parse(row.previous),updated:JSON.parse(row.updated)}))});
 }
 if (body.action !== 'mutate') fail(400,'Choose a Game Master action.');

 const {requestId,targets} = body;
 let change = body.change;
 const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
 if (!/^[a-z0-9-]{16,80}$/i.test(requestId ?? '') || body.confirmed !== true || !reason || reason.length > 200 ||
  !Array.isArray(targets) || !targets.length || targets.length > 8 || typeof change?.type !== 'string') {
  fail(400,'Confirm the change and provide a short reason.');
 }
 const fingerprint = await gameMasterSignature(env.CQ_GAME_MASTER_KEY,JSON.stringify(body));
 const existingRequest = () => db.prepare('SELECT actor,fingerprint,result FROM game_master_requests WHERE id=?').bind(requestId).first();
 function replay(prior) {
  if (prior.actor !== a.id || prior.fingerprint !== fingerprint) fail(409,'This request ID was already used for another change.');
  return response({...JSON.parse(prior.result),duplicate:true});
 }
 const prior = await existingRequest();
 if (prior) return replay(prior);

 let selectedBadge;
 if (change.type === 'badge') {
  if (typeof change.id !== 'string') fail(400,'Choose an active collectible badge.');
  const row = await db.prepare('SELECT * FROM game_master_badges WHERE id=? AND active=1').bind(change.id).first();
  if (!row || row.version !== change.version) fail(409,'This badge changed. Reload and preview it again.');
  selectedBadge = badgeView(row);
 }
 let chosenPackage;
 if (change.type === 'reward-package') {
  if (typeof change.id !== 'string') fail(400,'Choose an active reward package.');
  const row = await db.prepare('SELECT * FROM game_master_packages WHERE id=? AND active=1').bind(change.id).first();
  if (!row || row.version !== change.version) fail(409,'This reward package changed. Reload and preview it again.');
  chosenPackage = packageView(row);
  change = chosenPackage.change;
 }
 const draw = body.draw;
 if (draw !== undefined) {
  const target = targets[0];
  if (targets.length !== 1 || change.type !== 'reward' || !target || !Number.isSafeInteger(draw?.until) ||
   draw.until <= Date.now() || !/^[a-f0-9]{64}$/.test(draw.nonce ?? '') || !/^[a-f0-9]{64}$/.test(draw.signature ?? '') ||
   draw.signature !== await gameMasterSignature(env.CQ_GAME_MASTER_KEY,drawText(a.id,target,draw.until,draw.nonce))) {
   fail(400,'This random recipient preview expired or changed. Draw again.');
  }
 }
 const records = new Map(), seen = new Set(), audits = [];
 let recovery;
 const fullChange = ['account-reset','snapshot-restore'].includes(change.type);
 const accountAction = change.type === 'account' || fullChange;
 const singleTarget = accountAction || change.type === 'restore';
 if (change.type === 'wallet' && change.operation === 'reverse' && targets.length !== 1) fail(400,'Choose one adjustment to reverse.');
 if (singleTarget && targets.length !== 1) fail(400,'Choose one explorer for this action.');
 for (const target of targets) {
  if (typeof target?.account !== 'string' || !has(profiles,target.profile) || !Number.isSafeInteger(target.revision)) fail(400,'Choose a valid explorer and profile.');
  const id = target.account + ':' + target.profile;
  if (seen.has(id)) fail(400,'A recipient was selected twice.');
  seen.add(id);
  let record = records.get(target.account);
  if (!record) {
   const account = await requireAccount(target.account);
   record = {account,data:JSON.parse(account.payload),columns:{},revoke:false};
   records.set(account.id,record);
  }
  const {account,columns,data} = record;
  if (account.revision !== target.revision) {
   const existing = await existingRequest();
   if (existing) return replay(existing);
   fail(409,'This explorer has a newer save. Reload the player and preview the change again.');
  }
  let edit;
  if (fullChange) {
   const result = await fullAccountChange({db,account,change,fail,digest,checkedData});
   record.data = result.data;
   record.badges = result.badges;
   record.badgeStamp = result.badgeStamp;
   edit = {previous:result.previous,updated:result.updated};
  } else if (change.type === 'restore') {
   const backup = await db.prepare('SELECT payload FROM save_history WHERE account_id=? AND revision=?').bind(account.id,amount(change.revision,0,account.revision,fail)).first();
   if (!backup) fail(404,'That backup revision is unavailable.');
   const saved = checkedData(JSON.parse(backup.payload));
   const key = profiles[target.profile], player = data.profiles[key], old = saved.profiles[key];
   // Restore the selected player's progress while keeping current ownership and
   // paid reward ledgers. Reopening an older checkpoint cannot earn it twice.
   for (const field of ['runs','courses','stageCourses','originalCourses','journeys','lastAdventure','learning','highScore']) {
    if (has(old,field)) player[field] = old[field];
    else delete player[field];
   }
   data.packs = {...saved.packs,...data.packs};
   edit = {previous:{revision:account.revision},updated:{restoredRevision:change.revision}};
  } else if (change.type === 'account') {
   const {operation,value} = change;
   if (operation === 'rename') {
    const username = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!/^[a-z][a-z0-9_-]{2,19}$/.test(username)) fail(400,'Use 3–20 letters or numbers, starting with a letter.');
    if (await db.prepare('SELECT id FROM explorers WHERE username=? AND id<>?').bind(username,account.id).first()) fail(409,'That username is already in use.');
    columns.username = username;
    edit = {previous:{username:account.username},updated:{username}};
   } else if (operation === 'disable' || operation === 'enable') {
    if (account.id === a.id && operation === 'disable') fail(400,'The designated administrator cannot disable their own account.');
    columns.disabled = Number(operation === 'disable');
    record.revoke = !!columns.disabled;
    edit = {previous:{disabled:!!account.disabled},updated:{disabled:!!columns.disabled}};
   } else if (operation === 'revoke-sessions') {
    record.revoke = true;
    edit = {previous:{},updated:{sessionsRevoked:true}};
   } else if (operation === 'reset-pin') {
    if (typeof value !== 'string' || !safePin(value)) fail(400,'Choose a four-digit PIN without a sequence, repeated digit or birth year.');
    columns.pin_salt = randomToken();
    columns.pin_hash = await pinHash(value,columns.pin_salt);
    record.revoke = true;
    edit = {previous:{},updated:{pinReset:true}};
   } else if (operation === 'rotate-recovery') {
    recovery = randomToken();
    columns.recovery_hash = await digest(recovery);
    columns.recovery_expires = recoveryExpiry();
    edit = {previous:{},updated:{recoveryRotated:true}};
   } else fail(400,'Choose an account action.');
  } else if (selectedBadge) {
   const alreadyOwned = await db.prepare('SELECT 1 FROM player_badges WHERE account_id=? AND profile=? AND badge_id=?')
    .bind(account.id,target.profile,selectedBadge.id).first();
   if (alreadyOwned) {
    const existing = await existingRequest();
    if (existing) return replay(existing);
    fail(409,'A selected profile already owns this badge.');
   }
   edit = {previous:{owned:false},updated:{owned:true,badge:selectedBadge}};
  } else edit = await editProfile({db,data,target,change,fail});
  if (draw) edit.updated.randomDraw = draw.nonce;
  if (chosenPackage) edit.updated.package = {id:chosenPackage.id,name:chosenPackage.name,version:chosenPackage.version};
  audits.push({target,edit,action:draw ? 'reward:random' : chosenPackage ? 'reward-package' : change.operation ? change.type+':'+change.operation : change.type});
 }
 if (!selectedBadge) for (const r of records.values()) checkedData(r.data);

 // D1 batches are transactional. The marker makes every write conditional on
 // this exact batch successfully reserving the request against all revisions.
 const marker = randomToken(), now = Date.now();
 const revisions = [...records.values()].map(({account}) => ({account:account.id,revision:account.revision+(selectedBadge ? 0 : 1)}));
 const result = {applied:true,revisions};
 const guards = [...records.values()].map(() => 'EXISTS (SELECT 1 FROM explorers WHERE id=? AND revision=?)');
 const snapshots = [...records.values()].flatMap(({account}) => [account.id,account.revision]);
 if (fullChange) for (const {account,badgeStamp} of records.values()) {
  guards.push(badgeStampSql+'=?');
  snapshots.push(account.id,badgeStamp);
 }
 if (draw) {
  guards.push("NOT EXISTS (SELECT 1 FROM game_master_audit WHERE json_extract(updated,'$.randomDraw')=?)");
  snapshots.push(draw.nonce);
 }
 if (selectedBadge) {
  guards.push('EXISTS (SELECT 1 FROM game_master_badges WHERE id=? AND version=? AND active=1)');
  snapshots.push(selectedBadge.id,selectedBadge.version);
  for (const {target} of audits) {
   guards.push('NOT EXISTS (SELECT 1 FROM player_badges WHERE account_id=? AND profile=? AND badge_id=?)');
   snapshots.push(target.account,target.profile,selectedBadge.id);
  }
 }
 if (chosenPackage) {
  guards.push('EXISTS (SELECT 1 FROM game_master_packages WHERE id=? AND version=? AND active=1)');
  snapshots.push(chosenPackage.id,chosenPackage.version);
 }
 const batch = [db.prepare('INSERT OR IGNORE INTO game_master_requests (id,actor,fingerprint,marker,result,created) SELECT ?,?,?,?,?,? WHERE '+guards.join(' AND '))
  .bind(requestId,a.id,fingerprint,marker,JSON.stringify(result),now,...snapshots)];
 if (selectedBadge) for (const {target} of audits) {
  batch.push(db.prepare('INSERT INTO player_badges (account_id,profile,badge_id,awarded) SELECT ?,?,?,? WHERE '+requestGate)
   .bind(target.account,target.profile,selectedBadge.id,now,requestId,marker));
 }
 if (!selectedBadge) for (const {account,data,columns,revoke} of records.values()) {
  batch.push(db.prepare('INSERT OR IGNORE INTO save_history (account_id,revision,payload,created) SELECT id,revision,payload,? FROM explorers WHERE id=? AND '+requestGate)
   .bind(now,account.id,requestId,marker));
  const extra = Object.keys(columns).map(name => ','+name+'=?').join('');
  batch.push(db.prepare('UPDATE explorers SET payload=?,revision=revision+1'+extra+' WHERE id=? AND '+requestGate)
   .bind(JSON.stringify(data),...Object.values(columns),account.id,requestId,marker));
  if (revoke) batch.push(db.prepare('DELETE FROM sessions WHERE account_id=? AND '+requestGate).bind(account.id,requestId,marker));
 }
 if (fullChange) for (const {account,badges} of records.values()) {
  batch.push(db.prepare('DELETE FROM player_badges WHERE account_id=? AND '+requestGate).bind(account.id,requestId,marker));
  if (badges.length) batch.push(db.prepare("INSERT INTO player_badges (account_id,profile,badge_id,awarded) SELECT ?,json_extract(value,'$[0]'),json_extract(value,'$[1]'),json_extract(value,'$[2]') FROM json_each(?) WHERE "+requestGate)
   .bind(account.id,JSON.stringify(badges),requestId,marker));
 }
 for (const {target,edit,action} of audits) {
  batch.push(db.prepare('INSERT INTO game_master_audit (request_id,actor,account_id,profile,action,reason,previous,updated,created) SELECT ?,?,?,?,?,?,?,?,? WHERE '+requestGate)
   .bind(requestId,a.id,target.account,accountAction ? null : target.profile,action,reason,JSON.stringify(edit.previous),JSON.stringify(edit.updated),now,requestId,marker));
 }
 const applied = await db.batch(batch);
 if (!applied[0].meta.changes) {
  const existing = await existingRequest();
  if (existing) return replay(existing);
  fail(409,'A newer save arrived before this change. Reload the player and try again.');
 }
 return response(recovery ? {...result,recovery} : result);
}
