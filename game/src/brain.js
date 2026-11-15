// One bot: perceive, pick a mode (engage, cover, chase, investigate, task, throw), steer, aim, shoot.
import { SENSE, DIFFICULTY } from './config.js';
import { createMemory, perceive } from './perception.js';
import { createPath } from './nav.js';
import { heldItem, eyeHeight } from './actors.js';
import { switchTo } from './combat.js';
import { sideOf } from './state.js';
import { cellX, cellZ } from './mapdata.js';

export function createBrain() {
  return {
    mem: createMemory(), path: createPath(),
    route: [], routeIndex: 0, hold: null, objective: '', plant: null, quiet: false, anchored: false, released: true,
    mode: 'task', think: 0, hasGoal: false, goalX: 0, goalZ: 0, pathX: 1e9, pathZ: 1e9, repath: 0,
    hasLook: false, lookX: 0, lookY: 0, lookZ: 0, fireOk: false, walk: false, use: false, crouch: false,
    errYaw: 0, errPitch: 0, aimHead: false, strafe: 1, strafeTime: 0, burst: 0, pause: 0, tap: false,
    coverX: 0, coverZ: 0, coverUntil: -99, stuck: 0, lastX: 0, lastZ: 0, hurtBy: null,
    throwType: '', throwX: 0, throwY: 0, throwZ: 0, throwArmed: false,
  };
}

export function assignTask(brain, cells, hold, objective, options = {}) {
  brain.route = cells.map(([c, r]) => ({ x: cellX(c), z: cellZ(r) }));
  brain.routeIndex = 0;
  brain.hold = hold && { x: cellX(hold[0][0]), z: cellZ(hold[0][1]), lx: cellX(hold[1][0]), lz: cellZ(hold[1][1]), crouch: !!hold[2] };
  brain.objective = objective || '';
  brain.quiet = !!options.quiet;
  brain.anchored = !!options.anchored;
  brain.released = !options.wait;
  brain.pathX = 1e9;
}

export function planThrow(actor, type, x, y, z) {
  Object.assign(actor.bot, { throwType: type, throwX: x, throwY: y, throwZ: z, throwArmed: false, mode: 'throw' });
}

export function stepBot(state, actor, dt, ctx) {
  const b = actor.bot, input = actor.input;
  input.fire = input.use = input.reload = input.jump = input.walk = false;
  input.fwd = input.side = 0;
  if ((b.think -= dt) <= 0) {
    b.think = SENSE.thinkInterval + state.rng.next() * 0.04;
    perceive(state, actor, b.mem, state.intel[actor.squad], ctx.collision);
    decide(state, actor, ctx);
  }
  act(state, actor, dt, ctx);
}

const goal = (b, x, z) => { b.hasGoal = true; b.goalX = x; b.goalZ = z; };
const look = (b, x, y, z) => { b.hasLook = true; b.lookX = x; b.lookY = y; b.lookZ = z; };
const dist2 = (a, x, z) => Math.hypot(x - a.pos.x, z - a.pos.z);

function decide(state, actor, ctx) {
  const b = actor.bot, mem = b.mem, t = state.time, rng = state.rng;
  const item = heldItem(actor), diff = DIFFICULTY[state.difficulty];
  b.hasGoal = b.hasLook = b.fireOk = b.crouch = b.walk = b.use = false;
  const visible = mem.target && t - mem.seenAt < 0.25;
  if (!b.throwType && actor.gun.throwing <= 0) {
    const want = actor.primary && (actor.primary.mag > 0 || actor.primary.reserve > 0) ? 'primary' : 'secondary';
    if (actor.slot !== want) switchTo(actor, want);
  }
  if (b.throwType) { b.mode = 'throw'; return; }
  if ((b.mode === 'plant' || b.mode === 'defuse') && (!visible || state.charge.progress > 0.6)) {
    objective(state, actor, ctx);
    if (b.use) return;
  }
  const dry = item && item.def.mag > 0 && item.mag === 0;
  const hurt = actor.hp < 35 && t - actor.lastHit < 2.5;
  if (visible && !(dry && actor.gun.reload > 0) && !(hurt && b.coverUntil < t - 3)) {
    b.mode = 'engage';
    const target = mem.target, d = actor.pos.distanceTo(target.pos);
    if (t - mem.noticedAt < 0.05) { // fresh contact: start off-aim, track it out
      const k = diff.aimError * (1 + 12 / Math.max(4, d));
      b.errYaw = rng.signed() * k; b.errPitch = rng.signed() * k * 0.6;
      b.aimHead = rng.chance(diff.headChance);
    }
    const h = target.crouch > 0.5 ? 1.15 : 1.65, kind = item ? item.def.kind : '';
    look(b, target.pos.x, target.pos.y + (b.aimHead ? h : h * 0.72), target.pos.z);
    b.fireOk = t - mem.noticedAt > diff.reaction + (actor.blind > 0 ? 0.5 : 0);
    b.crouch = d > 18 && kind === 'rifle' && actor.id % 2 === 0;
    if (kind === 'marksman') actor.gun.scoped = true;
    return;
  }
  if ((dry || hurt) && t > b.coverUntil && (mem.target || t - actor.lastHit < 2) && findCover(actor, ctx)) b.coverUntil = t + 3.5;
  const recent = mem.target && t - mem.seenAt < SENSE.memory, heard = t - mem.heardAt < 3;
  if (t < b.coverUntil) {
    b.mode = 'cover';
    goal(b, b.coverX, b.coverZ);
    if (mem.target) look(b, mem.lastX, mem.lastY + 1.5, mem.lastZ);
  } else if ((recent || heard) && !urgent(state, actor)) {
    b.mode = recent ? 'chase' : 'investigate';
    const x = recent ? mem.lastX : mem.heardX, z = recent ? mem.lastZ : mem.heardZ, d = dist2(actor, x, z);
    look(b, x, recent ? mem.lastY + 1.5 : 1.5, z);
    if (recent && actor.grenades.frag > 0 && d > 9 && d < 26 && t - mem.seenAt > 0.8 && rng.chance(0.08)) planThrow(actor, 'frag', x, mem.lastY + 0.5, z);
    else if (!b.anchored && (recent || (mem.heardKind !== 'gun' && d < 22))) goal(b, x, z);
    b.walk = true;
  } else objective(state, actor, ctx);
}

