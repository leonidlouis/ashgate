// What a soldier knows: enemies in the view cone with clear sight of head or chest (walls, smoke,
// flashes count) and the nearest enemy sound in earshot; sightings feed squad intel and the radar.
import * as THREE from 'three';
import { SENSE } from './config.js';
import { eyeOf, bodyHeight } from './actors.js';
import { smokeBlocks } from './grenades.js';

const eye = new THREE.Vector3();

export function createMemory() {
  return { target: null, seenAt: -99, noticedAt: -99, lastX: 0, lastY: 0, lastZ: 0, heardAt: -99, heardX: 0, heardZ: 0, heardKind: '', checkedNoise: -99 };
}

function canSee(state, viewer, other, collision) {
  if (viewer.blind > 0.6) return false;
  eyeOf(viewer, eye);
  const dx = other.pos.x - eye.x, dz = other.pos.z - eye.z, dist = Math.hypot(dx, dz);
  if (dist > 90 || (dist > SENSE.nearAware && (-Math.sin(viewer.yaw) * dx - Math.cos(viewer.yaw) * dz) / dist < SENSE.fov)) return false;
  const h = bodyHeight(other);
  return sightTo(state, other, other.pos.y + h - 0.15, collision) || sightTo(state, other, other.pos.y + h * 0.6, collision);
}

const sightTo = (state, o, y, collision) => collision.clearLine(eye.x, eye.y, eye.z, o.pos.x, y, o.pos.z) && !smokeBlocks(state, eye.x, eye.y, eye.z, o.pos.x, y, o.pos.z);

export function perceive(state, actor, memory, intel, collision) {
  let best = null, bestScore = Infinity;
  for (const other of state.actors) {
    if (!other.alive || other.squad === actor.squad || !canSee(state, actor, other, collision)) continue;
    state.spotted[other.id] = state.time;
    const score = actor.pos.distanceToSquared(other.pos) * (other === memory.target ? 0.6 : 1); // stick with the current target
    if (score < bestScore) { bestScore = score; best = other; }
  }
  if (best) {
    if (memory.target !== best || state.time - memory.seenAt > 1.2) memory.noticedAt = state.time; // the reaction clock starts
    memory.target = best;
    memory.seenAt = intel.time = state.time;
    memory.lastX = intel.x = best.pos.x; memory.lastY = best.pos.y; memory.lastZ = intel.z = best.pos.z;
  } else if (memory.target && (!memory.target.alive || state.time - memory.seenAt > SENSE.memory)) memory.target = null;
  let heard = Infinity;
  for (const n of state.noises) {
    if (n.time <= memory.checkedNoise || n.squad === actor.squad || n.squad < 0) continue;
    const d = Math.hypot(n.x - actor.pos.x, n.z - actor.pos.z);
    if (d > n.radius || d > heard) continue;
    heard = d;
    memory.heardAt = n.time; memory.heardX = n.x; memory.heardZ = n.z; memory.heardKind = n.kind;
  }
  memory.checkedNoise = state.time;
  return best;
}
