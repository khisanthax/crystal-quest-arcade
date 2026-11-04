import {esc} from '../runner/parent.js';
import {badgeIcon,badgeLabel} from '../shared/badges.js';

const option=(value,label)=>`<option value="${esc(value)}">${esc(label)}</option>`;
const reasonField='<label>Reason<input name="reason" required maxlength="180"></label>';
const identities={emberia:'Emberia',luminara:'Luminara'};

export async function mountBadges({host,request,players,selected,profile,refresh,message}){
 let catalog;
 try{catalog=await request('badges');}
 catch(e){if(host.isConnected)host.querySelector('[data-badge-status]').textContent=e.message;return;}
 if(!host.isConnected)return;
 const {badges,icons,rarities}=catalog;
 const active=badges.filter(b=>b.active);
 const recipients=players.filter(p=>!p.disabled);
 host.innerHTML=`
  <h3>Collectible badges</h3>
  <p>Give a collectible to one or more explorers. Retiring a badge keeps existing awards.</p>
  ${active.length&&recipients.length?`
  <form data-badge-grant>
   <h4>Award a badge</h4>
   <div class="fields">
    <label>Collectible badge<select name="badgeId" required>
     ${option('','Choose a badge')}${active.map(b=>option(b.id,badgeIcon(b.icon)+' '+b.name)).join('')}
    </select></label>
    <label>Badge identity<select name="badgeProfile">${Object.entries(identities).map(([id,name])=>option(id,name)).join('')}</select></label>
   </div>
   <fieldset><legend>Badge recipients</legend>
    ${recipients.map(p=>`<label class="check"><input name="badgeRecipients" type="checkbox" value="${esc(p.id)}" ${p.id===selected?'checked':''}> ${esc(p.username)}</label>`).join('')}
   </fieldset>
   ${reasonField}
   <button class="primary">Preview badge award</button>
  </form>`:'<p>Create an available badge to award it to an explorer.</p>'}
  <form class="section-gap" data-badge-edit>
   <h4>Create or edit a badge</h4>
   <label>Saved badge<select name="editBadge">${option('','New badge')}
    ${badges.map(b=>option(b.id,b.name+(b.active?'':' (retired)'))).join('')}
   </select></label>
   <label>Badge name<input name="name" required maxlength="60"></label>
   <label>Description<textarea name="description" required maxlength="300" rows="2"></textarea></label>
   <div class="fields">
    <label>Icon<select name="icon">${icons.map(icon=>option(icon,badgeIcon(icon)+' '+badgeLabel(icon))).join('')}</select></label>
    <label>Rarity<select name="rarity">${rarities.map(rarity=>option(rarity,badgeLabel(rarity))).join('')}</select></label>
   </div>
   <p data-badge-preview></p>
   <label class="check"><input name="active" type="checkbox" checked> Available to award</label>
   ${reasonField}
   <button class="primary">Preview badge changes</button>
  </form>`;

 const editor=host.querySelector('[data-badge-edit]');
 const grant=host.querySelector('[data-badge-grant]');
 if(grant)grant.elements.badgeProfile.value=profile;
 let review=null;

 function preview(form,description,action,body){
  if(review){review.focus();return;}
  const reason=String(new FormData(form).get('reason')||'').trim();
  if(!reason){message('Enter a reason for this change.',true);return;}
  const payload={...body,reason,requestId:crypto.randomUUID(),confirmed:true};
  form.hidden=true;
  form.insertAdjacentHTML('afterend',`<section class="review" data-badge-review tabindex="-1">
   <h4>Confirm collectible badge</h4><p>${esc(description)}</p><p>Reason: ${esc(reason)}</p>
   <div class="actions"><button class="primary" data-badge-apply>Apply badge change</button>
    <button data-badge-cancel>Cancel badge change</button></div><p data-badge-error role="alert"></p>
  </section>`);
  review=host.querySelector('[data-badge-review]');
  review.focus();
  const apply=review.querySelector('[data-badge-apply]');
  const cancel=review.querySelector('[data-badge-cancel]');
  const error=review.querySelector('[data-badge-error]');
  cancel.onclick=()=>{
   review.remove();
   review=null;
   form.hidden=false;
   form.querySelector('.primary').focus();
  };
  apply.onclick=async()=>{
   if(apply.disabled)return;
   apply.disabled=true;
   cancel.disabled=true;
   error.textContent='';
   try{await request(action,payload);}
   catch(e){
    if(!host.isConnected)return;
    error.textContent=e.message;
    apply.disabled=false;
    cancel.disabled=false;
    return;
   }
   if(!host.isConnected)return;
   message(action==='badge-save'?'Collectible badge saved.':'Collectible badge awarded.');
   try{await refresh();}
   catch{message('Badge change saved. Reload the dashboard to refresh the badge list.',true);}
  };
 }

 const renderPreview=()=>{
  const name=editor.elements.name.value.trim()||'New badge';
  host.querySelector('[data-badge-preview]').textContent=
   badgeIcon(editor.elements.icon.value)+' '+name+' · '+badgeLabel(editor.elements.rarity.value);
 };
 editor.addEventListener('input',renderPreview);
 editor.elements.editBadge.addEventListener('change',()=>{
  const saved=badges.find(b=>b.id===editor.elements.editBadge.value);
  const id=saved?.id||'';
  editor.reset();
  editor.elements.editBadge.value=id;
  if(saved){
   for(const field of ['name','description','icon','rarity'])editor.elements[field].value=saved[field];
   editor.elements.active.checked=saved.active;
  }
  renderPreview();
 });
 renderPreview();
 editor.addEventListener('submit',event=>{
  event.preventDefault();
  const values=new FormData(editor);
  const saved=badges.find(b=>b.id===values.get('editBadge'));
  const badge={
   name:String(values.get('name')).trim(),description:String(values.get('description')).trim(),
   rarity:String(values.get('rarity')),icon:String(values.get('icon')),active:values.has('active'),
  };
  if(!badge.name||!badge.description){message('Enter a badge name and description.',true);return;}
  if(saved){badge.id=saved.id;badge.version=saved.version;}
  const verb=saved?'Update':'Create';
  const status=badge.active?'available to award':'retired';
  preview(editor,`${verb} ${badgeIcon(badge.icon)} ${badge.name} (${badgeLabel(badge.rarity)}, ${status}).`,'badge-save',badge);
 });
 grant?.addEventListener('submit',event=>{
  event.preventDefault();
  const values=new FormData(grant);
  const badge=active.find(b=>b.id===values.get('badgeId'));
  const identity=String(values.get('badgeProfile'));
  const chosen=recipients.filter(p=>values.getAll('badgeRecipients').includes(p.id));
  if(!badge||!chosen.length||!identities[identity]){message('Choose a badge, identity, and at least one explorer.',true);return;}
  const targets=chosen.map(p=>({account:p.id,revision:p.revision,profile:identity}));
  const description=`Award ${badgeIcon(badge.icon)} ${badge.name} to ${chosen.map(p=>p.username).join(', ')} · ${identities[identity]}.`;
  preview(grant,description,'mutate',{targets,change:{type:'badge',id:badge.id,version:badge.version}});
 });
}
