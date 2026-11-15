// Screenshot staging: a seeded real match, fast-forwarded through the real sim to a staged moment
// with your seat on autopilot, then frozen. Loaded only with ?shot=.
import { createBrain, assignTask } from './brain.js';
import { startRound } from './rounds.js';
import { buy } from './economy.js';
import { HALF_LENGTH } from './config.js';
import { cellX, cellZ } from './mapdata.js';

const item = (type, id) => ({ type, id });
const RIFLE = item('weapon', 'kestrel'), HELMET = item('gear', 'helmet'), FRAG = item('grenade', 'frag'), KIT = item('gear', 'kit');

function stageRound(state, round, score, money) {
  const m = state.match, second = round > HALF_LENGTH;
  m.round = round - 1; m.score[0] = score[0]; m.score[1] = score[1];
  m.side[0] = second ? 'def' : 'atk'; m.side[1] = second ? 'atk' : 'def';
  for (const a of state.actors) a.money = money;
  startRound(state);
}

function place(actor, c, r, yaw) {
  actor.pos.set(cellX(c), 0, cellZ(r));
  actor.prev.copy(actor.pos);
  actor.vel.set(0, 0, 0);
  actor.yaw = actor.prevYaw = yaw;
  if (actor.bot) { actor.bot.mem.target = null; actor.bot.path.count = 0; actor.bot.pathX = 1e9; }
}

/** Places the living: yours on `mine` spots, theirs on `theirs`; task(actor, spot, i, friendly) plans each. */
function deploy(state, mine, theirs, task) {
  let f = 0, e = 0;
  for (const a of state.actors) {
    if (a.isPlayer || !a.alive) continue;
    const friendly = a.squad === state.player.squad, i = friendly ? f++ : e++;
    const spot = (friendly ? mine : theirs)[i];
    place(a, spot[0], spot[1], friendly === (state.match.side[state.player.squad] === 'atk') ? 0 : Math.PI);
    task(a, spot, i, friendly);
  }
}

function runUntil(api, test, limit) {
  for (let i = 0; i < limit; i += 1) {
    api.step();
    if (test()) return;
    if (i % 6 === 0) api.drain();
  }
}

const SCENES = {
  // first round of the second buy: an opening played out, then a firefight down the Brine Channel
  play(api) {
    const { state } = api, me = state.player;
    me.bot = createBrain();
    stageRound(state, 4, [2, 1], 5200);
    for (const it of [RIFLE, HELMET, FRAG]) buy(state, me, it);
    runUntil(api, () => state.round.phase === 'live', 60 * 12);
    runUntil(api, () => state.killfeed.filter((k) => k.time > 0).length >= 2, 60 * 60);
    place(me, 22.5, 31, 0);
    deploy(state, [[25.5, 30], [21, 33], [26, 34], [22, 36]], [[24.6, 26.2], [21.6, 23.5], [25.8, 21], [22, 12], [25, 9]], (a, s, i, friendly) => (friendly
      ? assignTask(a.bot, [[s[0], s[1] - 4]], null, '')
      : assignTask(a.bot, [[s[0], s[1] + 1]], [s, [23, 31], i === 1], '')));
    assignTask(me.bot, [], [[22.5, 31], [23.5, 22]], '');
    let fired = 0;
    runUntil(api, () => {
      if (me.gun.sinceShot === 0) fired += 1;
      const t = me.bot.mem.target;
      return me.alive && fired >= 3 && t && t.alive && state.time - me.bot.mem.seenAt < 0.05 && me.gun.sinceShot === 0;
    }, 60 * 12);
  },
  // freeze time in the Cinder yard with the buy menu open
  buy(api) {
    const { state } = api, me = state.player;
    stageRound(state, 3, [1, 1], 4350);
    buy(state, me, HELMET);
    runUntil(api, () => state.round.clock < 6, 60 * 8);
    me.yaw = 0.12; me.pitch = 0.02;
    api.screens.setBuy(true);
    api.screens.update(5);
  },
  // second half, defending: the charge goes down in Pump Hall, the squad retakes, you defuse
  site(api) {
    const { state } = api, me = state.player, c = state.charge;
    me.bot = createBrain();
    stageRound(state, 8, [4, 3], 5200);
    for (const it of [RIFLE, HELMET, KIT]) buy(state, me, it);
    runUntil(api, () => state.round.phase === 'live', 60 * 12);
    const carrier = c.carrier;
    place(me, 24, 1, 0);
    deploy(state, [[24, 21], [30, 19], [22, 16], [26, 24]], [[44, 12], [35, 8], [45, 3], [33, 13], [40, 6]], (a, s, i, friendly) => {
      if (friendly) assignTask(a.bot, [], [s, [33, 16]], '');
      else if (a === carrier) { place(a, 40, 6, Math.PI); assignTask(a.bot, [], null, 'plant'); a.bot.plant = { x: a.pos.x, z: a.pos.z }; } else assignTask(a.bot, [], [s, [33, 16], true], '', { anchored: true });
    });
    assignTask(me.bot, [], [[24, 1], [26, 5]], '');
    runUntil(api, () => state.round.phase === 'planted', 60 * 10);
    state.round.plan.retake = true;
    const entries = [[33, 16], [41, 16], [31, 4], [42, 17]];
    state.actors.filter((a) => a.squad === me.squad && a !== me && a.alive).forEach((a, i) => assignTask(a.bot, [entries[i]], [[39, 9], [40, 6]], ''));
    runUntil(api, () => false, 60 * 4);
    assignTask(me.bot, [], null, 'defuse');
    runUntil(api, () => c.defuser === me && c.progress > 0.55, 60 * 30);
    me.pitch = -0.5;
    me.yaw = Math.atan2(me.pos.x - c.pos.x, me.pos.z - c.pos.z);
  },
  // a whole match played bot against bot, your seat on autopilot, to the final summary
  end(api) {
    api.state.player.bot = createBrain();
    runUntil(api, () => api.state.round.phase === 'over', 60 * 60 * 45);
    api.screens.showEnd();
  },
};

export function runShot(name, api) {
  (SCENES[name] || SCENES.play)(api);
  let painted = 0;
  const paint = () => {
    api.present(0.001, { x: 0, y: 0 });
    if (++painted < 3) requestAnimationFrame(paint); else window.__shotReady = true;
  };
  requestAnimationFrame(paint);
}
