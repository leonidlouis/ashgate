// The squad leaders. At round start attackers pick a site and a style (rush one lane, split two,
// or a slow default that stages at the lane mouths and executes late) and defenders spread over
// anchor holds on both sites and mid. During the round: execute on contact, rotate defenders to
// where attackers were seen, fetch a dropped charge, crossfire after the plant, retake and defuse.
import { SPOTS, cellX, cellZ } from './mapdata.js';
import { assignTask, planThrow } from './brain.js';
import { squadOnSide } from './state.js';
import { botBuy } from './economy.js';

const LANES = { A: ['long', 'short', 'under'], B: ['east', 'pipe'] };
const bots = (state, squad) => state.actors.filter((a) => a.squad === squad && a.alive && a.bot);
const nearest = (list, p) => list.reduce((best, a) => (!best || a.pos.distanceToSquared(p) < best.pos.distanceToSquared(p) ? a : best), null);
const siteDistance = (x, z, site) => Math.hypot(x - cellX(site.center[0]), z - cellZ(site.center[1]));

export function planRound(state) {
  const rng = state.rng, atk = squadOnSide(state, 'atk');
  for (let squad = 0; squad < 2; squad += 1) {
    const list = bots(state, squad);
    const bank = list.reduce((sum, a) => sum + a.money, 0) / Math.max(1, list.length);
    const pistolRound = state.match.round === 1 || state.match.round === 7;
    for (const a of list) botBuy(state, a, !pistolRound && bank < 2000); // a thin bank saves together
  }
  const site = rng.chance(0.5) ? 'A' : 'B';
  const style = rng.pick(['rush', 'default', 'default', 'split']);
  const plan = state.round.plan = { site, style, released: style === 'rush', rotatedTo: '', postPlant: false, retake: false, executeAt: 62 + rng.next() * 25 };
  const lanes = LANES[site], rushLane = rng.pick(lanes);
  bots(state, atk).forEach((a, i) => {
    const carrier = state.charge.carrier === a;
    assignTask(a.bot, SPOTS.routes[site][style === 'rush' ? rushLane : lanes[i % lanes.length]], [SPOTS.sites[site].post[i % 4], SPOTS.sites[site].center], carrier ? 'plant' : '', { wait: !plan.released });
    if (carrier) setPlant(state, a, site);
  });
  // defenders: anchors drawn from the hold spots, two on one site, one on the other, one mid, one spare
  const holds = [];
  const draw = (list, n) => { const copy = list.slice(); for (let i = 0; i < n; i += 1) holds.push(copy.splice(rng.int(copy.length), 1)[0]); };
  const heavy = rng.chance(0.5) ? 'A' : 'B', light = heavy === 'A' ? 'B' : 'A';
  draw(SPOTS.sites[heavy].holds, 2); draw(SPOTS.sites[light].holds, 1); draw(SPOTS.mid, 1); draw(SPOTS.sites[light].holds, 1);
  bots(state, 1 - atk).forEach((a, i) => assignTask(a.bot, [], [holds[i][0], holds[i][1], i % 2 === 0], '', { anchored: true, quiet: i % 3 === 0 }));
}

function setPlant(state, actor, site) {
  const p = state.rng.pick(SPOTS.sites[site].plant);
  actor.bot.plant = { x: cellX(p[0]), z: cellZ(p[1]) };
}

/** Twice a second during the live round. */
export function stepStrategy(state) {
  const plan = state.round.plan, c = state.charge;
  if (!plan || state.round.phase === 'freeze' || state.round.phase === 'idle') return;
  const atk = squadOnSide(state, 'atk'), def = 1 - atk;
  const attackers = bots(state, atk), defenders = bots(state, def);
  const site = SPOTS.sites[plan.site];

  // attackers execute on the clock, on first contact, or when the round runs late; one smokes a hold
  if (!plan.released && (state.round.clock < plan.executeAt || state.time - state.intel[atk].time < 1.5 || state.round.clock < 40)) {
    plan.released = true;
    for (const a of attackers) a.bot.released = true;
    const smoker = attackers.find((a) => a.grenades.smoke > 0);
    const hold = state.rng.pick(site.holds)[0];
    if (smoker) planThrow(smoker, 'smoke', cellX(hold[0]), 0.3, cellZ(hold[1]));
  }
  if (c.state === 'dropped') {
    const runner = nearest(attackers, c.pos);
    if (runner && runner.bot.objective !== 'fetch') { runner.bot.objective = 'fetch'; runner.bot.route.length = 0; }
  }
  if (c.state === 'carried' && c.carrier && c.carrier.bot && c.carrier.bot.objective !== 'plant') {
    assignTask(c.carrier.bot, [], null, 'plant');
    setPlant(state, c.carrier, plan.site);
  }
  if (c.state !== 'planted') {
    // defenders rotate toward a site once attackers are seen near it
    const intel = state.intel[def];
    if (plan.rotatedTo || state.time - intel.time > 2) return;
    for (const key of ['A', 'B']) {
      const s = SPOTS.sites[key];
      if (siteDistance(intel.x, intel.z, s) > 24) continue;
      plan.rotatedTo = key;
      defenders.filter((a) => !a.bot.mem.target && siteDistance(a.pos.x, a.pos.z, s) > 22)
        .forEach((a, i) => assignTask(a.bot, [], s.holds[i % 4], ''));
    }
    return;
  }
  const spots = SPOTS.sites[c.site];
  if (!plan.postPlant) { // attackers spread into a crossfire around the charge
    plan.postPlant = true;
    attackers.forEach((a, i) => assignTask(a.bot, [], [spots.post[i % 4], spots.center, i % 2 === 1], '', { anchored: true }));
  }
  if (plan.retake && !defenders.some((a) => a.bot.objective === 'defuse')) plan.retake = false; // the defuser fell: send another
  if (!plan.retake) { // the nearest defender defuses, the rest retake through the hold spots
    plan.retake = true;
    const defuser = nearest(defenders, c.pos);
    defenders.forEach((a, i) => (a === defuser ? assignTask(a.bot, [], null, 'defuse') : assignTask(a.bot, [], [spots.holds[i % 4][0], spots.center], '')));
  }
}
