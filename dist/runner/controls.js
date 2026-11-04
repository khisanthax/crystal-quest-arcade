export function bindRunnerControls({surface,buttons,onAction,isRunning,onSlideHold=()=>{}}){
 const abort=new AbortController(),pointers=new Map(),keys=new Set(),swipes=new Map();let held=0,repeat=0;
 const listen=(el,type,fn)=>el.addEventListener(type,fn,{signal:abort.signal});
 const release=()=>{pointers.clear();keys.clear();swipes.clear();held=0;repeat=0;onSlideHold(false);buttons.querySelectorAll('button').forEach(b=>b.classList.remove('held'));};
 function sync(){const values=[...pointers.values(),...keys];held=Number(values.includes('right'))-Number(values.includes('left'));onSlideHold(values.includes('slide'));}
 for(const b of buttons.querySelectorAll('[data-action]')){
  // A native keyboard or assistive click has no pointer sequence.
  listen(b,'click',e=>{if(e.detail===0&&isRunning())onAction(b.dataset.action);});
  listen(b,'pointerdown',e=>{e.preventDefault();if(!isRunning())return;try{b.setPointerCapture(e.pointerId);}catch{}const action=b.dataset.action;pointers.set(e.pointerId,action);b.classList.add('held');onAction(action);repeat=.32;sync();});for(const event of ['pointerup','pointercancel','lostpointercapture'])listen(b,event,e=>{pointers.delete(e.pointerId);b.classList.remove('held');sync();});}
 listen(surface,'pointerdown',e=>{if(!isRunning())return;try{surface.setPointerCapture(e.pointerId);}catch{}swipes.set(e.pointerId,{x:e.clientX,y:e.clientY});});listen(surface,'pointermove',e=>{const p=swipes.get(e.pointerId);if(!p||p.used||!isRunning())return;const dx=e.clientX-p.x,dy=e.clientY-p.y;if(Math.max(Math.abs(dx),Math.abs(dy))<32)return;onAction(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'slide':'jump');p.used=true;});for(const event of ['pointerup','pointercancel','lostpointercapture'])listen(surface,event,e=>swipes.delete(e.pointerId));
 const mapping={ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right',ArrowUp:'jump',' ':'jump',w:'jump',ArrowDown:'slide',s:'slide',e:'power'};
 listen(document,'keydown',e=>{if(!mapping[e.key]||!isRunning())return;if(e.key===' '&&e.target instanceof Element&&buttons.contains(e.target)&&e.target.closest('[data-action]'))return;e.preventDefault();if(!e.repeat){onAction(mapping[e.key]);keys.add(mapping[e.key]);repeat=.32;sync();}});listen(document,'keyup',e=>{keys.delete(mapping[e.key]);sync();});listen(window,'blur',release);listen(document,'visibilitychange',()=>{if(document.hidden)release();});
 return {clear(){release();},update(dt){if(!isRunning()){release();return;}repeat-=dt;if(held&&repeat<=0){onAction(held>0?'right':'left');repeat=.18;}},destroy(){release();abort.abort();},get held(){return held;}};
}
