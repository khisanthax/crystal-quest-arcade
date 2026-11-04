import {exportBackup,freshData,importBackup} from '../dist/runner/store.js';

const snapshotFormat = 'crystal-quest-verified-snapshot-v1';
export const badgeStampSql = '(SELECT json_group_array(json_array(profile,badge_id,awarded)) FROM (SELECT profile,badge_id,awarded FROM player_badges WHERE account_id=? ORDER BY profile,badge_id))';

async function snapshotContext(db,id,fail) {
 const row = await db.prepare('SELECT id,username,revision,payload,'+badgeStampSql+' AS badge_stamp FROM explorers WHERE id=?')
  .bind(String(id ?? ''),String(id ?? '')).first();
 if (!row) fail(404,'Explorer not found.');
 return row;
}

function snapshotContent(account) {
 return {
  account:account.id,
  revision:account.revision,
  data:exportBackup(JSON.parse(account.payload)).data,
  badges:JSON.parse(account.badge_stamp),
 };
}

function snapshotView(row,currentDigest) {
 return {id:row.id,revision:row.revision,digest:row.digest,created:row.created,current:row.digest===currentDigest};
}

async function verifiedSnapshot(db,account,id,fail,digest,checkedData) {
 if (typeof id !== 'string' || !/^[a-z0-9-]{16,80}$/i.test(id)) fail(400,'Choose a verified snapshot for this explorer.');
 const row = await db.prepare('SELECT * FROM game_master_snapshots WHERE id=? AND account_id=?').bind(id,account.id).first();
 if (!row) fail(404,'That snapshot does not belong to this explorer.');
 if (row.digest !== await digest(row.payload)) fail(409,'This snapshot failed verification.');
 let content,data;
 try {
  content = JSON.parse(row.payload);
  data = importBackup({format:'crystal-quest-backup-v2',data:content.data});
 } catch {
  fail(409,'This snapshot is not a valid Arcade save.');
 }
 if (content.account !== account.id || content.revision !== row.revision ||
     !Array.isArray(content.badges) || content.badges.some(entry => !Array.isArray(entry) || entry.length !== 3 ||
      !['emberia','luminara'].includes(entry[0]) || typeof entry[1] !== 'string' || !Number.isSafeInteger(entry[2]))) {
  fail(409,'This snapshot is not a valid Arcade save.');
 }
 return {row,content,data:checkedData(data)};
}

export async function snapshotAction(body,{db,a,env,fail,response,randomToken,digest,signature,checkedData,requestGate}) {
 const account = await snapshotContext(db,body.account,fail);
 const {action} = body;
 const payload = JSON.stringify(snapshotContent(account));
 const hash = await digest(payload);
 if (action === 'snapshots') {
  const rows = await db.prepare('SELECT id,revision,digest,created FROM game_master_snapshots WHERE account_id=? ORDER BY created DESC,id DESC LIMIT 30').bind(account.id).all();
  return response({snapshots:rows.results.map(row => snapshotView(row,hash))});
 }
 if (action === 'snapshot-download') {
  const {row,content} = await verifiedSnapshot(db,account,body.id,fail,digest,checkedData);
  return response({format:snapshotFormat,snapshot:snapshotView(row,hash),username:account.username,...content});
 }

 const {requestId} = body;
 const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
 if (typeof requestId !== 'string' || !/^[a-z0-9-]{16,80}$/i.test(requestId) || body.confirmed !== true ||
     body.username !== account.username || !reason || reason.length > 200) {
  fail(400,'Type the exact explorer username, enter a reason and confirm the backup.');
 }
 const fingerprint = await signature(env.CQ_GAME_MASTER_KEY,JSON.stringify(body));
 const existing = () => db.prepare('SELECT actor,fingerprint,result FROM game_master_requests WHERE id=?').bind(requestId).first();
 const replay = prior => {
  if (prior.actor !== a.id || prior.fingerprint !== fingerprint) fail(409,'This request ID was already used for another change.');
  const result = JSON.parse(prior.result);
  result.snapshot.current = result.snapshot.digest === hash;
  return response({...result,duplicate:true});
 };
 const prior = await existing();
 if (prior) return replay(prior);
 if (body.revision !== account.revision) fail(409,'The explorer has a newer save. Reload before making the backup.');
 checkedData(JSON.parse(account.payload));
 const marker = randomToken(), now = Date.now();
 const result = {snapshot:snapshotView({id:requestId,revision:account.revision,digest:hash,created:now},hash)};
 const applied = await db.batch([
  db.prepare('INSERT OR IGNORE INTO game_master_requests (id,actor,fingerprint,marker,result,created) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM explorers WHERE id=? AND revision=? AND username=?) AND '+badgeStampSql+'=?')
   .bind(requestId,a.id,fingerprint,marker,JSON.stringify(result),now,account.id,account.revision,account.username,account.id,account.badge_stamp),
  db.prepare('INSERT INTO game_master_snapshots (id,account_id,actor,revision,digest,payload,created) SELECT ?,?,?,?,?,?,? WHERE '+requestGate)
   .bind(requestId,account.id,a.id,account.revision,hash,payload,now,requestId,marker),
  db.prepare("INSERT INTO game_master_audit (request_id,actor,account_id,profile,action,reason,previous,updated,created) SELECT ?,?,?,NULL,'snapshot:create',?,?,?,? WHERE "+requestGate)
   .bind(requestId,a.id,account.id,reason,'{}',JSON.stringify(result.snapshot),now,requestId,marker),
 ]);
 if (!applied[0].meta.changes) {
  const concurrent = await existing();
  if (concurrent) return replay(concurrent);
  fail(409,'The explorer changed before the backup finished. Reload and try again.');
 }
 await verifiedSnapshot(db,account,requestId,fail,digest,checkedData);
 return response(result);
}

