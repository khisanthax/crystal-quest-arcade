import {destinationBackdrop,adventureHost} from '../shared/adventure-host.js';
const TAU=Math.PI*2;
export function round(ctx,x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function ellipse(c,x,y,rx,ry,col){c.fillStyle=col;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();}
function poly(c,points,col){c.fillStyle=col;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
function line(c,points,col,width=3){c.strokeStyle=col;c.lineWidth=width;c.lineCap='round';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
export function crystal(c,x,y,s=1,color='#ad9cff',time=0){c.save();c.translate(x,y+Math.sin(time*3+x)*4);c.scale(s,s);ellipse(c,0,16,16,5,'#0c17363b');poly(c,[[0,-21],[12,-5],[9,13],[0,21],[-10,12],[-13,-5]],color);poly(c,[[0,-21],[2,-2],[0,21],[-10,12],[-13,-5]],'#ffffff55');line(c,[[0,-17],[2,-2],[10,-5]],'#ffffffb3',2);c.restore();}
export function explorer(c,p,time,celebrate=false){
 c.save();c.translate(p.x+p.w/2,p.y+p.h);c.scale(p.face||1,1);let stride=p.grounded?Math.sin(time*17)*Math.min(Math.abs(p.vx)/300,1):.35;let squash=p.land>0?.88:1;c.scale(1+(1-squash)*.5,squash);if(p.hurt>0&&Math.floor(time*15)%2)c.globalAlpha=.45;
 ellipse(c,0,3,22,6,'#071d4155');
 // Little boots, backpack, explorer jacket, ponytail, and brimmed hat.
 line(c,[[-7,-20],[-8+stride*9,-5]],'#3b4059',8);line(c,[[6,-20],[8-stride*9,-5]],'#3b4059',8);
 round(c,-16+stride*8,-9,15,8,4,'#f9ce7d');round(c,3-stride*8,-9,15,8,4,'#f9ce7d');
 round(c,-20,-42,16,23,6,'#d5aa71');round(c,-14,-43,29,27,9,'#57cbb3');round(c,-10,-27,23,7,2,'#338b86');
 line(c,[[-12,-37],[-19,-27+stride*7]],'#f6bb94',7);line(c,[[13,-37],[celebrate?24:19,celebrate?-61:-27-stride*7]],'#f6bb94',7);
 ellipse(c,-16,-48,9,14,'#5c3547');ellipse(c,0,-53,19,19,'#5c3547');ellipse(c,3,-51,16,16,'#f4bf96');ellipse(c,11,-52,2,3,'#343747');ellipse(c,0,-52,2,3,'#343747');line(c,[[4,-44],[8,-43],[11,-46]],'#a85b61',2);
 round(c,-20,-78,38,20,9,'#e8b96f');round(c,-26,-62,54,8,4,'#ffd986');round(c,-19,-66,36,6,2,'#9a6d4e');round(c,4,-75,7,9,2,'#89dbc6');c.restore();
}
function fern(c,x,y,s=1){c.save();c.translate(x,y);c.scale(s,s);line(c,[[0,0],[0,-57]],'#386d76',4);for(let i=0;i<5;i++){const y=-8-i*10;poly(c,[[0,y],[-31+i*3,y-14],[-15,y-20],[0,y-5]],'#64b29a');poly(c,[[0,y],[30-i*3,y-14],[16,y-20],[0,y-5]],'#88c89d');}c.restore();}
export function titleArt(c,time){
 const sky=c.createLinearGradient(0,0,0,720);sky.addColorStop(0,'#255974');sky.addColorStop(.6,'#85c8bf');sky.addColorStop(1,'#b9dcbb');c.fillStyle=sky;c.fillRect(0,0,1200,720);
 ellipse(c,965,147,68,68,'#ffdf97');ellipse(c,965,147,86,86,'#ffe9a322');
 for(let i=0;i<6;i++){const x=(i*265+time*5)%1500-120;ellipse(c,x,130+i%3*63,90,17,'#e5efce55');}
 poly(c,[[430,520],[620,305],[730,415],[890,218],[1200,510]],'#448a8c');poly(c,[[420,577],[650,390],[920,480],[1120,285],[1280,600]],'#3b787d');
 ellipse(c,825,657,440,75,'#286c7b');ellipse(c,831,616,350,86,'#a5bd85');ellipse(c,830,589,333,73,'#548c72');
 poly(c,[[603,590],[790,290],[845,266],[907,293],[1100,591]],'#795a68');poly(c,[[790,290],[845,266],[907,293],[1020,591],[850,570]],'#a3766c');poly(c,[[790,290],[827,316],[845,290],[872,322],[907,293],[845,266]],'#fdb77a');
 line(c,[[847,302],[866,366],[838,431],[887,496],[878,576]],'#f78960',24);line(c,[[847,302],[866,366],[838,431],[887,496],[878,576]],'#ffd48b',10);
 for(let i=0;i<5;i++){let q=(time*.12+i*.2)%1;ellipse(c,847+Math.sin(q*7)*40,254-q*180,18+q*22,15+q*14,`rgba(246,233,201,${.5*(1-q)})`);}
 // Friendly face on the mountain.
 ellipse(c,811,414,7,10,'#453e55');ellipse(c,909,414,7,10,'#453e55');ellipse(c,795,435,15,7,'#e8a2a17a');ellipse(c,926,435,15,7,'#e8a2a17a');line(c,[[844,439],[860,447],[878,439]],'#453e55',5);
 for(let i=0;i<9;i++)fern(c,550+i*83,602+(i%3)*18,.7+(i%3)*.18);
 poly(c,[[645,628],[717,611],[752,630],[731,654],[660,657]],'#c0a482');crystal(c,718,579,1.4,'#c3b0ff',time);crystal(c,1027,595,1.2,'#a2e7f5',time);
 explorer(c,{x:758,y:559,w:32,h:58,face:1,grounded:true,vx:0,land:0,hurt:0},time,true);
 for(let i=0;i<28;i++){let x=(i*191+time*9)%1200,y=210+((i*83)%440);ellipse(c,x,y,2,2,`rgba(255,239,170,${.35+Math.sin(time*2+i)*.3})`);}
}
function backdrop(c,index,camera,time){
 const palettes=[['#171c43','#2d4271','#3a5479'],['#422c44','#95604e','#d09b63'],['#633d64','#e48c7b','#ffdba3']];const p=palettes[index];const grad=c.createLinearGradient(0,0,0,720);grad.addColorStop(0,p[0]);grad.addColorStop(1,p[1]);c.fillStyle=grad;c.fillRect(0,0,1200,720);
 if(index<2){
  for(let i=-1;i<12;i++){let x=i*170-(camera*.18)%170;poly(c,[[x,-5],[x+170,-5],[x+95,105+(i%3)*37]],index===0?'#111a3a':'#503347');}
  for(let i=-1;i<10;i++){let x=i*220-(camera*.25)%220;round(c,x,225+(i%3)*60,170,420,70,index===0?'#344573':'#a57156');round(c,x+18,240+(i%3)*60,132,420,60,index===0?'#28365f':'#875748');}
  if(index===1){for(let i=0;i<7;i++){c.fillStyle=['#a3755d44','#d19e6b44','#632f5144'][i%3];c.fillRect(0,175+i*66,1200,35);}c.font='700 17px Trebuchet MS';c.fillStyle='#ffd18a88';c.fillText('CRUST ↑',40,180);c.fillText('MANTLE',40,280);c.fillText('toward the CORE ↓',40,380);}
 }else{
  ellipse(c,1030-camera*.03,135,55,55,'#ffe1a4');for(let i=-1;i<7;i++){let x=i*320-(camera*.15)%320;poly(c,[[x,510],[x+145,220],[x+190,225],[x+350,510]],'#9d5f73');poly(c,[[x+120,270],[x+145,220],[x+190,225],[x+214,270],[x+171,247]],'#ffbc87');}
 }
 // River below the islands, safely distant behind the touch controls.
 c.fillStyle=index===2?'#ed8053':index===1?'#f2b571':'#66c0cf';c.fillRect(0,577,1200,143);c.fillStyle=index===2?'#ffbf62':'#b6dcdb66';
 for(let i=0;i<30;i++){const x=(i*61-time*(index===2?24:12))%1250;c.fillRect(x,590+(i%5)*24,30+(i%3)*17,3);}
}
export function drawWorld(c,w,p,camera,time,effects){
 if(!destinationBackdrop(c,w.index,camera,time))backdrop(c,w.index,camera,time);c.save();c.translate(-Math.round(camera),0);
 const colors=[['#657aa4','#33476d','#99b9c8'],['#b17c60','#68495a','#efc185'],['#91697c','#513c61','#d9a1a1']][w.index];
 for(const s of w.platforms){if(s.x+s.w<camera-100||s.x>camera+1300)continue;if(s.bridge&&!w.stations.find(st=>st.id===s.bridge)?.done)continue;
  round(c,s.x,s.y,s.w,s.h,10,colors[1]);round(c,s.x,s.y,s.w,Math.min(s.h,16),7,colors[0]);c.fillStyle=colors[2];c.fillRect(s.x+10,s.y+3,s.w-20,4);
  if(s.ground){for(let x=s.x+24;x<s.x+s.w-10;x+=62){line(c,[[x,s.y+34],[x+22,s.y+49],[x+9,s.y+67]],colors[0],2);ellipse(c,x+17,s.y+105,9,5,colors[0]);}}
  if(s.moving){line(c,[[s.x+25,s.y],[s.x+25,180]],'#cdb99570',3);line(c,[[s.x+s.w-25,s.y],[s.x+s.w-25,180]],'#cdb99570',3);}
 }
 // Cave curios and plants don't obstruct jumps.
 for(let i=0;i<13;i++){const x=250+i*460;if(x<camera-100||x>camera+1300)continue;if(w.index===0){ellipse(c,x,528,18,7,'#4b618c');}else if(w.index===1){ellipse(c,x,525,21,10,'#76516a');line(c,[[x-10,525],[x+5,521],[x+13,526]],'#c7a37e',3);}else{ellipse(c,x,532,23,10,'#634264');for(let j=0;j<3;j++)ellipse(c,x+Math.sin(time+j)*9,508-((time*15+j*20)%55),5,7,'#ffe3b733');}}
 for(const item of w.crystals){if(item.taken||item.x<camera-40||item.x>camera+1240)continue;crystal(c,item.x,item.y,item.bonus?.65:.55,item.bonus?'#ffda83':w.index===0?'#b9a3ff':'#a4eddf',time);}
 for(const s of w.stations){if(s.x<camera-200||s.x>camera+1400)continue;
  if(s.type==='boss'){guardian(c,s.x+20,390,time,s.done?0:1-(w.bossCharge||0)/3);round(c,s.x-90,232,220,17,8,'#272d4c');round(c,s.x-87,235,214*(w.bossCharge||0)/3,11,6,'#a6efcf');c.fillStyle='#ffe5b0';c.font='900 15px Trebuchet MS';c.textAlign='center';c.fillText(`STABILIZER ${w.bossCharge||0} / 3`,s.x+20,219);}
  else if(s.type==='chest'){round(c,s.x-35,493,70,42,8,'#bf864f');round(c,s.x-38,s.done?473:482,76,24,8,'#efb85e');round(c,s.x-6,495,13,18,3,'#ffe49d');}
  else if(s.type==='fossil'){ellipse(c,s.x,507,36,27,'#b9aac9');c.strokeStyle='#705c83';c.lineWidth=4;c.beginPath();for(let a=0;a<18;a+=.1){const r=a*1.1;c.lineTo(s.x+Math.cos(a)*r,506+Math.sin(a)*r);}c.stroke();}
  else{round(c,s.x-28,482,56,53,9,'#6d7392');round(c,s.x-22,487,44,32,6,s.done?'#93ddb6':'#394561');crystal(c,s.x,465,.8,s.done?'#99f6bb':'#ffe18b',time);}
  if(!s.done){c.font='900 16px Trebuchet MS';c.textAlign='center';c.fillStyle='#fff2cc';c.fillText(s.name,s.x,416);c.fillStyle='#ffe6a3';c.font='24px Trebuchet MS';c.fillText('✦',s.x,385+Math.sin(time*3)*5);
   const gate=s.x+150;round(c,gate,345,55,190,9,w.index===0?'#727a9d':'#b77f72');for(let j=0;j<4;j++)line(c,[[gate+8,373+j*41],[gate+30,383+j*41],[gate+47,369+j*41]],'#e1d4be77',3);crystal(c,gate+28,330,.6,'#ffda85',time);
  }else{c.fillStyle='#bdffdb';c.font='900 20px Trebuchet MS';c.textAlign='center';c.fillText('✓',s.x,447);if(s.type==='plates'||s.type==='volcano'){const slide=s.activated?Math.max(0,1-(w.time-s.activated))*60:0;round(c,s.x+150-slide,520,90,20,5,'#9cddc5');round(c,s.x+240+slide,520,90,20,5,'#b8ead2');}if(s.type==='hammer'&&s.activated&&w.time-s.activated<5){const elapsed=w.time-s.activated;for(let i=0;i<8;i++){const x=s.x+158+i*14+elapsed*48,y=514-Math.abs(Math.sin(elapsed*3+i))*18;poly(c,[[x,y-7],[x+9,y],[x+6,y+8],[x-5,y+6]],'#b6bdd7');}c.fillStyle='#c8e9e3';c.font='700 14px Trebuchet MS';c.fillText('Weathering breaks → erosion moves',s.x+260,480);}}
 }
 for(const rock of w.rocks){ellipse(c,rock.x,rock.y,17,20,'#543c60');ellipse(c,rock.x-5,rock.y-5,7,9,'#c3938c');}
 // Checkpoint flags and exit arch.
 for(const x of [100,2250,3950,5650]){line(c,[[x,535],[x,453]],'#e7d5b9',5);poly(c,[[x,454],[x+38,465],[x,481]],x<=p.checkpoint?'#97e4bc':'#97b6ca');}
 round(c,5925,384,120,151,48,'#ead0a1');round(c,5940,398,90,137,40,'#34445d');ellipse(c,5985,461,30,43,'#a7f1c255');c.fillStyle='#ffde8a';c.font='900 15px Trebuchet MS';c.textAlign='center';c.fillText(w.index===2?'ISLAND SAVED':'NEXT CHAPTER',5985,365);
 explorer(c,p,time,p.celebrating);
 for(const e of effects){const a=e.life/e.max;c.globalAlpha=a;ellipse(c,e.x,e.y,e.size*a,e.size*a,e.color);}c.globalAlpha=1;c.restore();
}
export function guardian(c,x,y,time,instability){c.save();c.translate(x,y+Math.sin(time*2)*5);const color=['#88ad92','#96a391','#ac9693','#b67d85'][Math.round(instability*3)];poly(c,[[-106,123],[-62,-50],[-18,-73],[31,-70],[75,-39],[117,123]],color);poly(c,[[-62,-50],[-18,-73],[31,-70],[75,-39],[35,-22],[-4,-38]],'#ffd49b');ellipse(c,-34,28,7,10,'#443b58');ellipse(c,37,28,7,10,'#443b58');ellipse(c,-51,49,14,7,'#f2a6aa');ellipse(c,54,49,14,7,'#f2a6aa');line(c,[[-13,54],[3,63],[20,53]],'#443b58',5);line(c,[[-83,44],[-117,30+Math.sin(time*4)*15]],color,15);line(c,[[87,44],[116,16+Math.sin(time*4)*15]],color,15);for(let i=0;i<3;i++)crystal(c,Math.cos(time+i*2)*100,-104+Math.sin(time*2+i)*12,.55,['#beafff','#ffdf8b','#9af2df'][i],time);c.restore();}
