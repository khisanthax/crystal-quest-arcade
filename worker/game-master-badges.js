import {RARITIES} from '../dist/runner/pet-catalog.js';

const icons = ['crown','star','crystal','trophy','paw','moon','leaf','flame','heart','shield'];
const badgeId = /^[a-z0-9-]{16,80}$/i;
// SQLite and the browser use the same inclusive UTC calendar day.
export const badgeAvailableSql = "active=1 AND (ends_on IS NULL OR ends_on >= date('now'))";
const availableOn = (active,endsOn) => !!active && (!endsOn || endsOn >= new Date().toISOString().slice(0,10));
export const badgeView = ({event_name,ends_on,...row}) => ({
 ...row,active:!!row.active,event:event_name ?? null,endsOn:ends_on ?? null,
 available:availableOn(row.active,ends_on),
});

export async function listBadges(db) {
 const rows = (await db.prepare('SELECT * FROM game_master_badges ORDER BY name,id').all()).results;
 return {badges:rows.map(badgeView),icons,rarities:RARITIES};
}

export async function playerBadges(db,account,profile) {
 const rows = await db.prepare(
  'SELECT b.id,b.name,b.description,b.rarity,b.icon,b.event_name AS event,p.awarded FROM player_badges p JOIN game_master_badges b ON b.id=p.badge_id WHERE p.account_id=? AND p.profile=? ORDER BY p.awarded DESC,b.name'
 ).bind(account,profile).all();
 return rows.results;
}

export async function saveBadge(body,{db,a,env,fail,response,randomToken,signature,requestGate}) {
 const {requestId,rarity,icon,active} = body;
 const name = typeof body.name === 'string' ? body.name.trim() : '';
 const description = typeof body.description === 'string' ? body.description.trim() : '';
 const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
 const event = body.event == null ? null : typeof body.event === 'string' ? body.event.trim() || null : false;
 if (event === false || event && (event.length>80 || /[\x00-\x1f\x7f]/.test(event))) fail(400,'Enter a short occasion name, up to 80 characters.');
 const endsOn = body.endsOn == null || body.endsOn === '' ? null : body.endsOn;
 if (endsOn !== null) {
  if (typeof endsOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) fail(400,'Choose an end date in YYYY-MM-DD format.');
  const day = new Date(endsOn+'T00:00:00Z');
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0,10)!==endsOn) fail(400,'Choose a valid end date.');
 }
 if (reason.length > 180) fail(400,'Enter a shorter reason for this badge change.');
 if (typeof requestId !== 'string' || !badgeId.test(requestId) || body.confirmed !== true) fail(400,'Confirm the badge changes.');
 if (!name || name.length > 60 || !description || description.length > 300) fail(400,'Enter a badge name and a short description.');
 if (!RARITIES.includes(rarity) || !icons.includes(icon) || typeof active !== 'boolean') fail(400,'Choose a valid rarity, icon and status.');

 const fingerprint = await signature(env.CQ_GAME_MASTER_KEY,JSON.stringify(body));
 const existing = () => db.prepare('SELECT actor,fingerprint,result FROM game_master_requests WHERE id=?').bind(requestId).first();
 const replay = prior => {
  if (prior.actor !== a.id || prior.fingerprint !== fingerprint) fail(409,'This request ID was already used for another change.');
  const result = JSON.parse(prior.result);
  result.badge.available = availableOn(result.badge.active,result.badge.endsOn);
  return response({...result,duplicate:true});
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
 const badge = badgeView({
  id,name,description,rarity,icon,active,version:(old?.version ?? 0)+1,updated:now,
  event_name:body.event===undefined ? old?.event_name ?? null : event,
  ends_on:body.endsOn===undefined ? old?.ends_on ?? null : endsOn,
 });
 const result = {badge};
 const gate = editing ? 'EXISTS (SELECT 1 FROM game_master_badges WHERE id=? AND version=?)' : 'NOT EXISTS (SELECT 1 FROM game_master_badges WHERE id=?)';
 const args = editing ? [id,old.version] : [id];
 const applied = await db.batch([
  db.prepare('INSERT OR IGNORE INTO game_master_requests (id,actor,fingerprint,marker,result,created) SELECT ?,?,?,?,?,? WHERE '+gate)
   .bind(requestId,a.id,fingerprint,marker,JSON.stringify(result),now,...args),
  db.prepare('INSERT INTO game_master_badges(id,name,description,rarity,icon,active,version,updated,event_name,ends_on) SELECT ?,?,?,?,?,?,?,?,?,? WHERE '+requestGate+' ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,rarity=excluded.rarity,icon=excluded.icon,active=excluded.active,version=excluded.version,updated=excluded.updated,event_name=excluded.event_name,ends_on=excluded.ends_on')
   .bind(id,name,description,rarity,icon,Number(active),badge.version,now,badge.event,badge.endsOn,requestId,marker),
  db.prepare("INSERT INTO game_master_audit (request_id,actor,account_id,profile,action,reason,previous,updated,created) SELECT ?,?,?,NULL,'badge:save',?,?,?,? WHERE "+requestGate)
   .bind(requestId,a.id,a.id,reason || 'Exclusive badge configuration',JSON.stringify(old ? badgeView(old) : null),JSON.stringify(badge),now,requestId,marker),
 ]);
 if (!applied[0].meta.changes) {
  const concurrent = await existing();
  if (concurrent) return replay(concurrent);
  fail(409,'The badge changed. Reload it and try again.');
 }
 return response(result);
}
