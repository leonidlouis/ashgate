// The whole match in one object; the sim mutates it, presentation reads it. Squad 0 is yours; the
// side each squad plays swaps at half time.
import * as THREE from 'three';
import { SQUAD_SIZE } from './config.js';
import { createRng } from './rng.js';
import { createEventQueue } from './events.js';
import { createActor } from './actors.js';

const NAMES = [
  ['You', 'Marrow', 'Vesk', 'Oduya', 'Lintel'],
  ['Brack', 'Sorrel', 'Quill', 'Halyard', 'Tamsin'],
];
const NOISE_SLOTS = 48;
export const KILLFEED_SLOTS = 5;

export function createState(seed, difficulty) {
  const actors = [];
  for (let squad = 0; squad < 2; squad += 1)
    for (let i = 0; i < SQUAD_SIZE; i += 1) actors.push(createActor(actors.length, squad, NAMES[squad][i], squad === 0 && i === 0));
  const noises = [];
  for (let i = 0; i < NOISE_SLOTS; i += 1) noises.push({ time: -99, x: 0, y: 0, z: 0, radius: 0, squad: -1, kind: '' });
  const killfeed = [];
  for (let i = 0; i < KILLFEED_SLOTS; i += 1) killfeed.push({ time: -99, killer: '', killerSquad: 0, victim: '', victimSquad: 0, weapon: '', head: false });
  return {
    seed,
    rng: createRng(seed),
    difficulty,
    time: 0,
    tick: 0,
    paused: false,
    match: { round: 0, score: [0, 0], side: ['atk', 'def'], lossStreak: [0, 0], over: false, winner: -1 },
    round: { phase: 'idle', clock: 0, elapsed: 0, winner: -1, reason: '', mvp: null, plan: null },
    charge: {
      state: 'carried', carrier: null, pos: new THREE.Vector3(), site: '', fuse: 0, beep: 0,
      planter: null, defuser: null, progress: 0,
    },
    actors,
    player: actors[0],
    grenades: [],
    smokes: [],
    noises,
    noiseHead: 0,
    killfeed,
    killHead: 0,
    spotted: new Float32Array(actors.length), // when each actor was last seen by enemies
    intel: [{ time: -99, x: 0, z: 0 }, { time: -99, x: 0, z: 0 }], // each squad's last contact
    events: createEventQueue(),
  };
}

export function sideOf(state, actor) {
  return state.match.side[actor.squad];
}

export function squadOnSide(state, side) {
  return state.match.side[0] === side ? 0 : 1;
}

export function makeNoise(state, kind, p, radius, squad) {
  const n = state.noises[state.noiseHead];
  state.noiseHead = (state.noiseHead + 1) % NOISE_SLOTS;
  n.time = state.time; n.kind = kind; n.x = p.x; n.y = p.y; n.z = p.z; n.radius = radius; n.squad = squad;
}
