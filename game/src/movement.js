// Ground movement for every soldier: acceleration toward the wished direction, friction when the
// keys let go, walk and crouch speeds, jumping, map collision and a soft push between bodies.
// Running steps are loud (bots hear them); walking and crouching are silent.
import { MOVE, SENSE } from './config.js';
import { bodyHeight, heldItem } from './actors.js';
import { makeNoise } from './state.js';

export function maxSpeed(actor) {
  const item = heldItem(actor);
  const weight = item ? item.def.speed : 1;
  let top = actor.input.walk ? MOVE.walk : MOVE.run;
  if (actor.crouch > 0.5) top = MOVE.crouch;
  if (actor.gun.scoped) top = Math.min(top, MOVE.walk);
  return top * weight;
}

export function stepMovement(state, actor, dt, collision) {
  const input = actor.input;
  const v = actor.vel;
  // crouch eases in and out; standing back up needs headroom (the map tests that via moveBody)
  const target = input.crouch ? 1 : 0;
  actor.crouch += Math.sign(target - actor.crouch) * Math.min(Math.abs(target - actor.crouch), MOVE.crouchRate * dt);

  // wished direction in world space from the actor's yaw
  const sin = Math.sin(actor.yaw), cos = Math.cos(actor.yaw);
  let wx = -sin * input.fwd + cos * input.side;
  let wz = -cos * input.fwd - sin * input.side;
  const wl = Math.hypot(wx, wz);
  if (wl > 1) { wx /= wl; wz /= wl; }
  const top = maxSpeed(actor);

  if (actor.onGround) {
    // friction first, then acceleration capped at the top speed along the wish
    const speed = Math.hypot(v.x, v.z);
    if (speed > 0) {
      const drop = Math.max(speed, MOVE.stopSpeed) * MOVE.friction * dt;
      const scale = Math.max(0, speed - drop) / speed;
      v.x *= scale; v.z *= scale;
    }
    accelerate(v, wx, wz, top * Math.min(1, wl), MOVE.accel, dt);
    if (input.jump && actor.crouch < 0.5) {
      v.y = MOVE.jump;
      actor.onGround = false;
      makeNoise(state, 'jump', actor.pos.x, actor.pos.y, actor.pos.z, SENSE.hearStep, actor.squad);
    }
  } else {
    accelerate(v, wx, wz, top * Math.min(1, wl), MOVE.airAccel, dt);
  }
  v.y -= MOVE.gravity * dt;
  const wasAir = !actor.onGround;
  const fall = v.y;
  collision.moveBody(actor, dt, MOVE.radius, bodyHeight(actor));
  if (wasAir && actor.onGround && fall < -6) {
    const e = state.events.emit('land', actor);
    e.x = actor.pos.x; e.y = actor.pos.y; e.z = actor.pos.z;
    makeNoise(state, 'land', actor.pos.x, actor.pos.y, actor.pos.z, SENSE.hearStep, actor.squad);
  }
  separate(state, actor);

  actor.speed = Math.hypot(v.x, v.z);
  if (actor.onGround && actor.speed > MOVE.walk + 0.3) {
    actor.stepAcc += actor.speed * dt;
    if (actor.stepAcc > MOVE.stepStride) {
      actor.stepAcc = 0;
      const e = state.events.emit('step', actor);
      e.x = actor.pos.x; e.y = actor.pos.y; e.z = actor.pos.z;
      makeNoise(state, 'step', actor.pos.x, actor.pos.y, actor.pos.z, SENSE.hearStep, actor.squad);
    }
  }
}

function accelerate(v, wx, wz, wishSpeed, accel, dt) {
  const current = v.x * wx + v.z * wz;
  const add = wishSpeed - current;
  if (add <= 0) return;
  const gain = Math.min(add, accel * wishSpeed * dt);
  v.x += gain * wx;
  v.z += gain * wz;
}

function separate(state, actor) {
  const list = state.actors;
  for (let i = 0; i < list.length; i += 1) {
    const other = list[i];
    if (other === actor || !other.alive) continue;
    const dx = actor.pos.x - other.pos.x, dz = actor.pos.z - other.pos.z;
    const d2 = dx * dx + dz * dz;
    const min = MOVE.radius * 2;
    if (d2 >= min * min || d2 < 1e-6 || Math.abs(actor.pos.y - other.pos.y) > 1.5) continue;
    const d = Math.sqrt(d2);
    const push = (min - d) * 0.5;
    actor.pos.x += (dx / d) * push;
    actor.pos.z += (dz / d) * push;
  }
}
