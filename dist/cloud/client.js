import {freshData,validateBackup,exportBackup,importBackup} from '../runner/store.js';
import {esc,download} from '../runner/parent.js';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
const LAST='cq-remembered-explorer-v1',GUEST='crystal-quest-arcade-v1',key=id=>'cq-explorer-save-v1:'+id;
const migrationKey=id=>'cq-explorer-migration-v1:'+id;
export async function createRecoveryPassport(token, username) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw Error('This recovery credential is invalid.');
  const payload = location.origin + '/#cq-recover=' + token;
  const canvas = document.createElement('canvas');
  canvas.width = 760;
  canvas.height = 1030;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw Error('Could not create the recovery passport.');
  ctx.fillStyle = '#f7efd9';
  ctx.fillRect(0, 0, 760, 1030);
  ctx.fillStyle = '#244b48';
  ctx.fillRect(0, 0, 760, 155);
  ctx.fillStyle = '#ffebb5';
  ctx.font = 'bold 34px Trebuchet MS';
  ctx.textAlign = 'center';
  ctx.fillText('EXPLORER RECOVERY PASSPORT', 380, 65);
  ctx.font = 'bold 26px Trebuchet MS';
  ctx.fillText(username, 380, 111);
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, payload, {
    width: 640, margin: 4, errorCorrectionLevel: 'M', color: {dark: '#122f35', light: '#ffffff'}
  });
  ctx.drawImage(qr, 60, 190);
  ctx.fillStyle = '#423b32';
  ctx.font = 'bold 24px Trebuchet MS';
  ctx.fillText('A private spare key for your adventures.', 380, 888);
  ctx.font = '20px Trebuchet MS';
  ctx.fillText('Keep this PNG private. Save a second copy somewhere safe.', 380, 932);
  ctx.fillText('Use the latest passport. Recovered passports are replaced.', 380, 969);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw Error('Could not create the recovery passport.');
  return blob;
}

export function cloudAccounts({getData,replaceData,beforeSwitch,screen,on,back,notice}){const $=id=>document.getElementById(id);let account=null,revision=0,latest=null,pending=null,dirty=false,busy=false,timer=null,state='Device only',stream=null,cameraFrame=0,passport=null,remember=true,available=false,conflict=false,cacheFailed=false;
 const displayStatus=()=>account&&!navigator.onLine?'Offline · progress stays on this device':state;
 function renderStatus(){
  const label=displayStatus(),homeStatus=$('explorer-home-sync');
  for(const target of [$('sync-status'),$('cloud-state'),homeStatus])if(target&&target.textContent!==label)target.textContent=label;
  homeStatus?.classList.toggle('saved',label==='Saved to cloud');
 }
 const status=text=>{state=text;renderStatus();};const request=async(path,body)=>{const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),12000);let r;try{r=await fetch('/api/'+path,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:abort.signal});}finally{clearTimeout(timeout);}let d;try{d=await r.json();}catch{throw Error('Cloud service is unavailable here. Device saves are safe.');}if(!r.ok){const e=Error(d.error||'Cloud request could not finish.');e.status=r.status;throw e;}return d;};
