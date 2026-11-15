// A soldier as data, shared by the player and the bots, with hit zones (head sphere, torso and
// leg boxes) sized by the current crouch.
import * as THREE from 'three';
import { MOVE } from './config.js';
import { WEAPONS } from './weapons.js';
import { rayBox } from './collision.js';

export function createActor(id, squad, name, isPlayer) {
  return {
    id, squad, name, isPlayer,
    alive: false, hp: 100, armor: 0, helmet: false, kit: false, money: 0,
    pos: new THREE.Vector3(), prev: new THREE.Vector3(), vel: new THREE.Vector3(),
    yaw: 0, pitch: 0, prevYaw: 0, prevPitch: 0,
    onGround: true, crouch: 0, stepAcc: 0, speed: 0,
    input: { fwd: 0, side: 0, jump: false, crouch: false, walk: false, fire: false, reload: false, use: false },
    primary: null,
    secondary: { def: WEAPONS.tern, mag: WEAPONS.tern.mag, reserve: WEAPONS.tern.reserve },
    knife: { def: WEAPONS.hook, mag: 0, reserve: 0 },
    grenades: { frag: 0, smoke: 0, flash: 0 },
    slot: 'secondary', grenadeType: 'frag', pendingSlot: null,
    gun: { cooldown: 0, reload: 0, draw: 0, bloom: 0, shots: 0, punchPitch: 0, punchYaw: 0, sinceShot: 9, held: false, scoped: false, throwing: 0 },
    blind: 0, blindMax: 0, lastHit: -9,
    stats: { kills: 0, deaths: 0, damage: 0, roundKills: 0, roundDamage: 0, mvps: 0 },
    bot: null,
  };
}

export function heldItem(actor) {
  if (actor.slot === 'primary' && actor.primary) return actor.primary;
  if (actor.slot === 'knife') return actor.knife;
  if (actor.slot === 'grenade') return null;
  return actor.secondary;
}

export function bodyHeight(actor) {
  return MOVE.height + (MOVE.crouchHeight - MOVE.height) * actor.crouch;
}

export function eyeHeight(actor) {
  return MOVE.eye + (MOVE.crouchEye - MOVE.eye) * actor.crouch;
}

export function eyeOf(actor, out) {
  return out.set(actor.pos.x, actor.pos.y + eyeHeight(actor), actor.pos.z);
}

export function aimDirection(yaw, pitch, out) {
  const cp = Math.cos(pitch);
  return out.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
}

const zone = { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 }, face = { nx: 0, ny: 0, nz: 0 };
function zoneHit(p, half, y0, y1, o, d) {
  zone.minX = p.x - half; zone.maxX = p.x + half; zone.minY = y0; zone.maxY = y1; zone.minZ = p.z - half; zone.maxZ = p.z + half;
  const t = rayBox(zone, o.x, o.y, o.z, 1 / (d.x || 1e-9), 1 / (d.y || 1e-9), 1 / (d.z || 1e-9), Infinity, face);
  return t < 0 ? Infinity : t;
}

/** Ray against one actor's hit zones. Writes out.t and out.zone ('head' | 'body' | 'legs'); returns t or -1. */
export function rayActor(actor, o, d, maxT, out) {
  const p = actor.pos;
  const h = bodyHeight(actor);
  // cheap reject: distance from the ray to the actor's axis
  const rx = p.x - o.x, rz = p.z - o.z;
  const along = rx * d.x + rz * d.z;
  if (along < -1) return -1;
  const flat = Math.hypot(d.x, d.z) || 1e-6;
  const perp = Math.abs(rx * d.z - rz * d.x) / flat;
  if (perp > 0.8) return -1;
  let best = maxT, part = '';
  const hy = p.y + h - 0.15;
  const cx = p.x - o.x, cy = hy - o.y, cz = p.z - o.z;
  const b = cx * d.x + cy * d.y + cz * d.z;
  const disc = b * b - (cx * cx + cy * cy + cz * cz - 0.155 * 0.155);
  if (disc >= 0) { const t = b - Math.sqrt(disc); if (t > 0 && t < best) { best = t; part = 'head'; } }
  const tb = zoneHit(p, 0.25, p.y + h * 0.5, p.y + h - 0.3, o, d);
  if (tb < best) { best = tb; part = 'body'; }
  const tl = zoneHit(p, 0.2, p.y, p.y + h * 0.5, o, d);
  if (tl < best) { best = tl; part = 'legs'; }
  if (!part) return -1;
  out.t = best;
  out.zone = part;
  return best;
}
