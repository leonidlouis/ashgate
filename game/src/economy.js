// Money: round rewards with a loss streak, plant bonus, prices, and one buy() for the menu and the
// bots. A squad with a thin bank saves together.
import { ECONOMY, ROUND } from './config.js';
import { itemDef } from './weapons.js';
import { sideOf } from './state.js';

export function canBuy(state, actor) {
  const r = state.round;
  return actor.alive && !state.match.over && (r.phase === 'freeze' || (r.phase === 'live' && r.elapsed < ROUND.buyWindow - ROUND.freeze));
}

/** A helmet costs only its own share when you already wear a full vest. */
export const priceOf = (actor, entry) => (entry.id === 'helmet' && actor.armor >= 100 && !actor.helmet ? 350 : itemDef(entry).price);

export function buyBlock(state, actor, entry) {
  if (!canBuy(state, actor)) return 'Buy time is over';
  const def = itemDef(entry), g = actor.grenades, price = priceOf(actor, entry);
  if (entry.type === 'weapon') {
    const owned = def.slot === 'primary' ? actor.primary : actor.secondary;
    if (owned && owned.def === def && owned.mag === def.mag && owned.reserve === def.reserve) return 'Owned';
  } else if (entry.type === 'grenade') {
    if (g[entry.id] >= def.max) return 'Carrying max';
    if (g.frag + g.smoke + g.flash >= 3) return 'Pouch full';
  } else if (entry.id === 'kit') {
    if (actor.kit) return 'Owned';
    if (sideOf(state, actor) !== 'def') return 'Harbor Watch only';
  } else if (actor.armor >= 100 && (entry.id === 'vest' || actor.helmet)) return 'Owned';
  return actor.money < price ? 'Need $' + price : '';
}

export function buy(state, actor, entry) {
  if (buyBlock(state, actor, entry)) return false;
  const def = itemDef(entry), price = priceOf(actor, entry);
  actor.money -= price;
  if (entry.type === 'weapon') {
    const item = { def, mag: def.mag, reserve: def.reserve };
    if (def.slot === 'primary') actor.primary = item; else actor.secondary = item;
    if (def.slot === 'primary' || !actor.primary) actor.pendingSlot = def.slot;
  } else if (entry.type === 'grenade') actor.grenades[entry.id] += 1;
  else if (entry.id === 'kit') actor.kit = true;
  else { actor.armor = 100; actor.helmet ||= entry.id === 'helmet'; }
  state.events.emit('buy', actor).value = price;
  return true;
}

export function payRound(state, winner, reason) {
  const loser = 1 - winner, streak = state.match.lossStreak, c = state.charge.state;
  const win = reason === 'elimination' ? ECONOMY.winElimination : reason === 'time' ? ECONOMY.winTime : ECONOMY.winObjective;
  const loss = Math.min(ECONOMY.lossMax, ECONOMY.lossBase + ECONOMY.lossStep * streak[loser]);
  streak[winner] = 0;
  streak[loser] = Math.min(4, streak[loser] + 1);
  const planted = c === 'planted' || c === 'detonated' || c === 'defused';
  for (const a of state.actors) {
    const attacker = sideOf(state, a) === 'atk';
    let gain = a.squad === winner ? win : loss + (planted && attacker ? ECONOMY.plantBonus : 0);
    if (a.squad === loser && reason === 'time' && a.alive && attacker) gain = 0; // ran the clock out without planting
    a.money = Math.min(ECONOMY.max, a.money + gain);
  }
}

const item = (type, id) => ({ type, id });
const [RIFLE, MARKSMAN, SMG, SHOTGUN] = ['kestrel', 'longshore', 'wisp', 'breaker'].map((id) => item('weapon', id));
const [HELMET, VEST, KIT] = ['helmet', 'vest', 'kit'].map((id) => item('gear', id));
const [FRAG, SMOKE, FLASH] = ['frag', 'smoke', 'flash'].map((id) => item('grenade', id));

/** A bot's shopping list for the round: full buy, force buy, or save with the squad. */
export function botBuy(state, actor, squadSaves) {
  const rng = state.rng, kind = actor.primary ? actor.primary.def.kind : '', m = () => actor.money;
  if (kind !== 'rifle' && kind !== 'marksman') {
    if (m() >= 5600 && actor.id % 5 === 3) buy(state, actor, MARKSMAN);
    else if (m() >= 3700) buy(state, actor, RIFLE);
    else if (!squadSaves && m() >= 1900) buy(state, actor, rng.chance(0.7) ? SMG : SHOTGUN);
  }
  if (actor.primary || !squadSaves) buy(state, actor, m() >= 1000 ? HELMET : VEST);
  if (!actor.primary) { if (rng.chance(0.4)) buy(state, actor, FLASH); return; }
  if (sideOf(state, actor) === 'def' && rng.chance(0.6)) buy(state, actor, KIT);
  for (const g of [rng.chance(0.5) ? SMOKE : FRAG, FRAG, FLASH]) buy(state, actor, g);
}