function keepPaidRewards(data,current) {
 for (const id of ['ari','kal']) {
  const saved = data.profiles[id], latest = current.profiles[id];
  if (latest.economyEvents) saved.economyEvents = latest.economyEvents;
  if (latest.rewardBook) saved.rewardBook = latest.rewardBook;
  if (latest.homework) {
   const h = saved.homework ??= {assigned:[...(latest.homework.assigned || [])],active:latest.homework.active || null,cases:{}};
   if (latest.homework.namespace) h.namespace = latest.homework.namespace;
   for (const key of ['rewardIds','rewardDays','rewardDust']) {
    if (Object.hasOwn(latest.homework,key)) h[key] = latest.homework[key];
   }
  }
 }
 return data;
}

function resetGame(current) {
 const clean = freshData();
 // Keep assigned curriculum and settings available after wiping play progress.
 for (const key of ['packs','homeworkPacks','sound','narration','migrated']) {
  if (Object.hasOwn(current,key)) clean[key] = current[key];
 }
 for (const id of ['ari','kal']) {
  const next = clean.profiles[id], old = current.profiles[id];
  for (const key of ['activePack','levels','selectedLevel','theme','settings']) {
   if (Object.hasOwn(old,key)) next[key] = old[key];
  }
 }
 clean.migrated = true;
 return keepPaidRewards(clean,current);
}

export async function fullAccountChange({db,account,change,fail,digest,checkedData}) {
 const live = await snapshotContext(db,account.id,fail);
 if (live.username !== change.username) fail(400,'Type the exact explorer username to confirm.');
 if (live.revision !== account.revision) fail(409,'The explorer has a newer save. Reload before continuing.');
 const isReset = change.type === 'account-reset';
 const safetyId = isReset ? change.snapshotId : change.safetySnapshotId;
 const safety = await verifiedSnapshot(db,live,safetyId,fail,digest,checkedData);
 const currentDigest = await digest(JSON.stringify(snapshotContent(live)));
 if (safety.row.revision !== live.revision || safety.row.digest !== currentDigest) fail(409,'Create a verified backup of the current save and badges first.');
 if (!isReset && change.snapshotId === safetyId) fail(400,'Choose a previous backup to restore.');
 const previous = {revision:live.revision,safetySnapshotId:safety.row.id};
 const current = JSON.parse(live.payload);
 if (isReset) return {data:resetGame(current),badges:[],badgeStamp:live.badge_stamp,previous,updated:{reset:true,scope:'all-game-progress'}};
 const restore = await verifiedSnapshot(db,live,change.snapshotId,fail,digest,checkedData);
 return {
  data:keepPaidRewards(restore.data,current),badges:restore.content.badges,badgeStamp:live.badge_stamp,previous,
  updated:{restoredSnapshotId:restore.row.id,restoredRevision:restore.row.revision,scope:'all-game-progress'},
 };
}
