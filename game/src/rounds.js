// The round rules: freeze and buy, the live round, planting the charge (hold E on a site), its 40 s
// fuse with a quickening beep, defusing (5 s, 3 s with a kit), and every way a round ends:
// elimination, detonation, defuse, or the clock. Then pay, crown an MVP, swap sides at the half,
// end the match at seven.
import { ROUND, ECONOMY, ROUNDS_TO_WIN, HALF_LENGTH, SENSE } from './config.js';
import { SPOTS, cellX, cellZ, siteAt } from './mapdata.js';
import { WEAPONS } from './weapons.js';
import { sideOf, squadOnSide, makeNoise } from './state.js';
import { payRound } from './economy.js';
import { planRound } from './strategy.js';
import { clearGrenades } from './grenades.js';
import { applyDamage } from './combat.js';

const BLAST = { name: 'Charge', head: 1, body: 1, legs: 1, pen: 1, reward: 0 };
const at = (e, p) => { e.x = p.x; e.y = p.y; e.z = p.z; return e; };

function stripGear(a) {
  a.primary = null; a.armor = 0; a.helmet = a.kit = false;
  a.secondary = { def: WEAPONS.tern, mag: 0, reserve: 0 };
  a.grenades.frag = a.grenades.smoke = a.grenades.flash = 0;
  a.money = ECONOMY.start;
}

export function startMatch(state) {
  const m = state.match;
  Object.assign(m, { round: 0, over: false, winner: -1 });
  m.score.fill(0); m.lossStreak.fill(0);
  m.side[0] = 'atk'; m.side[1] = 'def';
  for (const a of state.actors) { stripGear(a); a.stats.kills = a.stats.deaths = a.stats.damage = a.stats.mvps = 0; }
  for (const k of state.killfeed) k.time = -99;
  startRound(state);
}

export function startRound(state) {
  const m = state.match, r = state.round, c = state.charge;
  if (++m.round === HALF_LENGTH + 1) { // half time: swap sides, fresh economy
    m.side[0] = 'def'; m.side[1] = 'atk';
    m.lossStreak.fill(0);
    for (const a of state.actors) stripGear(a);
  }
  Object.assign(r, { phase: 'freeze', clock: ROUND.freeze, elapsed: 0, winner: -1, reason: '', mvp: null });
  clearGrenades(state);
  state.spotted.fill(-99);
  state.intel[0].time = state.intel[1].time = -99;
  const next = { atk: 0, def: 0 };
  for (const a of state.actors) {
    const side = sideOf(state, a), [col, row] = SPOTS.spawn[side][next[side]++];
    Object.assign(a, { alive: true, hp: 100, blind: 0, crouch: 0, lastHit: -9, yaw: side === 'atk' ? 0 : Math.PI, pitch: 0, pendingSlot: null });
    a.pos.set(cellX(col), 0, cellZ(row)); a.prev.copy(a.pos); a.vel.set(0, 0, 0);
    a.stats.roundKills = a.stats.roundDamage = 0;
    // survivors keep their guns; everyone starts with full magazines
    for (const item of [a.primary, a.secondary]) if (item) { item.mag = item.def.mag; item.reserve = item.def.reserve; }
    a.slot = a.primary ? 'primary' : 'secondary';
    Object.assign(a.gun, { cooldown: 0, reload: 0, draw: 0, bloom: 0, shots: 0, punchPitch: 0, punchYaw: 0, scoped: false, throwing: 0 });
    if (a.bot) { Object.assign(a.bot, { throwType: '', coverUntil: -99, mode: 'task' }); a.bot.mem.target = null; a.bot.mem.heardAt = -99; }
  }
  const atk = squadOnSide(state, 'atk'); // the charge goes to a random attacking bot
  Object.assign(c, { state: 'carried', carrier: state.rng.pick(state.actors.filter((a) => a.squad === atk && a.bot)), site: '', fuse: 0, progress: 0, planter: null, defuser: null, beep: 0 });
  planRound(state);
  state.events.emit('roundStart');
}

function alive(state, side) {
  const squad = squadOnSide(state, side);
  let n = 0;
  for (const a of state.actors) if (a.alive && a.squad === squad) n += 1;
  return n;
}

