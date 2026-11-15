// One fixed 60 Hz tick in a fixed order: minds, bodies, guns, grenades, rules, plans. No DOM, no
// renderer, no wall clock: a seed plus inputs replays a match exactly.
import { TICK } from './config.js';
import { stepBot } from './brain.js';
import { stepMovement } from './movement.js';
import { stepWeapon } from './combat.js';
import { stepGrenades } from './grenades.js';
import { stepRound } from './rounds.js';
import { stepStrategy } from './strategy.js';

export function stepSim(state, ctx) {
  const dt = TICK;
  state.time += dt;
  state.tick += 1;
  const frozen = state.round.phase === 'freeze';
  for (const a of state.actors) {
    a.prev.copy(a.pos);
    a.prevYaw = a.yaw; a.prevPitch = a.pitch;
    if (!a.alive) continue;
    if (a.bot) stepBot(state, a, dt, ctx);
    if (frozen) { a.input.fwd = 0; a.input.side = 0; a.input.jump = false; a.input.fire = false; }
    stepMovement(state, a, dt, ctx.collision);
    if (a.blind > 0) a.blind = Math.max(0, a.blind - dt);
    stepWeapon(state, a, dt, ctx.collision);
  }
  stepGrenades(state, dt, ctx.collision);
  stepRound(state, dt);
  if (state.tick % 30 === 0) stepStrategy(state);
}
