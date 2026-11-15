// The whole match in one object. The simulation mutates it; presentation only reads it and the
// event queue. Squad 0 is the player's squad; which side (attack or defence) each squad plays
// swaps at half time.
import * as THREE from 'three';
import { SQUAD_SIZE } from './config.js';
import { createRng } from './rng.js';
import { createEventQueue } from './events.js';
import { createActor } from './actors.js';

const NAMES = [
  ['You', 'Marrow', 'Vesk', 'Oduya', 'Lintel'],
  ['Brack', 'Sorrel', 'Quill', 'Halyard', 'Tamsin'],
];
export const NOISE_SLOTS = 48;
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
    spotted: new Float32Array(actors.length), // last time each actor was seen by the other squad
    intel: [{ time: -99, x: 0, z: 0 }, { time: -99, x: 0, z: 0 }], // each squad's latest enemy contact
    events: createEventQueue(),
  };
}

export function sideOf(state, actor) {
  return state.match.side[actor.squad];
}

export function squadOnSide(state, side) {
  return state.match.side[0] === side ? 0 : 1;
}

/** Records a sound the bots can hear: gunfire, steps, utility, the charge. */
export function makeNoise(state, kind, x, y, z, radius, squad) {
  const n = state.noises[state.noiseHead];
  state.noiseHead = (state.noiseHead + 1) % NOISE_SLOTS;
  n.time = state.time; n.kind = kind; n.x = x; n.y = y; n.z = z; n.radius = radius; n.squad = squad;
}