export function stepRound(state, dt) {
  const r = state.round, c = state.charge;
  if (r.phase === 'idle' || r.phase === 'over') return;
  r.clock -= dt;
  if (r.phase === 'freeze') {
    if (r.clock <= 0) { r.phase = 'live'; r.clock = ROUND.live; state.events.emit('live'); }
    return;
  }
  if (r.phase === 'post') {
    if (r.clock > 0) return;
    if (state.match.over) { r.phase = 'over'; state.events.emit('matchEnd'); } else startRound(state);
    return;
  }
  r.elapsed += dt;
  if (r.phase === 'live') {
    stepCarry(state, dt);
    if (!alive(state, 'def')) endRound(state, 'atk', 'elimination');
    else if (!alive(state, 'atk')) endRound(state, 'def', 'elimination');
    else if (r.clock <= 0) endRound(state, 'def', 'time');
    return;
  }
  // planted: the fuse runs, beeping faster as it burns down
  c.fuse -= dt;
  if ((c.beep -= dt) <= 0) {
    c.beep = Math.max(0.12, 1.1 * (c.fuse / ROUND.fuse) + 0.06);
    at(state.events.emit('beep'), c.pos);
  }
  stepDefuse(state, dt);
  if (c.state === 'defused') { endRound(state, 'def', 'defuse'); return; }
  if (c.fuse <= 0) {
    c.state = 'detonated';
    at(state.events.emit('detonate'), c.pos);
    for (const a of state.actors) {
      const d = a.pos.distanceTo(c.pos);
      if (a.alive && d < 22) applyDamage(state, a, null, 420 * (1 - d / 22) + (d < 10 ? 100 : 0), 'blast', BLAST);
    }
    endRound(state, 'atk', 'detonation');
  } else if (!alive(state, 'def')) endRound(state, 'atk', 'elimination');
}

function stepCarry(state, dt) {
  const c = state.charge;
  if (c.state === 'dropped') { // any attacker walking over it picks it up
    for (const a of state.actors) {
      if (!a.alive || sideOf(state, a) !== 'atk' || Math.hypot(a.pos.x - c.pos.x, a.pos.z - c.pos.z) > 1.2) continue;
      c.state = 'carried'; c.carrier = a;
      state.events.emit('pickup', a);
      return;
    }
    return;
  }
  const a = c.carrier;
  const site = a ? siteAt(a.pos.x, a.pos.z) : '';
  if (!(a && a.input.use && site && a.onGround && a.speed < 1)) { c.planter = null; if (!c.defuser) c.progress = 0; return; }
  if (c.planter !== a) { c.planter = a; c.progress = 0; state.events.emit('planting', a); }
  if ((c.progress += dt / ROUND.plantTime) < 1) return;
  Object.assign(c, { state: 'planted', carrier: null, site, fuse: ROUND.fuse, progress: 0, planter: null, beep: 0 });
  c.pos.set(a.pos.x, a.pos.y + 0.02, a.pos.z);
  a.money += ECONOMY.plantReward;
  state.round.phase = 'planted';
  at(state.events.emit('planted', a), c.pos);
  makeNoise(state, 'charge', c.pos.x, c.pos.y, c.pos.z, 60, a.squad);
}

function stepDefuse(state, dt) {
  const c = state.charge;
  let user = null;
  for (const a of state.actors) {
    if (a.alive && sideOf(state, a) === 'def' && a.input.use && a.speed <= 1 && Math.hypot(a.pos.x - c.pos.x, a.pos.z - c.pos.z) < 1.4 && Math.abs(a.pos.y - c.pos.y) < 1) { user = a; break; }
  }
  if (!user) { c.defuser = null; c.progress = 0; return; }
  if (c.defuser !== user) {
    c.defuser = user; c.progress = 0;
    state.events.emit('defusing', user);
    makeNoise(state, 'charge', c.pos.x, c.pos.y, c.pos.z, SENSE.hearUtility, user.squad);
  }
  if ((c.progress += dt / (user.kit ? ROUND.defuseKit : ROUND.defuse)) >= 1) {
    c.state = 'defused';
    user.money += ECONOMY.defuseReward;
    state.events.emit('defused', user);
  }
}

function endRound(state, side, reason) {
  const r = state.round, m = state.match, winner = squadOnSide(state, side);
  Object.assign(r, { phase: 'post', clock: ROUND.post, winner, reason });
  m.score[winner] += 1;
  payRound(state, winner, reason);
  // MVP: kills, then damage, plus a bonus for the defuse
  let best = -1;
  r.mvp = null;
  for (const a of state.actors) {
    const score = a.stats.roundKills * 2 + a.stats.roundDamage / 100 + (state.charge.defuser === a && reason === 'defuse' ? 3 : 0);
    if (a.squad === winner && score > best) { best = score; r.mvp = a; }
  }
  if (r.mvp) r.mvp.stats.mvps += 1;
  if (m.score[winner] >= ROUNDS_TO_WIN) { m.over = true; m.winner = winner; }
  state.events.emit('roundEnd');
}
