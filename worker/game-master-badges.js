import {RARITIES} from '../dist/runner/pet-catalog.js';

const icons = ['crown','star','crystal','trophy','paw','moon','leaf','flame','heart','shield'];
const badgeId = /^[a-z0-9-]{16,80}$/i;
export const badgeView = row => ({...row,active:!!row.active});

export async function listBadges(db) {
 const rows = (await db.prepare('SELECT * FROM game_master_badges ORDER BY name,id').all()).results;
 return {badges:rows.map(badgeView),icons,rarities:RARITIES};
}

export async function playerBadges(db,account,profile) {
 const rows = await db.prepare(
  'SELECT b.id,b.name,b.description,b.rarity,b.icon,p.awarded FROM player_badges p JOIN game_master_badges b ON b.id=p.badge_id WHERE p.account_id=? AND p.profile=? ORDER BY p.awarded DESC,b.name'
 ).bind(account,profile).all();
 return rows.results;
}

export async function saveBadge(body,{db,a,env,fail,response,randomToken,signature,requestGate}) {
 const {requestId,rarity,icon,active} = body;
 const name = typeof body.name === 'string' ? body.name.trim() : '';
 const description = typeof body.description === 'string' ? body.description.trim() : '';
 if (typeof requestId !== 'string' || !badgeId.test(requestId) || body.confirmed !== true) fail(400,'Confirm the badge changes.');
 if (!name || name.length > 60 || !description || description.length > 300) fail(400,'Enter a badge name and a short description.');
 if (!RARITIES.includes(rarity) || !icons.includes(icon) || typeof active !== 'boolean') fail(400,'Choose a valid rarity, icon and status.');

 const fingerprint = await signature(env.CQ_GAME_MASTER_KEY,JSON.stringify(body));
 const existing = () => db.prepare('SELECT actor,fingerprint,result FROM game_master_requests WHERE id=?').bind(requestId).first();
 const replay = prior => {
  if (prior.actor !== a.id || prior.fingerprint !== fingerprint) fail(409,'This request ID was already used for another change.');
  return response({...JSON.parse(prior.result),duplicate:true});
 };
 const prior = await existing();
 if (prior) return replay(prior);

 const editing = body.id !== undefined;
 const id = editing ? body.id : requestId;
 if (typeof id !== 'string' || !badgeId.test(id)) fail(400,'Choose an existing badge.');
 const old = editing ? await db.prepare('SELECT * FROM game_master_badges WHERE id=?').bind(id).first() : null;
 if (editing && (!old || body.version !== old.version)) {
  const concurrent = await existing();
  if (concurrent) return replay(concurrent);
  fail(409,'Reload the badge before editing it.');
 }
 const marker = randomToken(), now = Date.now();
 const badge = {id,name,description,rarity,icon,active,version:(old?.version ?? 0)+1,updated:now};
 const result = {badge};
 const gate = editing ? 'EXISTS (SELECT 1 FROM game_master_badges WHERE id=? AND version=?)' : 'NOT EXISTS (SELECT 1 FROM game_master_badges WHERE id=?)';
 const args = editing ? [id,old.version] : [id];
 const applied = await db.batch([
  db.prepare('INSERT OR IGNORE INTO game_master_requests (id,actor,fingerprint,marker,result,created) SELECT ?,?,?,?,?,? WHERE '+gate)
   .bind(requestId,a.id,fingerprint,marker,JSON.stringify(result),now,...args),
  db.prepare('INSERT INTO game_master_badges(id,name,description,rarity,icon,active,version,updated) SELECT ?,?,?,?,?,?,?,? WHERE '+requestGate+' ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,rarity=excluded.rarity,icon=excluded.icon,active=excluded.active,version=excluded.version,updated=excluded.updated')
   .bind(id,name,description,rarity,icon,Number(active),badge.version,now,requestId,marker),
  db.prepare("INSERT INTO game_master_audit (request_id,actor,account_id,profile,action,reason,previous,updated,created) SELECT ?,?,?,NULL,'badge:save',?,?,?,? WHERE "+requestGate)
   .bind(requestId,a.id,a.id,'Exclusive badge configuration',JSON.stringify(old ? badgeView(old) : null),JSON.stringify(badge),now,requestId,marker),
 ]);
 if (!applied[0].meta.changes) {
  const concurrent = await existing();
  if (concurrent) return replay(concurrent);
  fail(409,'The badge changed. Reload it and try again.');
 }
 return response(result);
}