function urgent(state, actor) {
  const c = state.charge;
  return sideOf(state, actor) === 'def' ? c.state === 'planted' && c.fuse < 12 : c.carrier === actor && state.round.clock < 25;
}

function objective(state, actor, ctx) {
  const b = actor.bot, c = state.charge, side = sideOf(state, actor);
  b.mode = 'task';
  if (side === 'def' && c.state === 'planted' && b.objective === 'defuse') {
    if (dist2(actor, c.pos.x, c.pos.z) < 1.1) { b.mode = 'defuse'; b.use = b.crouch = true; } else goal(b, c.pos.x, c.pos.z);
    return;
  }
  if (side === 'atk' && c.state === 'dropped' && b.objective === 'fetch') { goal(b, c.pos.x, c.pos.z); return; }
  if (side === 'atk' && c.carrier === actor && b.objective === 'plant' && b.plant && b.routeIndex >= b.route.length) {
    if (dist2(actor, b.plant.x, b.plant.z) < 1.2 && ctx.siteAt(actor.pos.x, actor.pos.z)) { b.mode = 'plant'; b.use = b.crouch = true; } else goal(b, b.plant.x, b.plant.z);
    return;
  }
  if (b.routeIndex < b.route.length) {
    const pt = b.route[b.routeIndex], last = b.routeIndex === b.route.length - 1;
    if (dist2(actor, pt.x, pt.z) >= (last ? 1.2 : 2.6)) { goal(b, pt.x, pt.z); b.walk = b.quiet; return; }
    if (last && !b.released) { // staged at a lane mouth for the execute
      if (b.hold) look(b, b.hold.lx, 1.6, b.hold.lz); else look(b, pt.x, 1.6, pt.z - 12);
      return;
    }
    b.routeIndex += 1;
  }
  const h = b.hold;
  if (!h) return;
  if (dist2(actor, h.x, h.z) > 0.8) { goal(b, h.x, h.z); b.walk = b.quiet; }
  look(b, h.lx, 1.5, h.lz);
  b.crouch = h.crouch;
}

