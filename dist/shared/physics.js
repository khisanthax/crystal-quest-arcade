export function createWorld(LEVELS,index,settings={}){
 const level=LEVELS[index]; const platforms=[];
 // Broad ground islands, short forgiving jumps, and optional high treasure routes.
 const gaps=[[650,780],[1850,1980],[3550,3680],[5350,5480],...level.stations.filter(s=>s.bridge).map(s=>[s.x+150,s.x+330])].sort((a,b)=>a[0]-b[0]);
 let start=0;for(const [a,b] of gaps){platforms.push({x:start,y:535,w:a-start,h:210,ground:true});start=b;}platforms.push({x:start,y:535,w:6200-start,h:210,ground:true});
 for(let i=0;i<10;i++){const x=350+i*540;platforms.push({x,y:i%2?355:425,w:190,h:24});if(i%2)platforms.push({x:x-150,y:455,w:115,h:22});}
 level.stations.forEach((s,i)=>{if(s.bridge)platforms.push({x:s.x+150,y:535,w:180,h:25,bridge:`${index}-${i}`});});
 if(index>0||settings.movingOnEarth)for(const x of [1750,3450,5250])platforms.push({x,y:450,baseY:450,w:150,h:25,moving:true,phase:x/100,dx:0,dy:0});
 const crystals=[];let id=0;
 for(let x=220;x<5950;x+=145){if(!gaps.some(([a,b])=>x>a-15&&x<b+15))crystals.push({id:id++,x,y:485});}
 platforms.filter(p=>!p.ground&&!p.moving).forEach(p=>{for(let j=0;j<3;j++)crystals.push({id:id++,x:p.x+35+j*55,y:p.y-40,bonus:j===1});});
 // Keep complete gem shapes above solid surfaces, including overlapping ledges.
 for(const gem of crystals)for(const p of platforms.filter(p=>!p.moving).sort((a,b)=>b.y-a.y)){if(gem.x+14>p.x&&gem.x-14<p.x+p.w&&gem.y+22>p.y&&gem.y-22<p.y+p.h)gem.y=p.y-40;}
 return {index,settings,width:6200,platforms,crystals,gaps,stations:level.stations.map((s,i)=>({...s,id:`${index}-${i}`,done:false})),rocks:[],time:0};
}
export function newPlayer(x=100,y=480){return {x,y,w:32,h:58,vx:0,vy:0,grounded:false,coyote:0,buffer:0,face:1,land:0,hurt:0};}
export function updatePhysics(p,world,input,dt){
 world.time+=dt;p.hurt=Math.max(0,p.hurt-dt);p.land=Math.max(0,p.land-dt);
 for(const s of world.platforms){s.dx=0;s.dy=0;if(s.moving){const old=s.y;s.y=s.baseY+Math.sin(world.time*1.2+s.phase)*65;s.dy=s.y-old;}}
 if(p.grounded&&p.riding)p.y+=p.riding.dy;
 p.powerTime=Math.max(0,(p.powerTime||0)-dt);if(p.grounded)p.airJumpUsed=false;
 p.coyote=p.grounded?.13:Math.max(0,p.coyote-dt);p.buffer=Math.max(0,p.buffer-dt);if(input.jump)p.buffer=.15;
 p.vx=((input.right?1:0)-(input.left?1:0))*(p.powerTime>0&&p.powerKind==='speed'?(world.settings?.speed||300)*2:(world.settings?.speed||300));if(p.vx)p.face=Math.sign(p.vx);
 if(p.buffer>0&&p.coyote>0){p.vy=-(world.settings?.jump||630);p.grounded=false;p.coyote=0;p.buffer=0;input.didJump=true;}
 else if(input.jump&&p.powerTime>0&&p.powerKind!=='speed'&&!p.airJumpUsed){p.vy=-(world.settings?.jump||630);p.airJumpUsed=true;p.buffer=0;input.didJump=true;input.didDoubleJump=true;}
 p.vy=Math.min(900,p.vy+(world.settings?.gravity||1600)*dt);const oldBottom=p.y+p.h;p.x=Math.max(0,Math.min(world.width-p.w,p.x+p.vx*dt));
 for(const s of world.stations){const gate=s.x+150;if(!s.done&&p.x+p.w>gate&&p.x<gate+55){p.x=gate-p.w;p.vx=0;}}
 p.y+=p.vy*dt;p.grounded=false;p.riding=null;
 for(const s of world.platforms){if(s.bridge&&!world.stations.find(st=>st.id===s.bridge)?.done)continue;if(p.x+p.w>s.x+3&&p.x<s.x+s.w-3&&p.vy>=0&&oldBottom<=s.y-s.dy+5&&p.y+p.h>=s.y){p.y=s.y-p.h;if(p.vy>120)p.land=.16;p.vy=0;p.grounded=true;p.riding=s.moving?s:null;}}
 return p.y>780;
}
