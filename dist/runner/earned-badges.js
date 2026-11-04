import {esc} from './parent.js';
import {badgeIcon,badgeLabel} from '../shared/badges.js';

export async function showCollectibleBadges(host, profile){
 try{
  const response=await fetch('/api/collectible-badges',{
   method:'POST',cache:'no-store',credentials:'same-origin',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({profile}),
  });
  if(!response.ok)throw Error('Could not load badges');
  const {badges}=await response.json();
  if(!Array.isArray(badges))throw Error('Could not read badges');
  if(!host.isConnected)return;
  const shelf=host.querySelector('[data-badge-shelf]');
  if(!badges.length){shelf.textContent='Your special badges will appear here.';return;}
  shelf.innerHTML=`<div class="stats">${badges.map(badge=>`<article class="stat collectible-badge">
   <span class="badge-symbol" aria-hidden="true">${badgeIcon(badge.icon)}</span>
   <strong>${esc(badge.name)}</strong>
   <small>${esc(badgeLabel(badge.rarity))}</small>
   <p>${esc(badge.description)}</p>
   ${badge.event?`<small>${esc(badge.event)}</small>`: ''}
  </article>`).join('')}</div>`;
 }catch{
  if(!host.isConnected)return;
  host.querySelector('[data-badge-shelf]').innerHTML='Could not load collectible badges. <button type="button" data-badge-retry>Try again</button>';
  host.querySelector('[data-badge-retry]').onclick=()=>{
   host.querySelector('[data-badge-shelf]').textContent='Loading collectible badges…';
   showCollectibleBadges(host,profile);
  };
 }
}