function findCover(actor, ctx) {
  const b = actor.bot, mem = b.mem, from = mem.target ? null : b.hurtBy;
  const tx = from ? from.pos.x : mem.lastX, tz = from ? from.pos.z : mem.lastZ;
  const c0 = Math.floor(actor.pos.x / 2 + 24), r0 = Math.floor(actor.pos.z / 2 + 22);
  let best = Infinity;
  for (let dr = -4; dr <= 4; dr += 1) for (let dc = -4; dc <= 4; dc += 1) {
    const x = cellX(c0 + dc), z = cellZ(r0 + dr);
    if (!ctx.nav.open(c0 + dc, r0 + dr) || ctx.collision.clearLine(tx, 1.5, tz, x, 1.4, z)) continue;
    const d = dist2(actor, x, z) + Math.max(0, 10 - Math.hypot(x - tx, z - tz)) * 0.5;
    if (d < best) { best = d; b.coverX = x; b.coverZ = z; }
  }
  return best < Infinity;
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clampTurn = (v, max) => Math.max(-max, Math.min(max, v));

function act(state, actor, dt, ctx) {
  const b = actor.bot, input = actor.input, diff = DIFFICULTY[state.difficulty], item = heldItem(actor);
  if (b.mode === 'cover' && actor.gun.reload <= 0 && item && item.mag < item.def.mag && item.reserve > 0) input.reload = true;
  input.walk = b.walk;
  input.use = b.use;
  let mx = 0, mz = 0;
  if (b.hasGoal && b.mode !== 'engage') {
    b.repath -= dt;
    if (Math.hypot(b.goalX - b.pathX, b.goalZ - b.pathZ) > 1.5 || b.repath <= 0) {
      ctx.nav.findPath(actor.pos.x, actor.pos.z, b.goalX, b.goalZ, b.path);
      b.pathX = b.goalX; b.pathZ = b.goalZ; b.repath = 2.5;
    }
    const path = b.path;
    while (path.index < path.count && dist2(actor, path.points[path.index].x, path.points[path.index].z) < (path.index === path.count - 1 ? 0.35 : 0.9)) path.index += 1;
    if (path.index < path.count) {
      const p = path.points[path.index], l = dist2(actor, p.x, p.z) || 1;
      mx = (p.x - actor.pos.x) / l; mz = (p.z - actor.pos.z) / l;
    }
  }
  if (b.mode === 'engage') {
    if ((b.strafeTime -= dt) <= 0) { b.strafe = state.rng.chance(0.5) ? 1 : -1; b.strafeTime = 0.35 + state.rng.next() * 0.6; }
    if (b.pause > 0 && !b.crouch) { mx = Math.cos(actor.yaw) * b.strafe; mz = -Math.sin(actor.yaw) * b.strafe; }
  }
  let wantYaw = actor.yaw, wantPitch = 0;
  const throwing = b.mode === 'throw', ey = actor.pos.y + eyeHeight(actor);
  if (throwing || b.hasLook) {
    const x = throwing ? b.throwX : b.lookX, z = throwing ? b.throwZ : b.lookZ, flat = dist2(actor, x, z);
    wantYaw = Math.atan2(actor.pos.x - x, actor.pos.z - z);
    wantPitch = throwing ? lobPitch(flat, b.throwY - ey) : Math.atan2(b.lookY - ey, flat);
  } else if (mx || mz) wantYaw = Math.atan2(-mx, -mz);
  if (b.mode === 'engage') {
    const k = Math.exp(-dt * 2.2); // tracking error shrinks while the target stays in sight
    b.errYaw *= k; b.errPitch *= k;
    wantYaw += b.errYaw + Math.sin(state.time * 7 + actor.id) * diff.aimError * 0.15;
    wantPitch += b.errPitch;
  }
  const turn = diff.turn * dt * (b.mode === 'engage' ? 1 : 0.6), dy = wrap(wantYaw - actor.yaw);
  actor.yaw = wrap(actor.yaw + clampTurn(dy, turn));
  actor.pitch += clampTurn(wantPitch - actor.pitch, turn);
  const aimOff = Math.abs(dy) + Math.abs(wantPitch - actor.pitch);
  const s = Math.sin(actor.yaw), c = Math.cos(actor.yaw);
  input.fwd = -s * mx - c * mz;
  input.side = c * mx - s * mz;
  input.crouch = b.crouch;
  if (b.mode === 'engage') shoot(state, actor, dt, aimOff, diff, item); else b.burst = 0;
  if (throwing) throwStep(actor, aimOff);
  if (b.hasGoal && (mx || mz) && (b.stuck += dt) > 1) {
    if (dist2(actor, b.lastX, b.lastZ) < 0.4) { input.jump = true; b.repath = 0; }
    b.stuck = 0; b.lastX = actor.pos.x; b.lastZ = actor.pos.z;
  }
}

function shoot(state, actor, dt, aimOff, diff, item) {
  const b = actor.bot;
  if (!item || !b.fireOk) return;
  if (b.pause > 0) { b.pause -= dt; return; }
  const d = b.mem.target ? actor.pos.distanceTo(b.mem.target.pos) : 20;
  if (aimOff > 0.05 + 0.6 / Math.max(d, 1)) return;
  if (actor.speed > 2.2 && item.def.kind !== 'shotgun' && item.def.kind !== 'smg') return;
  actor.input.fire = item.def.auto || (b.tap = !b.tap);
  if (actor.gun.sinceShot === 0 && (b.burst += 1) >= (d > 20 ? 2 : diff.burst)) {
    b.burst = 0;
    b.pause = 0.18 + state.rng.next() * (d > 20 ? 0.45 : 0.25);
  }
}

function throwStep(actor, aimOff) {
  const b = actor.bot, input = actor.input;
  input.walk = input.crouch = false;
  if (actor.slot !== 'grenade' || actor.grenadeType !== b.throwType) {
    if (actor.grenades[b.throwType] <= 0) { b.throwType = ''; return; }
    actor.grenadeType = b.throwType;
    if (actor.slot !== 'grenade') switchTo(actor, 'grenade');
  } else if (actor.gun.throwing > 0) return;
  else if (b.throwArmed) { b.throwType = ''; b.throwArmed = false; } else if (aimOff < 0.05 && actor.gun.draw <= 0) { input.fire = true; b.throwArmed = true; }
}

function lobPitch(d, h) {
  const v2 = 225, g = 15, disc = v2 * v2 - g * (g * d * d + 2 * h * v2);
  return disc < 0 ? 0.6 : Math.atan((v2 - Math.sqrt(disc)) / (g * d)) - 0.08;
}
