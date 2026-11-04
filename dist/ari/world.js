import {LEVELS} from './levels.js';
import {createWorld} from '../shared/physics.js';
export {LEVELS};
export {newPlayer,updatePhysics} from '../shared/physics.js';
export const makeWorld=index=>createWorld(LEVELS,index);
