// Ground movement: acceleration, friction, walk/crouch, jump, collision; running steps are heard.
import { MOVE, SENSE } from './config.js';
import { bodyHeight, heldItem } from './actors.js';
import { makeNoise } from './state.js';

function maxSpeed(actor) {
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
  const target = input.crouch ? 1 : 0;
  actor.crouch += Math.sign(target - actor.crouch) * Math.min(Math.abs(target - actor.crouch), MOVE.crouchRate * dt);

  const sin = Math.sin(actor.yaw), cos = Math.cos(actor.yaw);
  let wx = -sin * input.fwd + cos * input.side;
  let wz = -cos * input.fwd - sin * input.side;
  const wl = Math.hypot(wx, wz);
  if (wl > 1) { wx /= wl; wz /= wl; }
  const top = maxSpeed(actor);

  if (actor.onGround) {
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
      makeNoise(state, 'jump', actor.pos, SENSE.hearStep, actor.squad);
    }
  } else {
    accelerate(v, wx, wz, top * Math.min(1, wl), MOVE.airAccel, dt);
  }
  v.y -= MOVE.gravity * dt;
  const wasAir = !actor.onGround;
  const fall = v.y;
  collision.moveBody(actor, dt, MOVE.radius, bodyHeight(actor));
  if (wasAir && actor.onGround && fall < -6) {
    state.events.emit('land', actor, actor.pos);
    makeNoise(state, 'land', actor.pos, SENSE.hearStep, actor.squad);
  }
  separate(state, actor);

  actor.speed = Math.hypot(v.x, v.z);
  if (actor.onGround && actor.speed > MOVE.walk + 0.3) {
    actor.stepAcc += actor.speed * dt;
    if (actor.stepAcc > MOVE.stepStride) {
      actor.stepAcc = 0;
      state.events.emit('step', actor, actor.pos);
      makeNoise(state, 'step', actor.pos, SENSE.hearStep, actor.squad);
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
