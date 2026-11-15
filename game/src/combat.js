// Guns in the hand: timers, reloads, switching, spread and recoil, hitscan against the map and the
// hit zones, armour, kills and rewards. The same code fires for player and bots, so a bot shooting
// on the run sprays exactly as badly as a player would.
import * as THREE from 'three';
import { MOVE, SENSE, ECONOMY } from './config.js';
import { GRENADES, GRENADE_ORDER } from './weapons.js';
import { heldItem, eyeOf, rayActor, aimDirection } from './actors.js';
import { makeNoise, KILLFEED_SLOTS } from './state.js';
import { throwGrenade } from './grenades.js';

const origin = new THREE.Vector3();
const dir = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const mapHit = { t: 0, nx: 0, ny: 0, nz: 0, box: null };
const zoneHit = { t: 0, zone: '' };

/** The cone half-angle (radians) right now: base, run speed squared, air, bloom, crouch, scope. */
export function inaccuracy(actor) {
  const item = heldItem(actor);
  if (!item || item.def.kind === 'knife') return 0;
  const s = item.def.spread;
  const run = Math.max(0, Math.min(1, (actor.speed - MOVE.walk * 0.6) / (MOVE.run - MOVE.walk * 0.6)));
  const base = item.def.kind === 'marksman' && actor.gun.scoped ? s.scoped : s.base;
  const cone = base + s.move * run * run + actor.gun.bloom + (actor.onGround ? 0 : s.air);
  return actor.crouch > 0.6 && actor.onGround ? cone * s.crouch : cone;
}

const grenadeCount = (a) => a.grenades.frag + a.grenades.smoke + a.grenades.flash;

function cycleGrenade(actor) {
  let i = GRENADE_ORDER.indexOf(actor.grenadeType);
  for (let n = 0; n < 3; n += 1) {
    i = (i + 1) % 3;
    if (actor.grenades[GRENADE_ORDER[i]] > 0) { actor.grenadeType = GRENADE_ORDER[i]; return; }
  }
}

export function switchTo(actor, slot) {
  if ((slot === 'primary' && !actor.primary) || (slot === 'grenade' && !grenadeCount(actor))) return;
  if (slot === 'grenade' && actor.slot === 'grenade') cycleGrenade(actor);
  else if (slot !== actor.slot) actor.pendingSlot = slot;
}

export function stepWeapon(state, actor, dt, collision) {
  const gun = actor.gun, input = actor.input;
  gun.cooldown -= dt; gun.draw -= dt; gun.sinceShot += dt;
  if (actor.pendingSlot) {
    actor.slot = actor.pendingSlot;
    actor.pendingSlot = null;
    if (actor.slot === 'grenade' && !actor.grenades[actor.grenadeType]) cycleGrenade(actor);
    gun.draw = actor.slot === 'knife' ? 0.3 : 0.5;
    gun.reload = gun.throwing = 0; gun.scoped = false;
    state.events.emit('draw', actor);
    return;
  }
  if (actor.slot === 'grenade') { stepThrow(state, actor, dt); return; }
  const item = heldItem(actor), def = item.def;
  // recoil and bloom recover; a pause resets the spray pattern
  const k = Math.min(1, def.recoil.recover * dt);
  gun.punchPitch -= gun.punchPitch * k;
  gun.punchYaw -= gun.punchYaw * k;
  gun.bloom *= Math.exp(-dt / def.spread.recover);
  if (gun.sinceShot > def.interval * 2.5 + 0.12) gun.shots = 0;
  if (gun.reload > 0 && (gun.reload -= dt) <= 0) {
    const take = Math.min(def.mag - item.mag, item.reserve);
    item.mag += take; item.reserve -= take; gun.reload = 0;
    state.events.emit('reloaded', actor);
  }
  const canReload = def.mag > 0 && item.mag < def.mag && item.reserve > 0;
  if ((input.reload || (input.fire && item.mag === 0)) && canReload && gun.reload <= 0 && gun.draw <= 0) {
    gun.reload = def.reload; gun.scoped = false;
    state.events.emit('reload', actor).weapon = def;
  }
  if (input.fire && (def.auto || !gun.held) && gun.cooldown <= 0 && gun.draw <= 0 && gun.reload <= 0) {
    if (def.mag > 0 && item.mag <= 0) {
      if (!gun.held) state.events.emit('dry', actor);
      gun.cooldown = 0.2;
    } else fire(state, actor, item, collision);
  }
  gun.held = input.fire;
}

function stepThrow(state, actor, dt) {
  const gun = actor.gun, type = actor.grenadeType;
  if (gun.throwing > 0 && (gun.throwing -= dt) <= 0) {
    throwGrenade(state, actor, GRENADES[type], eyeOf(actor, origin), aimDirection(actor.yaw, actor.pitch + 0.08, dir));
    if (--actor.grenades[type] === 0) {
      if (grenadeCount(actor)) cycleGrenade(actor); else actor.pendingSlot = actor.primary ? 'primary' : 'secondary';
    }
    gun.draw = 0.4;
  } else if (gun.throwing <= 0 && actor.input.fire && !gun.held && gun.draw <= 0 && actor.grenades[type] > 0) {
    gun.throwing = 0.28; // pull the pin, then let go
    state.events.emit('pin', actor);
  }
  gun.held = actor.input.fire;
}

