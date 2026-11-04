import {ensureJourneys} from '../dist/runner/journeys.js';
import {migrateLevelHistory} from '../dist/runner/levels.js';
import {report} from '../dist/runner/store.js';
import {WORLDS} from '../dist/runner/worlds.js';
import {readyCases} from './reading-ready.js';

const identities = {emberia:'ari',luminara:'kal'};
const stageIds = [0,1,2];
const own = (object,key) => Object.hasOwn(object || {},key);
const date = value => {
 if (Number.isFinite(value)) return value;
 const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
 return Number.isFinite(parsed) ? parsed : null;
};
const stages = value => stageIds.filter(stage => Array.isArray(value) && value.includes(stage));
const labelFromId = id => id.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[-_]+/g,' ').replace(/^./,c=>c.toUpperCase());

async function homeworkReport(db,account,key,data,player) {
 const assignments = (await db.prepare('SELECT id,payload,published FROM reading_publications WHERE account_id=? AND profile=? ORDER BY published DESC')
  .bind(account,key).all()).results;
 const published = new Map(assignments.map(row=>[row.id,{pack:JSON.parse(row.payload),at:row.published}]));
 const homework = player.homework || {};
 const active = typeof homework.active === 'string' ? homework.active : null;
 const ids = new Set([...Object.keys(homework.cases || {}),...published.keys()]);
 for (const id of Array.isArray(homework.assigned) ? homework.assigned : []) ids.add(id);
 if (active) ids.add(active);

 const cases = [];
 for (const id of ids) {
  const record = published.get(id);
  const local = own(data.homeworkPacks,id) ? data.homeworkPacks[id] : null;
  const pack = record?.pack || local || readyCases.find(candidate=>candidate.id===id && !candidate.reviewRequired);
  if (!pack || !Array.isArray(pack.questions)) continue;
  const attempts = Array.isArray(homework.cases?.[id]) ? homework.cases[id] : [];
  const latest = attempts.at(-1);
  const missions = pack.questions.map((q,index)=>({id:q.id,number:index+1,written:!!latest?.written?.[q.id]}));
  const startedAt = date(latest?.started), completedAt = date(latest?.completed);
  const activity = completedAt ?? startedAt ?? date(record?.at) ?? 0;
  cases.push({
   id,title:pack.title,startedAt,completedAt,written:missions.filter(m=>m.written).length,total:missions.length,
   attempts:attempts.length,active:id===active,missions,activity,
  });
 }
 cases.sort((left,right)=>Number(right.active)-Number(left.active) || right.activity-left.activity);
 return {active:cases.some(item=>item.id===active) ? active : null,cases:cases.slice(0,20).map(({activity,...item})=>item)};
}

export async function progressReport(db,account,{profile,packId},fail) {
 if (typeof profile !== 'string' || !own(identities,profile)) fail(400,'Choose a fantasy profile.');
 const key = identities[profile], data = JSON.parse(account.payload), p = data.profiles[key];
 migrateLevelHistory(p);
 ensureJourneys(p);
 const selected = packId ?? p.activePack;
 const allowed = new Set([p.activePack,...p.levels.map(level=>level.packId),...Object.keys(p.levelProgress)]);
 if (typeof selected !== 'string' || !allowed.has(selected) || !own(data.packs,selected)) fail(404,'Choose a study pack assigned to this profile.');
 const pack = data.packs[selected], h = p.learning[selected] || {questions:{},concepts:{}};
 const metadata = id => ({
  id,title:data.packs[id].title,
  archived:!!data.packs[id].archived || !!p.levels.find(level=>level.packId===id)?.archived,
 });
 const totals = report(pack,h);
 const concepts = [...pack.vocabulary,...pack.facts];
 const missed = concepts.flatMap(concept=>{
  const r = h.concepts[concept.id];
  if (!r || !(r.incorrect>0 || r.review>0)) return [];
  const term = concept.term;
  const label = term && term!==concept.id ? term : labelFromId(concept.id);
  // Use only progress counters. Question prompts, stored attempts, choices
  // and answer keys belong to the workshop and are not part of a report.
  return [{id:concept.id,label,incorrect:r.incorrect || 0,review:r.review || 0,latest:date(r.lastDate)}];
 }).sort((a,b)=>b.review-a.review || b.incorrect-a.incorrect || a.label.localeCompare(b.label));

 const worlds = Object.entries(WORLDS).map(([id,world])=>{
  const record = p.levelProgress[selected]?.worlds?.[id];
  return {
   id,name:world.name,
   runnerCompleted:stages(p.journeys.runner[id]?.completed),
   originalCompleted:stages(p.journeys.original[id]?.completed),
   packStagesCompleted:stages(record?.stageIds),
   bestScore:record?.bestScore ?? null,
   finishes:record?.finishes ?? 0,
  };
 });
 const savedLocation = p.lastAdventure;
 const location = savedLocation && ['runner','original'].includes(savedLocation.mode) && own(WORLDS,savedLocation.world) &&
  stageIds.includes(savedLocation.stage) && own(data.packs,savedLocation.packId) ? savedLocation : null;
 return {
  profile,pack:metadata(selected),packs:[...allowed].filter(id=>own(data.packs,id)).map(metadata),
  coverage:{
   attempted:totals.attempted,totalQuestions:pack.questions.length,presented:totals.presented,firstCorrect:totals.first,
   accuracy:totals.presented ? Math.round(100*totals.first/totals.presented) : null,
   assessedConcepts:concepts.filter(concept=>h.concepts[concept.id]?.presented>0).length,
   mastered:totals.mastered,totalConcepts:totals.total,needsPractice:totals.needs,
   sessions:h.sessions || 0,lastSession:date(h.lastSession),
  },
  missed,homework:await homeworkReport(db,account.id,key,data,p),worlds,
  location:location ? {mode:location.mode,world:location.world,stage:location.stage,packId:location.packId} : null,
 };
}
