import {LEVELS} from './science.js';
import {createWorld} from '../shared/physics.js';
export {newPlayer,updatePhysics} from '../shared/physics.js';
export const makeWorld=index=>createWorld(LEVELS,index,{speed:280,jump:index===1?510:630,gravity:index===1?900:1600,movingOnEarth:true});