function fire(state, actor, item, collision) {
  const def = item.def, gun = actor.gun, rng = state.rng;
  if (def.mag > 0) item.mag -= 1;
  gun.cooldown = def.interval;
  gun.sinceShot = 0;
  // bullets leave along the view plus the full recoil punch (the camera shows only part of it)
  eyeOf(actor, origin);
  aimDirection(actor.yaw + gun.punchYaw, actor.pitch + gun.punchPitch, dir);
  right.crossVectors(dir, UP).normalize();
  up.crossVectors(right, dir);
  const cone = inaccuracy(actor), cx = dir.x, cy = dir.y, cz = dir.z;
  for (let p = 0; p < def.pellets; p += 1) {
    const r = cone * Math.sqrt(rng.next()) + (def.pelletCone || 0) * Math.sqrt(rng.next());
    const a = rng.next() * Math.PI * 2, ox = Math.cos(a) * r, oy = Math.sin(a) * r;
    dir.set(cx + right.x * ox + up.x * oy, cy + right.y * ox + up.y * oy, cz + right.z * ox + up.z * oy).normalize();
    trace(state, actor, def, collision, p < 3);
  }
  // the spray walks the weapon's pattern; every shot blooms the cone
  const kick = def.recoil.pattern[Math.min(gun.shots, def.recoil.pattern.length - 1)];
  gun.punchPitch += kick[0] * (0.9 + rng.next() * 0.2);
  gun.punchYaw += kick[1] + rng.signed() * kick[0] * 0.12;
  gun.shots += 1;
  gun.bloom += def.spread.bloom;
  if (def.kind === 'marksman') gun.scoped = false;
  const e = state.events.emit('fire', actor);
  e.weapon = def; e.x = origin.x; e.y = origin.y; e.z = origin.z;
  if (def.kind !== 'knife') makeNoise(state, 'gun', origin.x, origin.y, origin.z, SENSE.hearGun, actor.squad);
}

function at(e, t) { e.x = origin.x + dir.x * t; e.y = origin.y + dir.y * t; e.z = origin.z + dir.z * t; return e; }

/** One bullet: the nearest of the map and every enemy hit zone along the ray. */
function trace(state, shooter, def, collision, tracer) {
  const reach = def.reach || 120;
  const wall = collision.raycast(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, reach, mapHit);
  let best = wall, victim = null, zone = '';
  for (const other of state.actors) {
    if (!other.alive || other.squad === shooter.squad) continue;
    const t = rayActor(other, origin, dir, best, zoneHit);
    if (t >= 0 && t < best) { best = t; victim = other; zone = zoneHit.zone; }
  }
  const end = Math.min(best, reach);
  if (tracer && !def.reach) at(state.events.emit('tracer', shooter), end);
  if (victim) {
    applyDamage(state, victim, shooter, def.damage * Math.pow(def.range, end / 12), zone, def);
    at(state.events.emit('blood', victim), end).flag = zone === 'head';
  } else if (wall !== Infinity) {
    const e = at(state.events.emit('impact', shooter), wall);
    e.nx = mapHit.nx; e.ny = mapHit.ny; e.nz = mapHit.nz;
  }
}

/** Damage after hit zone and armour (a helmet guards the head). Returns the health taken. */
export function applyDamage(state, victim, attacker, amount, zone, def) {
  if (!victim.alive) return 0;
  let dmg = amount * (zone === 'head' ? def.head : zone === 'legs' ? def.legs : def.body);
  if (victim.armor > 0 && (zone === 'body' || zone === 'blast' || (zone === 'head' && victim.helmet))) {
    const through = dmg * def.pen;
    victim.armor = Math.max(0, victim.armor - (dmg - through) * 0.5);
    dmg = through;
  }
  dmg = Math.min(victim.hp, Math.round(dmg));
  victim.hp -= dmg;
  victim.lastHit = state.time;
  if (attacker && attacker.squad !== victim.squad) { attacker.stats.damage += dmg; attacker.stats.roundDamage += dmg; }
  if (attacker && victim.bot) victim.bot.hurtBy = attacker;
  const e = state.events.emit('hurt', victim);
  e.other = attacker; e.value = dmg; e.flag = zone === 'head';
  if (victim.hp <= 0) kill(state, victim, attacker, def, zone === 'head');
  return dmg;
}

function kill(state, victim, killer, def, head) {
  victim.alive = false;
  victim.stats.deaths += 1;
  // the dead lose what they carried; survivors keep it into the next round
  victim.primary = null; victim.armor = 0; victim.helmet = victim.kit = false;
  victim.grenades.frag = victim.grenades.smoke = victim.grenades.flash = 0;
  victim.slot = 'secondary'; victim.gun.scoped = false; victim.gun.reload = 0;
  if (killer && killer.squad !== victim.squad) {
    killer.stats.kills += 1; killer.stats.roundKills += 1;
    killer.money = Math.min(ECONOMY.max, killer.money + def.reward);
  }
  const c = state.charge;
  if (c.carrier === victim) { c.carrier = null; c.state = 'dropped'; c.pos.set(victim.pos.x, 0.05, victim.pos.z); }
  if (c.defuser === victim || c.planter === victim) { c.defuser = c.planter = null; c.progress = 0; }
  const k = state.killfeed[state.killHead];
  state.killHead = (state.killHead + 1) % KILLFEED_SLOTS;
  Object.assign(k, { time: state.time, killer: killer ? killer.name : 'Saltworks', killerSquad: killer ? killer.squad : victim.squad, victim: victim.name, victimSquad: victim.squad, weapon: def.name, head });
  const e = state.events.emit('kill', victim);
  e.other = killer; e.weapon = def; e.flag = head;
}
