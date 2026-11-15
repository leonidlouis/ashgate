// Thrown utility: a fixed pool of grenades flying ballistic arcs that bounce off the map, then a
// frag blast with falloff behind cover, a smoke volume that blocks sight, or a flash that blinds by
// how squarely each soldier was looking at it.
import * as THREE from 'three';
import { SENSE } from './config.js';
import { applyDamage } from './combat.js';
import { makeNoise } from './state.js';
import { aimDirection, eyeOf } from './actors.js';

const GRAVITY = 15;
const BLAST = { name: 'Frag', head: 1, body: 1, legs: 1, pen: 0.55, reward: 300 };
const hit = { t: 0, nx: 0, ny: 0, nz: 0, box: null };
const eye = new THREE.Vector3();
const look = new THREE.Vector3();

export function initGrenades(state) {
  for (let i = 0; i < 12; i += 1) {
    state.grenades.push({ active: false, def: null, owner: null, pos: new THREE.Vector3(), prev: new THREE.Vector3(), vel: new THREE.Vector3(), fuse: 0, spin: 0 });
  }
  for (let i = 0; i < 4; i += 1) state.smokes.push({ active: false, pos: new THREE.Vector3(), radius: 0, life: 0, max: 0 });
}

export function clearGrenades(state) {
  for (const g of state.grenades) g.active = false;
  for (const s of state.smokes) s.active = false;
}

export function throwGrenade(state, actor, def, from, dir) {
  const g = state.grenades.find((item) => !item.active);
  if (!g) return;
  const power = actor.input.walk || actor.crouch > 0.5 ? 9 : 15;
  g.active = true; g.def = def; g.owner = actor; g.fuse = def.fuse; g.spin = 0;
  g.pos.copy(from).addScaledVector(dir, 0.4);
  g.prev.copy(g.pos);
  g.vel.copy(dir).multiplyScalar(power).add(actor.vel);
  const e = state.events.emit('throw', actor);
  e.weapon = def;
}

export function stepGrenades(state, dt, collision) {
  for (const g of state.grenades) {
    if (!g.active) continue;
    g.prev.copy(g.pos);
    g.vel.y -= GRAVITY * dt;
    const speed = g.vel.length();
    if (speed > 1e-4) {
      const travel = speed * dt;
      const t = collision.raycast(g.pos.x, g.pos.y, g.pos.z, g.vel.x / speed, g.vel.y / speed, g.vel.z / speed, travel + 0.06, hit);
      if (t !== Infinity) {
        g.pos.addScaledVector(g.vel, Math.max(0, t - 0.06) / speed);
        const vn = g.vel.x * hit.nx + g.vel.y * hit.ny + g.vel.z * hit.nz;
        g.vel.x -= 1.45 * vn * hit.nx; g.vel.y -= 1.45 * vn * hit.ny; g.vel.z -= 1.45 * vn * hit.nz;
        g.vel.multiplyScalar(0.7);
        if (speed > 2.5) {
          const e = state.events.emit('bounce', g.owner);
          e.x = g.pos.x; e.y = g.pos.y; e.z = g.pos.z;
          makeNoise(state, 'utility', g.pos.x, g.pos.y, g.pos.z, SENSE.hearStep, g.owner.squad);
        }
      } else {
        g.pos.addScaledVector(g.vel, dt);
      }
    }
    g.spin += speed * dt * 3;
    g.fuse -= dt;
    if (g.fuse <= 0 || (g.def.id === 'smoke' && speed < 0.4 && g.fuse < g.def.fuse - 0.5)) detonate(state, g, collision);
  }
  for (const s of state.smokes) {
    if (!s.active) continue;
    s.life -= dt;
    const age = s.max - s.life;
    s.radius = s.max === 0 ? 0 : Math.min(1, age / 1.6) * 4.6 * (s.life < 2 ? s.life / 2 : 1);
    if (s.life <= 0) s.active = false;
  }
}

function detonate(state, g, collision) {
  g.active = false;
  const p = g.pos;
  const e = state.events.emit(g.def.id, g.owner);
  e.x = p.x; e.y = p.y; e.z = p.z;
  makeNoise(state, 'utility', p.x, p.y, p.z, SENSE.hearUtility, g.owner.squad);
  if (g.def.id === 'smoke') {
    const s = state.smokes.find((item) => !item.active) ?? state.smokes[0];
    s.active = true; s.pos.set(p.x, Math.max(0.2, p.y), p.z); s.life = g.def.duration; s.max = g.def.duration; s.radius = 0;
    return;
  }
  for (const a of state.actors) {
    if (!a.alive) continue;
    eyeOf(a, eye);
    const d = eye.distanceTo(p);
    if (d > g.def.radius) continue;
    if (!collision.clearLine(p.x, p.y + 0.15, p.z, eye.x, eye.y - 0.4, eye.z)) continue;
    if (g.def.id === 'frag') {
      const dmg = g.def.damage * Math.pow(1 - d / g.def.radius, 1.4);
      if (dmg >= 1) applyDamage(state, a, g.owner.squad === a.squad && a !== g.owner ? null : g.owner, dmg, 'blast', BLAST);
    } else if (!smokeBlocks(state, p.x, p.y, p.z, eye.x, eye.y, eye.z)) {
      aimDirection(a.yaw, a.pitch, look);
      const facing = (look.x * (p.x - eye.x) + look.y * (p.y - eye.y) + look.z * (p.z - eye.z)) / Math.max(d, 0.01);
      const strength = (1 - d / g.def.radius) * (facing > 0.5 ? 1 : facing > 0 ? 0.55 : 0.18);
      const seconds = 0.4 + strength * 4.2;
      if (seconds > a.blind) { a.blind = seconds; a.blindMax = seconds; }
    }
  }
}

/** True when a smoke volume sits across the segment a-b. */
export function smokeBlocks(state, ax, ay, az, bx, by, bz) {
  for (const s of state.smokes) {
    if (!s.active || s.radius < 0.8) continue;
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len2 = dx * dx + dy * dy + dz * dz || 1e-6;
    let t = ((s.pos.x - ax) * dx + (s.pos.y + 1 - ay) * dy + (s.pos.z - az) * dz) / len2;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + dx * t - s.pos.x, qy = ay + dy * t - (s.pos.y + 1), qz = az + dz * t - s.pos.z;
    if (qx * qx + qy * qy * 2 + qz * qz < s.radius * s.radius * 0.8) return true;
  }
  return false;
}
