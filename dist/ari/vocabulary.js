import {readSaved} from '../shared/runtime.js';
export const VOCAB = [
 ['metamorphic','METAMORPHIC ROCK','Rock formed when heat and pressure change existing rocks into different rocks.'],
 ['dating','RELATIVE DATING','When scientists use the age of one rock layer to help figure out the age of the surrounding rocks.'],
 ['lava','LAVA',"Melted rock that flows out of Earth's surface."],
 ['core','CORE','The deepest layer of Earth located in the center of the planet.'],
 ['weathering','WEATHERING','When rocks are broken down into smaller pieces by water, ice, or wind.'],
 ['erosion','EROSION','The movement of sand, soil, or rock from one place to another, often by water, ice, or wind.'],
 ['crust','CRUST','The outer layer of Earth.'],
 ['magma','MAGMA','Melted rock inside Earth.'],
 ['fossil','FOSSIL','The remains of an organism that lived a long time ago.'],
 ['mantle','MANTLE','The middle layer of Earth that is between the crust and core.'],
 ['plate','TECTONIC PLATE',"A piece of Earth's crust that can move and shift."],
 ['sedimentary','SEDIMENTARY ROCK','Rock formed from layers of sediment that get buried, pressed, and cemented together over a long time.'],
 ['sediment','SEDIMENT','Tiny pieces of rock, sand, and soil.']
].map(([id,term,definition])=>({id,term,definition}));
export const byId=id=>VOCAB.find(v=>v.id===id);
export const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const related={metamorphic:['sedimentary','sediment','fossil'], dating:['erosion','weathering','plate'],lava:['magma','mantle','core'],core:['mantle','crust','plate'],weathering:['erosion','sediment','dating'],erosion:['weathering','sedimentary','plate'],crust:['mantle','core','magma'],magma:['lava','core','mantle'],fossil:['sediment','sedimentary','metamorphic'],mantle:['core','crust','lava'],plate:['crust','mantle','core'],sedimentary:['metamorphic','sediment','fossil'],sediment:['sedimentary','metamorphic','fossil']};
export function choicesFor(id){return shuffle([id,...related[id]]).map(byId);}
export function freshProgress(){return {version:1,sound:false,stats:Object.fromEntries(VOCAB.map(v=>[v.id,{encounters:0,firstCorrect:0,incorrect:0,needsPractice:false,latest:null}])),run:null,lastResult:null};}
export function recordAnswer(stats,id,correct,attempt){const s=stats[id];if(attempt===0)s.encounters++;if(correct){if(attempt===0)s.firstCorrect++;s.needsPractice=attempt>0;s.latest=attempt===0?'First try':'With a hint';}else{s.incorrect++;s.needsPractice=true;s.latest='Keep practicing';}}
export function readProgress(storage){return readSaved(storage,'volcano-quest-v1',freshProgress,VOCAB);}

export const HINTS={
 metamorphic:'Think about a rock changing without melting.',
 dating:"Think about comparing positions in a stack that hasn't been disturbed.",
 lava:'Check whether the melted rock is below ground or has reached the surface.',
 core:'Think about the center of a ball.',
 weathering:'Is the material being broken, or carried somewhere else?',
 erosion:'Is the material being broken, or carried somewhere else?',
 crust:'Imagine the thin outside of a peach.',
 magma:'Check whether the melted rock is below ground or has reached the surface.',
 fossil:'Think about clues left by living things long ago.',
 mantle:'Think about what lies between the outside and the very center.',
 plate:"Think about Earth's outside being divided into moving pieces.",
 sedimentary:'Think about tiny pieces building up over time.',
 sediment:'Look for loose little pieces, rather than a solid rock.'
};
