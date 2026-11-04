import {adventureHost} from './adventure-host.js';
// Both adventures use these services; adventure content and state stay in their own modules.
export function readSaved(storage,key,makeFresh,concepts){const host=adventureHost();if(host)return host.load(makeFresh);try{const p=JSON.parse(storage.getItem(key));if(p?.version!==1)return makeFresh();const base=makeFresh();return {...base,...p,stats:Object.fromEntries(concepts.map(c=>[c.id,{...base.stats[c.id],...p.stats?.[c.id]}]))};}catch{return makeFresh();}}
export function writeSaved(storage,key,value){const host=adventureHost();if(host){host.save(value);return true;}try{storage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
export function createAudio(bank){let context=null;return {play(type,enabled){if(!enabled)return;try{context??=new(window.AudioContext||window.webkitAudioContext)();context.resume();(bank[type]||bank.star||bank.crystal||[600]).forEach((hz,i)=>{const o=context.createOscillator(),g=context.createGain(),t=context.currentTime+i*.08;o.frequency.value=hz;o.type='sine';g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(.055,t+.012);g.gain.exponentialRampToValueAtTime(.001,t+.16);o.connect(g);g.connect(context.destination);o.start(t);o.stop(t+.18);});}catch{}},async close(){try{if(context&&context.state!=='closed')await context.close();}catch{}context=null;}};}
export function bindControls({getState,isPlaying,easy=()=>false,interact,escape}){
 const abort=new AbortController(),pointers=new Map(),keys=new Set(),buttons=['left','right','jump'].map(id=>document.getElementById(id));
 const listen=(target,event,fn)=>target.addEventListener(event,fn,{signal:abort.signal});
 function sync(){const s=getState();for(const dir of ['left','right']){s[dir]=[...pointers.values()].includes(dir)||keys.has(dir);document.getElementById(dir).classList.toggle('held',s[dir]);}}
 function clear(){pointers.clear();keys.clear();Object.assign(getState(),{left:false,right:false,jump:false});buttons.forEach(b=>b.classList.remove('held'));}
 for(const b of buttons){const id=b.id;listen(b,'pointerdown',e=>{e.preventDefault();if(!isPlaying())return;b.setPointerCapture(e.pointerId);if(easy()&&id!=='jump'){const same=keys.has(id);keys.clear();if(!same)keys.add(id);}else pointers.set(e.pointerId,id);if(id==='jump')getState().jump=true;sync();b.classList.add('held');});for(const event of ['pointerup','pointercancel','lostpointercapture'])listen(b,event,e=>{e.preventDefault();pointers.delete(e.pointerId);if(event==='pointercancel')keys.clear();b.classList.remove('held');sync();});}
 listen(document.getElementById('action'),'click',interact);
 listen(document,'keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','a','d','w','e','Escape'].includes(e.key))e.preventDefault();if(e.key==='Escape'){escape();return;}if(!isPlaying())return;if(['ArrowLeft','a'].includes(e.key))keys.add('left');if(['ArrowRight','d'].includes(e.key))keys.add('right');if([' ','ArrowUp','w'].includes(e.key)&&!e.repeat)getState().jump=true;if(e.key==='e'&&!e.repeat)interact();sync();});
 listen(document,'keyup',e=>{if(['ArrowLeft','a'].includes(e.key))keys.delete('left');if(['ArrowRight','d'].includes(e.key))keys.delete('right');sync();});
 return {clear,destroy(){clear();abort.abort();}};
}
export function registerAdventure({player,save,stop}){
 let disposed=false;const abort=new AbortController();
 const dispose=async()=>{if(disposed)return;disposed=true;save();await stop();};
 Object.defineProperty(window,'arcadeLifecycle',{value:{dispose,get disposed(){return disposed;}},configurable:false});
 window.addEventListener('message',async e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='arcade:dispose')return;await dispose();parent.postMessage({type:'arcade:disposed',player},location.origin);},{signal:abort.signal});
 window.addEventListener('pagehide',()=>{dispose();abort.abort();},{once:true});
 if('serviceWorker'in navigator)navigator.serviceWorker.register(new URL('../sw.js',import.meta.url),{scope:new URL('../',import.meta.url).pathname}).catch(()=>{});
 if(parent!==window)parent.postMessage({type:'arcade:ready',player},location.origin);
 return {dispose};
}
export function backToArcade(){if(parent!==window)parent.postMessage({type:'arcade:home'},location.origin);else location.href=new URL('../index.html',location.href).href;}
