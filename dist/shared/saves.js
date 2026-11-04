export const WORLD_NAMES={ari:'Emberia',kal:'Luminara'};
export const WORLD_ROUTES={ari:'emberia',kal:'luminara'};
export const SAVE_KEYS={ari:'volcano-quest-v1',kal:'star-quest-kal-v1'};
const IDS={ari:['metamorphic','dating','lava','core','weathering','erosion','crust','magma','fossil','mantle','plate','sedimentary','sediment'],kal:['rotation','orbit','phases','earth','sun','moon','planet','star','sphere','year','moonDays','dayStars','north','full','new','opposite','day','dayLength','east','west']};
export function validSave(player,p){
 if(!SAVE_KEYS[player]||!p||p.version!==1||!p.stats||typeof p.stats!=='object')return false;
 const raw=JSON.stringify(p);if(raw.length>500000||raw.includes('<')||raw.includes('>'))return false;
 for(const id of IDS[player]){const s=p.stats[id];if(!s||typeof s!=='object')return false;for(const key of ['encounters','firstCorrect',player==='ari'?'incorrect':'mistakes'])if(!Number.isSafeInteger(s[key])||s[key]<0)return false;}
 if(p.run!==null&&p.run!==undefined){const r=p.run;if(!Number.isInteger(r.level)||r.level<0||r.level>2||!Number.isFinite(r.checkpoint)||r.checkpoint<0||r.checkpoint>6200||!Array.isArray(r.done))return false;for(const key of player==='ari'?['crystals','score']:['stars','score'])if(!Number.isFinite(r[key])||r[key]<0)return false;}
 return true;
}
export function readPlayer(storage,player){try{const p=JSON.parse(storage.getItem(SAVE_KEYS[player]));return validSave(player,p)?p:null;}catch{return null;}}
export function writePlayer(storage,player,p){if(!validSave(player,p))throw Error('This is not a valid '+WORLD_NAMES[player]+' save.');storage.setItem(SAVE_KEYS[player],JSON.stringify(p));}
export function backup(player,progress){if(!validSave(player,progress))throw Error('No valid progress to back up yet.');return {format:'science-adventure-arcade-save-v1',world:WORLD_ROUTES[player],progress};}
export function parseBackup(raw){const data=JSON.parse(raw);const player=Object.keys(WORLD_ROUTES).find(p=>WORLD_ROUTES[p]===data.world)||data.player;if(data.format!=='science-adventure-arcade-save-v1'||!validSave(player,data.progress))throw Error('Choose a Science Adventure Arcade backup file.');return {...data,player};}
