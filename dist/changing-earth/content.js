// This pack intentionally uses only the supplied Grade 4 review sheet.
export const VOCABULARY=[
 ['magma','Magma',"Molten rock below Earth's surface."],
 ['lava','Lava',"Magma that has reached Earth's surface."],
 ['igneous','Igneous Rock','Rock formed when magma or lava cools and hardens.'],
 ['sedimentary','Sedimentary Rock','Rock formed from sediments that build up and become rock.'],
 ['metamorphic','Metamorphic Rock','Rock changed by heat and pressure.'],
].map(([id,term,definition])=>({id,term,definition}));
export const GROUPS=[
 {id:'molten',name:'Magma & Lava',units:['magma','lava']},
 {id:'rocks',name:'Rock Types',units:['igneous','sedimentary','metamorphic']},
 {id:'minerals',name:'Minerals',units:['mineral']},
 {id:'weathering',name:'Slow Landform Changes',units:['wind','water','ice','living','temperature']},
 {id:'erosion',name:'Erosion',units:['plants']},
 {id:'desert',name:'Sand Deposition & Dunes',units:['sand']},
 {id:'rapid',name:'Rapid Earth Changes',units:['landslide']},
 {id:'crust',name:"Earth's Crust",units:['crust']},
];
export const ZONES=[
 {name:'Volcano Zone',tag:'Wake the cooling crystals',sky:'#35254e',glow:'#ffad74',ground:'#624659',icon:'🌋'},
 {name:'Rock Lab',tag:'Power the rock machines',sky:'#133c54',glow:'#85e8db',ground:'#346878',icon:'💎'},
 {name:'Weathering Canyon',tag:'Shape a rocky path',sky:'#69465c',glow:'#ffc989',ground:'#a36659',icon:'🏜️'},
 {name:'Shifting Desert',tag:'Build dunes. Protect the soil.',sky:'#60466b',glow:'#ffe295',ground:'#c99362',icon:'🌱'},
 {name:'Changing Earth Challenge',tag:'Restore the Earth Crystal',sky:'#173b51',glow:'#b3eac6',ground:'#416d68',icon:'🌍'},
];
const choices=items=>items.map(([id,label,icon])=>({id,label,icon}));
const rocks=choices([['igneous','Igneous Rock','🌋'],['sedimentary','Sedimentary Rock','▤'],['metamorphic','Metamorphic Rock','✦']]);
const molten=choices([['magma','MAGMA','🌋'],['lava','LAVA','🔥']]);
const pace=choices([['slow','SLOW CHANGE','🐢'],['rapid','RAPID CHANGE','⚡']]);
const forces=[['wind','Wind','💨'],['water','Water','💧'],['ice','Ice','🧊'],['living','Living things','🌱'],['temperature','Temperature changes','🌡️']];
const rows=[];
function add(id,zone,unit,type,prompt,options,answer,hint,visual=unit,final=false){rows.push({id,zone,concepts:[unit],type,prompt,choices:options,answer,hint,explanation:hint,visual,final});}
add('underground',0,'magma','classify','Molten rock BELOW the surface. Magma or lava?',molten,'magma','Below the surface, molten rock is called magma.','magma');
add('surface',0,'lava','classify','Molten rock reaches the surface. Magma or lava?',molten,'lava',"Lava is magma that has reached Earth's surface.",'lava');
add('cooling',0,'igneous','build','Magma or lava cools and hardens. Build its rock!',rocks,'igneous','Cooling and hardening magma or lava forms igneous rock.','igneous');
add('layers',1,'sedimentary','build','Sediments build up and become rock. Which machine?',rocks,'sedimentary','Sediments build up and become sedimentary rock.','sedimentary');
add('pressure',1,'metamorphic','build','Heat + pressure change rock. Build its rock!',rocks,'metamorphic','Heat and pressure change rock into metamorphic rock.','metamorphic');
add('mineral',1,'mineral','choice','Tap the mineral description.',choices([['crystal','A solid object that forms crystals','💎'],['molten','Molten rock below the surface','🌋'],['sediments','Sediments that become rock','▤']]),'crystal','A mineral is a solid object that forms crystals.');
for(const v of VOCABULARY)add('match-'+v.id,1,v.id,'match',v.definition,choices(VOCABULARY.map(x=>[x.id,x.term,'◆'])),v.id,v.term+': '+v.definition,v.id);
for(const [i,[id,label,icon]]of forces.entries())add('force-'+id,2,id,'attack','Which force is shaping this rock?',choices([forces[i],forces[(i+1)%5],forces[(i+2)%5]]),id,label+' can slowly change landforms and cause rocks to break.',id);
add('sand-moves',3,'sand','desert','The sandstorm moves sand. What happens next?',choices([['deposited','Sand is deposited in new locations','💨'],['magma','Sand becomes magma','🌋'],['roots','Sand becomes plant roots','🌱']]),'deposited','During a desert sandstorm, sand is deposited in new locations.','sand');
add('dune-builder',3,'sand','desert','Deposited sand builds up. What can it form?',choices([['dunes','Sand dunes','🏜️'],['lava','Lava','🔥'],['mineral','A mineral','💎']]),'dunes','Sand deposited in new locations can form sand dunes.','dune');
add('soil-defender',3,'plants','defend','Soil is blowing away. Place a defender!',choices([['plants','Plants','🌱'],['lava','Lava','🔥'],['heat','Temperature changes','🌡️']]),'plants','Plants can help prevent soil erosion. Watch the roots help hold soil in place.','plants');
for(const [id,label,icon]of [...forces,['landslide','Landslide','⛰️']])add('sort-'+id,4,id,'sort',label+': slow or rapid change?',pace,id==='landslide'?'rapid':'slow',id==='landslide'?'Landslides can change landforms rapidly.':label+' can change landforms slowly.',id);
add('changing-layer',4,'crust','choice','Which layer of Earth is always changing?',choices([['crust','Crust','🌍'],['lava','Lava','🔥'],['mineral','Mineral','💎']]),'crust',"The crust is the layer of Earth that is always changing.");
for(const v of VOCABULARY)add('review-'+v.id,4,v.id,v.id==='magma'||v.id==='lava'?'classify':'build',v.definition,v.id==='magma'||v.id==='lava'?molten:rocks,v.id,v.term+': '+v.definition,v.id,true);
add('review-mineral',4,'mineral','choice','A solid object that forms crystals is a…',choices([['mineral','Mineral','💎'],['lava','Lava','🔥'],['dune','Sand dune','🏜️']]),'mineral','A mineral is a solid object that forms crystals.','mineral',true);
for(const [id,label]of forces)add('review-'+id,4,id,'sort','Can '+label.toLowerCase()+' change landforms slowly?',pace,'slow',label+' can change landforms slowly and cause rocks to break.',id,true);
add('review-plants',4,'plants','defend','What helps prevent soil erosion?',choices([['plants','Plants','🌱'],['sand','Moving sand','💨'],['heat','Temperature change','🌡️']]),'plants','Plants can help prevent soil erosion.','plants',true);
add('review-sand',4,'sand','desert','A sandstorm deposits sand in new places. Build…',choices([['dunes','Sand dunes','🏜️'],['magma','Magma','🌋'],['lava','Lava','🔥']]),'dunes','Deposited sand can form sand dunes.','dune',true);
add('review-landslide',4,'landslide','sort','A landslide changes landforms…',pace,'rapid','Landslides can change landforms rapidly.','landslide',true);
add('review-crust',4,'crust','choice',"Earth's always-changing layer is the…",choices([['crust','Crust','🌍'],['mineral','Mineral','💎'],['magma','Magma','🌋']]),'crust',"Earth's crust is always changing.",'crust',true);
export const QUESTIONS=rows;
export const question=id=>QUESTIONS.find(q=>q.id===id);
export const FOUNDATION=ZONES.map((_,zone)=>QUESTIONS.filter(q=>q.zone===zone&&!q.final).map(q=>q.id));