function cache(){if(!account)return;try{cacheFailed=false;localStorage.setItem(key(account.id),JSON.stringify({account,revision,latest,pending,dirty,remember}));if(remember)localStorage.setItem(LAST,JSON.stringify(account));else localStorage.removeItem(LAST);}catch{cacheFailed=true;status('Device storage full — export a backup');}}
function enqueue(data){if(!account||migrationSource)return;latest=structuredClone(data);dirty=true;cache();status(cacheFailed?'Device storage full · sync or export before closing':navigator.onLine?'Syncing…':'Offline · saved on this iPad, sync pending');clearTimeout(timer);timer=setTimeout(flush,1400);}
async function flush(){if(busy){await new Promise(resolve=>{const check=()=>busy?setTimeout(check,50):resolve();check();});return flush();}if(migrationSource)return false;if(!account||conflict||(!pending&&!dirty))return !conflict;busy=true;try{while(pending||dirty){pending??={requestId:crypto.randomUUID(),revision,data:structuredClone(latest)};dirty=false;cache();status('Syncing…');const r=await request('save',pending);revision=r.revision;pending=null;cache();}status('Saved to cloud');return true;}catch(e){if(e.status===409||e.status===400){conflict=true;status('Sync needs review · device copy kept');}else status(navigator.onLine?'Not synced · retry pending':'Offline · changes pending');return false;}finally{busy=false;}}
function stopCamera(){cancelAnimationFrame(cameraFrame);stream?.getTracks().forEach(t=>t.stop());stream=null;}
function pendingMigration(id,revision){
 if(revision!==0)return null;
 try{const source=JSON.parse(localStorage.getItem(migrationKey(id)));return validateBackup(source)?source:null;}catch{return null;}
}
async function adoptSession(result,{guestSource=null}={}){
 stopCamera();await beforeSwitch();if(account&&(pending||dirty)&&!conflict)await flush();if(account)cache();clearTimeout(timer);
 account=result.account;revision=result.revision;remember=result.remember??true;pending=null;dirty=false;conflict=false;latest=structuredClone(result.data);
 migrationSource=guestSource||(!result.migrated&&pendingMigration(account.id,revision))||null;
 cache();replaceData(structuredClone(latest));status(migrationSource?'Device progress ready to attach':'Saved to cloud');
 const proceed=()=>migrationSource?migration():back();
 if(!result.recovery){proceed();return;}
 try{await passportScreen(result.recovery,proceed);}catch(error){
  if(!migrationSource)throw error;
  migration();
  $('migration-message').textContent='Could not show your Recovery Passport. After attaching your progress, save a new passport from My Explorer.';
 }
}
async function boot(){
 try{
  const result=await request('me');available=true;
  if(result.account){
   let cached;try{cached=JSON.parse(localStorage.getItem(key(result.account.id)));}catch{}
   if((cached?.pending||cached?.dirty)&&!pendingMigration(result.account.id,result.revision)){
    account=result.account;revision=cached.revision;latest=cached.latest;pending=cached.pending;dirty=cached.dirty;remember=cached.remember;
    await beforeSwitch();replaceData(structuredClone(latest));await flush();
   }else{result.remember=cached?.remember??true;await adoptSession(result);}
  }else status('Device only · Explorer sign-in available');
 }catch{
  try{
   const saved=JSON.parse(localStorage.getItem(LAST)),cached=saved&&JSON.parse(localStorage.getItem(key(saved.id)));
   if(cached?.latest&&validateBackup(cached.latest)){
    account=saved;revision=cached.revision;latest=cached.latest;pending=cached.pending;dirty=cached.dirty;remember=true;
    migrationSource=pendingMigration(account.id,revision);
    await beforeSwitch();replaceData(structuredClone(latest));status('Offline · device copy, sync pending');
    if(migrationSource)migration();
   }else status('Device only · cloud unavailable');
  }catch{status('Device only · cloud unavailable');}
 }
 const hash=new URLSearchParams(location.hash.slice(1)).get('cq-recover');
 if(hash){history.replaceState(null,'',location.pathname+location.search);await recover(hash);}
}
function show(intent='signin'){stopCamera();beforeSwitch();if(account&&migrationSource){migration();return;}if(account){screen(`<section class="panel explorer-panel"><p class="eyebrow">YOUR PRIVATE EXPLORER</p><h2>🧭 ${esc(account.username)}</h2><p id="cloud-state">${esc(displayStatus())}</p><p>Emberia and Luminara keep their own collections inside this explorer’s account.</p><div class="menu-grid"><button id="sync-now">SYNC NOW</button><button id="change-pin">CHANGE PIN</button><button id="new-passport">SAVE NEW RECOVERY PASSPORT</button><button id="cloud-backup">PRIVATE PROGRESS BACKUP</button><button id="load-cloud">LOAD CLOUD COPY</button><button id="revoke-devices">FORGET OTHER IPADS</button><button id="sign-out">SIGN OUT / SWITCH EXPLORER</button></div><p id="account-message" role="status"></p><button id="account-back" class="primary">BACK TO ARCADE</button></section>`,'accounts');on('account-back',()=>{stopCamera();back();});on('sync-now',async()=>{await flush();if(conflict&&$('account-message'))$('account-message').textContent='Export this device’s backup before loading the newer cloud copy.';});on('change-pin',()=>{screen(`<section class="panel"><h2>Choose a new Explorer PIN</h2><p>Use four memorable digits. Avoid birth years, repeated digits and sequences.</p><input id="new-pin" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password"><div class="row"><button id="save-pin">SAVE NEW PIN</button><button id="cancel-pin">BACK</button></div><p id="pin-message" role="status"></p></section>`,'accounts');on('cancel-pin',show);on('save-pin',async()=>{try{await request('pin',{pin:$('new-pin').value});show();$('account-message').textContent='PIN updated. Other sessions were signed out.';}catch(e){$('pin-message').textContent=e.message;}});});on('cloud-backup',()=>download('private-'+account.username+'-progress.json',exportBackup(getData())));on('new-passport',async()=>{try{const r=await request('passport',{});await passportScreen(r.recovery,show);}catch(e){$('account-message').textContent=e.message;}});on('load-cloud',async()=>{if(!confirm('Export your device backup first. Load the cloud copy? Pending device changes stay in its private cached backup.'))return;try{download('device-before-cloud-reload.json',exportBackup(getData()));const r=await request('me');if(!r.account)throw Error('Sign in again first.');await adoptSession(r);}catch(e){$('account-message').textContent=e.message;}});on('revoke-devices',async()=>{if(!confirm('Sign out other iPads and remove their PIN enrollment? They will need your latest Recovery Passport.'))return;try{await request('revoke-devices',{});$('account-message').textContent='Other devices have been signed out.';}catch(e){$('account-message').textContent=e.message;}});on('sign-out',async()=>{if((pending||dirty)&&!await flush()){download('unsynced-device-progress.json',exportBackup(getData()));if(!confirm('Changes have not synced. A private backup was downloaded and your cached copy is kept. Sign out anyway?'))return;}try{await request('logout',{});}catch{$('account-message').textContent='Connect to the internet to revoke this cloud session before switching.';return;}localStorage.removeItem(LAST);account=null;latest=null;pending=null;dirty=false;conflict=false;migrationSource=null;let guest;try{guest=JSON.parse(localStorage.getItem(GUEST));}catch{}replaceData(guest&&validateBackup(guest)?guest:freshData());status('Signed out · device-only guest');show();});return;}
const creating=intent==='create';
screen(`<section class="panel explorer-panel"><p class="eyebrow">ONE EXPLORER. EVERY ADVENTURE.</p>
 <h2>${creating?'Create My Explorer':'Sign in to My Explorer'}</h2>
 <p>${creating?'Choose a private username and four-digit PIN.':'Use your username and four-digit PIN.'}</p>
 <div class="explorer-form"><label>Explorer username<input id="explorer-username" maxlength="20" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="e.g. moonranger"></label>
 <label>Four-digit PIN<input id="explorer-pin" type="password" inputmode="numeric" maxlength="4" autocomplete="${creating?'new-password':'current-password'}" placeholder="••••"></label>
 <label class="remember"><input id="remember-explorer" type="checkbox" checked> Remember My Explorer on this trusted iPad</label></div>
 <div class="row"><button class="${creating?'':'primary'}" id="explorer-login">SIGN IN</button><button class="${creating?'primary':''}" id="explorer-create">CREATE MY EXPLORER</button><button id="explorer-recover">RECOVER MY EXPLORER</button></div>
 <p class="subtle">On a new iPad, use your private Recovery Passport first.</p><p id="account-message" role="status"></p><button id="account-back">BACK TO ARCADE</button></section>`,'accounts');
 on('account-back',back);
 const auth=async create=>{
  const buttons=['explorer-create','explorer-login','explorer-recover','account-back'].map($);
  for(const button of buttons)button.disabled=true;
  try{
   if(!available){const health=await request('health');if(!health.cloud)throw Error('Cloud setup is not ready. Your device progress remains available.');available=true;}
   const guestSource=create?structuredClone(getData()):null;
   const keepSession=$('remember-explorer').checked;
   const result=await request(create?'signup':'login',{username:$('explorer-username').value,pin:$('explorer-pin').value,remember:keepSession});
   result.remember=keepSession;
   if(guestSource){try{localStorage.setItem(migrationKey(result.account.id),JSON.stringify(guestSource));}catch{}}
   await adoptSession(result,{guestSource});
  }catch(e){if($('account-message'))$('account-message').textContent=e.message;}
  finally{for(const button of buttons)if(button.isConnected)button.disabled=false;}
 };
 on('explorer-login',()=>auth(false));on('explorer-create',()=>auth(true));on('explorer-recover',recoveryScreen);
}
let migrationSource=null;
function finishMigration(){
 try{localStorage.removeItem(migrationKey(account.id));}catch{}
 migrationSource=null;
}
function migration(){const source=migrationSource;screen(`<section class="panel"><p class="eyebrow">KEEP EVERY TREASURE</p><h2>Attach this iPad’s progress?</h2><p>Choose the existing collection(s) that belong to <strong>${esc(account.username)}</strong>. Unselected collections stay on this device and are not copied into this cloud account. No other cloud explorer will be changed.</p><p>Emberia: ◆ ${source?.profiles?.ari?.collection?.wallet||source?.profiles?.ari?.crystals||0} · Luminara: ◆ ${source?.profiles?.kal?.collection?.wallet||source?.profiles?.kal?.crystals||0}</p><div class="migration-profiles"><label><input id="migrate-emberia" type="checkbox"> Attach Emberia’s collection</label><label><input id="migrate-luminara" type="checkbox"> Attach Luminara’s collection</label></div><div class="row"><button id="migration-backup" class="secondary">DOWNLOAD DEVICE BACKUP</button><button id="confirm-migration" disabled>YES, THIS IS MY PROGRESS</button><button id="skip-migration">START WITH EMPTY CLOUD COLLECTIONS</button></div><p id="migration-message" role="status">Download the backup before attaching your device progress.</p></section>`,'accounts');let backedUp=false,attaching=false;const enable=()=>{$('confirm-migration').disabled=attaching||!backedUp||!($('migrate-emberia').checked||$('migrate-luminara').checked);};on('migrate-emberia',enable,'change');on('migrate-luminara',enable,'change');on('migration-backup',()=>{backedUp=true;download('crystal-quest-before-migration.json',exportBackup(source));enable();});on('skip-migration',()=>{finishMigration();status('Saved to cloud');back();});on('confirm-migration',async()=>{attaching=true;enable();$('skip-migration').disabled=true;try{if(!navigator.onLine)throw Error('Connect to the internet to attach this device’s progress.');const selected=freshData(),usedPacks=new Set(Object.keys(selected.packs)),usedHomework=new Set();for(const [id,box]of [['ari','migrate-emberia'],['kal','migrate-luminara']])if($(box).checked){selected.profiles[id]=structuredClone(source.profiles[id]);for(const l of source.profiles[id].levels||[])usedPacks.add(l.packId);usedPacks.add(source.profiles[id].activePack);for(const pid of Object.keys(source.profiles[id].learning||{}))usedPacks.add(pid);for(const pid of source.profiles[id].homework?.assigned||[])usedHomework.add(pid);}for(const id of usedPacks)if(source.packs[id])selected.packs[id]=structuredClone(source.packs[id]);selected.homeworkPacks=Object.fromEntries([...usedHomework].map(id=>[id,structuredClone(source.homeworkPacks[id])]));selected.sound=source.sound;selected.narration=source.narration;selected.migrated=true;const r=await request('migrate',{requestId:'migration-'+account.id,revision,data:selected,confirmed:true});revision=r.revision;latest=structuredClone(selected);cache();replaceData(structuredClone(selected));finishMigration();status('Saved to cloud');back();}catch(e){$('migration-message').textContent=e.message;attaching=false;$('skip-migration').disabled=false;enable();}});}
async function passportScreen(token,done){stopCamera();const blob=await createRecoveryPassport(token,account.username);if(passport?.url)URL.revokeObjectURL(passport.url);passport={blob,url:URL.createObjectURL(blob)};screen(`<section class="panel passport-panel"><p class="eyebrow">${esc(account.username)} · PRIVATE SPARE KEY</p><h2>Save your Recovery Passport</h2><p>Anyone with this PNG can recover your explorer. Keep it private.<br>This replaces your old passport. Save an extra copy off this iPad.</p><img id="passport-image" src="${passport.url}" alt="Private scannable explorer recovery passport"><div class="row"><button id="share-passport" class="primary">SAVE / SHARE PNG</button><button id="download-passport">DOWNLOAD TO FILES</button><button id="passport-done">I SAVED MY PASSPORT</button></div><p id="passport-message" role="status">No printing needed. Photos or Files both work.</p></section>`,'accounts');$('passport-image').addEventListener('contextmenu',e=>e.stopPropagation());on('download-passport',()=>{const a=document.createElement('a');a.href=passport.url;a.download='private-explorer-'+account.username+'-passport.png';a.click();$('passport-message').textContent='PNG download requested. Check Files / Downloads and keep your latest passport.';});on('share-passport',async()=>{const file=new File([passport.blob],'private-explorer-passport.png',{type:'image/png'});try{if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:'Private Explorer Recovery Passport'});else $('download-passport').click();}catch(e){$('passport-message').textContent=e.name==='AbortError'?'Save canceled. You can try again.':'Use Download to Files, or touch and hold the image.';}});on('passport-done',()=>{if(passport?.url)URL.revokeObjectURL(passport.url);passport=null;done();});}
function recoveryScreen(){stopCamera();screen(`<section class="panel"><p class="eyebrow">WELCOME BACK, EXPLORER</p><h2>Recover My Explorer</h2><p>Choose your private saved passport from Photos or Files on this iPad,<br>or scan it displayed on another device. Old replaced passports cannot be reused.</p><div class="row"><button class="primary" id="choose-passport">CHOOSE QR IMAGE</button><button id="camera-passport">SCAN ANOTHER DEVICE</button><button id="recover-back">BACK</button></div><input hidden id="passport-file" type="file" accept="image/png,image/jpeg,image/webp"><video id="recovery-camera" muted playsinline hidden></video><p id="recovery-message" role="status"></p></section>`,'accounts');on('recover-back',()=>{stopCamera();show();});on('choose-passport',()=>$('passport-file').click());on('passport-file',async()=>{try{const f=$('passport-file').files[0];if(!f)return;if(f.size>8000000||!['image/png','image/jpeg','image/webp'].includes(f.type))throw Error('Choose a PNG, JPEG or WebP passport image smaller than 8 MB.');const bitmap=await createImageBitmap(f);if(bitmap.width*bitmap.height>24000000){bitmap.close();throw Error('Choose the original passport PNG, not a very large photograph.');}const canvas=document.createElement('canvas'),scale=Math.min(1,1400/Math.max(bitmap.width,bitmap.height));canvas.width=bitmap.width*scale;canvas.height=bitmap.height*scale;const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const img=c.getImageData(0,0,canvas.width,canvas.height),qr=jsQR(img.data,img.width,img.height);if(!qr)throw Error('No recovery QR was found. Choose your saved passport PNG.');await recover(parseQR(qr.data));}catch(e){$('recovery-message')&&($('recovery-message').textContent=e.message);}},'change');on('camera-passport',async()=>{try{if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera scanning is unavailable. Choose your saved PNG instead.');stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});const v=$('recovery-camera');v.srcObject=stream;v.hidden=false;await v.play();const canvas=document.createElement('canvas'),c=canvas.getContext('2d',{willReadFrequently:true});let last=0;const scan=async now=>{if(!stream)return;if(now-last>500&&v.readyState>=2){last=now;canvas.width=640;canvas.height=Math.round(640*v.videoHeight/v.videoWidth);c.drawImage(v,0,0,canvas.width,canvas.height);const img=c.getImageData(0,0,canvas.width,canvas.height),qr=jsQR(img.data,canvas.width,canvas.height);if(qr){try{const token=parseQR(qr.data);stopCamera();await recover(token);return;}catch(e){$('recovery-message')&&($('recovery-message').textContent=e.message);}}}cameraFrame=requestAnimationFrame(scan);};cameraFrame=requestAnimationFrame(scan);}catch(e){stopCamera();$('recovery-message').textContent=e.name==='NotAllowedError'?'Camera permission was not granted. Choose a QR image from Photos or Files instead.':e.message;}});}
function parseQR(value){let u;try{u=new URL(value);}catch{throw Error('This is not a Crystal Quest Recovery Passport.');}const token=new URLSearchParams(u.hash.slice(1)).get('cq-recover');if(u.origin!==location.origin||u.pathname!=='/'||!token||!/^[a-f0-9]{64}$/.test(token))throw Error('Choose a recovery passport for this exact website.');return token;}
async function recover(token){try{const r=await request('recover',{token});await adoptSession(r);}catch(e){if($('recovery-message'))$('recovery-message').textContent=e.message;else{recoveryScreen();$('recovery-message').textContent=e.message;}}}
window.addEventListener('online',()=>{renderStatus();if(account)flush();});window.addEventListener('offline',renderStatus);window.addEventListener('pagehide',()=>{stopCamera();cache();});document.addEventListener('visibilitychange',()=>{if(document.hidden){stopCamera();cache();}});
return {boot,show,enqueue,flush,get active(){return account;},get storageKey(){return account?key(account.id)+':game':GUEST;},get status(){return state;},get displayStatus(){return displayStatus();},get cacheFailed(){return cacheFailed;}};}
