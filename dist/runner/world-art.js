import * as T from '../vendor/three.module.min.js';
export function themedObstacle(v,o,t){const g=new T.Group(),theme=v.theme,b=(c,x,y,z,w,h,d)=>v.block(g,c,x,y,z,w,h,d),ball=(c,x,y,z,w,h,d)=>{const m=v.mesh(v.ball,c);m.position.set(x,y,z);m.scale.set(w,h,d);g.add(m);return m;};
 if(o.type==='low'){
  if(theme==='castle'){const barrel=v.mesh(v.cylinder,0xb48a61);barrel.position.y=.34;barrel.scale.set(.5,.68,.5);g.add(barrel);for(const y of [.1,.55])b(0x746b6c,0,y,0,1.02,.08,1.02);}
  else if(theme==='jungle'){ball(0x916c4d,0,.34,0,.7,.34,.45);b(0xd9b889,0,.34,.43,1,.38,.04);}
  else if(theme==='haunted'){const root=b(0x8c739d,0,.3,0,1.3,.5,.7);root.rotation.y=.15;b(0xacf2cd,.25,.56,0,.25,.18,.3);}
  else ball(theme==='frozen'?0xecf8ff:0xeea6ba,0,.34,0,.63,.34,.5);
 }else if(o.type==='high'){for(const side of [-1,1])b(t.road,side*.68,1,0,.16,2,.35);b(theme==='jungle'?0x72975d:t.edge,0,1.5,0,1.5,.62,.55);if(theme==='frozen')for(const x of [-.4,0,.4])ball(0xd8f8ff,x,1.26,0,.1,.07,.1);}
 else if(o.type==='full'){
  if(theme==='castle'){b(0x9da6bd,0,.25,0,1.1,.5,.9);b(0xaec6ce,0,1.25,0,.8,1.5,.6);ball(0xd6e4e4,0,2.65,0,.5,.45,.45);b(0xd9b66f,.5,1.4,-.3,.2,1.3,.3);}
  else if(['haunted','jungle'].includes(theme)){b(theme==='haunted'?0x897394:0x8f7156,0,1.5,0,1.2,3,.9);ball(t.edge,0,3,0,.55,.1,.45);}
  else if(theme==='underwater'){b(0x91aaa5,0,.5,0,1.3,1,1);b(0xa6bcb0,0,1.7,0,.7,1.4,.6);ball(0xc4d7c1,0,2.75,0,.5,.35,.4);}
  else ball(0xf0faff,0,1.5,0,.8,1.6,.7);
 }else{b(t.crystal,0,1,0,1.2,2,.6);for(const x of [-.4,0,.4])b(t.edge,x,1,.33,.06,1.8,.05);}
 return g;
}
export function courseArt(v,theme,stage,width,t){
 if(stage===1&&['castle','frozen','jungle'].includes(theme))for(let i=0;i<24;i++)v.block(v.world,theme==='frozen'?0xe4f7ff:0x987b63,0,-.035,-i*9,width,.045,.55);
 if(stage===1&&['underwater','frozen'].includes(theme))for(let i=0;i<5;i++){const arch=new T.Group();arch.position.z=-20-i*40;arch.userData.offset=20+i*40;const ring=v.mesh(v.ring,t.edge,.2);ring.scale.set(width*.65,5,1);ring.position.y=1;arch.add(ring);v.world.add(arch);v.scenery.push(arch);}
 if(stage===2&&!['volcano','cosmic'].includes(theme))for(let i=0;i<4;i++){const arch=new T.Group();arch.position.z=-30-i*50;arch.userData.offset=30+i*50;for(const side of [-1,1])v.block(arch,t.road,side*(width/2+1),4,0,1,8,1);v.block(arch,t.edge,0,8,0,width+3,.5,1);v.world.add(arch);v.scenery.push(arch);}
}
export function decorate(v,g,theme,i){const b=(c,x,y,z,w,h,d)=>v.block(g,c,x,y,z,w,h,d),m=(geo,c,x,y,z,sx,sy,sz,glow=0)=>{const o=v.mesh(geo,c,glow);o.position.set(x,y,z);o.scale.set(sx,sy,sz);g.add(o);return o;};
 if(theme==='jungle'){b(0x80604c,0,2.7,0,.8,5.4,.8);for(let j=0;j<3;j++)m(v.ball,0x46a772,(j-1)*1.1,5+j*.5,0,2.2,1.6,2);const vine=b(0xb5d37f,1.7,3,0,.13,4,.13);g.userData.swing=vine;if(i%5===0){m(v.ball,0xc78f63,1,1.1,-.5,.45,.5,.4);m(v.ball,0xe4c493,1,1.6,-.5,.3,.3,.3);}if(i%4===0){b(0x9aab88,-1,.7,1,1,1.4,1);b(0xc5ba91,-1,1.5,1,1.5,.3,1.5);}}
 if(theme==='underwater'){for(let j=0;j<3;j++){const c=[0xf68da6,0xc9a0ed,0xf6bd7f][j];b(c,(j-1)*.7,.8+j*.3,0,.2,1.6+j*.6,.22);b(c,(j-1)*.7+.3,1.1,0,.6,.18,.2);}for(let j=0;j<3;j++){const bubble=m(v.ball,0x99e8f3,.5+j*.5,2+j*1.2,0,.15,.15,.15,.2);bubble.userData.bubble=true;}if(i%4===0){m(v.ball,0xffd773,1,3.5,-1,.5,.25,.2);m(v.cone,0xf6b169,1.5,3.5,-1,.25,.4,.2).rotation.z=Math.PI/2;}if(i%5===0){b(0x9ab6ab,-1,1,1,.6,2,.6);b(0xc3d6be,-1,2.2,1,1,.4,1);}}
 if(theme==='castle'){b(0x9e9eb3,0,2,0,2,4,2);for(const x of [-.8,0,.8])b(0xc6c3d3,x,4.3,0,.4,.6,2.2);b(0x69769b,0,2.7,-1.03,.65,1.1,.07);if(i%3===0){b(0xd9b971,0,5.4,0,.12,2,.12);b(0xc48bba,.6,5.8,0,1.2,.65,.08);}if(i%4===0){m(v.ball,0xbacbd1,1.7,1.5,0,.35,.45,.35);b(0x8195b0,1.7,.8,0,.6,1,.4);b(0xffcf82,1.1,1,0,.35,.7,.15);}}
 if(theme==='haunted'){b(0x645575,0,2.2,0,.7,4.4,.7);const branch=b(0x645575,1,3,0,2.2,.35,.4);branch.rotation.z=.45;m(v.ball,0x71668d,0,4.7,0,1.9,1.4,1.6);for(let j=0;j<3;j++){b(0xa6e2d4,j*.6-1,.3,1,.15,.6,.15);m(v.ball,j%2?0xd5a9ed:0x8fe6b9,j*.6-1,.7,1,.5,.24,.5,.4);}if(i%3===0){const ghost=m(v.ball,0xc1eeed,1.4,2.3,0,.5,.65,.4,.3);g.userData.ghost=ghost;for(const side of [-1,1])m(v.ball,0x455d76,1.4+side*.15,2.4,.36,.06,.08,.05);}}
 if(theme==='frozen'){m(v.cone,0xc7e4f2,0,3,0,3,6,3);m(v.cone,0xffffff,0,5.1,0,1.1,2,1.1);for(let j=0;j<3;j++)m(v.gem,0x96e5ff,(j-1)*.7,.8,1,.25,1.5+j*.4,.25,.3);if(i%4===0){m(v.ball,0xecf8ff,1.5,.65,-1,.65,.65,.65);m(v.ball,0xecf8ff,1.5,1.5,-1,.45,.45,.45);m(v.cone,0xffb86c,1.5,1.5,-1.45,.08,.3,.08).rotation.x=-Math.PI/2;}}
}
