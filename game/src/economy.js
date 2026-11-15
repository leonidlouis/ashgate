// Money: round rewards with a loss streak, the plant bonus, prices, and one buy() that the menu
// and the bots both call. Squads buy as a team: when the bank is thin, everyone saves.
import { ECONOMY, ROUND } from './config.js';
import { WEAPONS, GRENADES, GEAR } from './weapons.js';
import { sideOf } from './state.js';

export function canBuy(state, actor) {
  const r = state.round;
  if (!actor.alive || state.match.over) return false;
  return r.phase === 'freeze' || (r.phase === 'live' && r.elapsed < ROUND.buyWindow - ROUND.freeze);
}

export function priceOf(actor, entry) {
  if (entry.type === 'weapon') return WEAPONS[entry.id].price;
  if (entry.type === 'grenade') return GRENADES[entry.id].price;
  if (entry.id === 'helmet' && actor.armor >= 100 && !actor.helmet) return 350;
  return GEAR[entry.id].price;
}

/** Why an item cannot be bought now, or '' when it can. */
export function buyBlock(state, actor, entry) {
  if (!canBuy(state, actor)) return 'Buy time is over';
  const price = priceOf(actor, entry);
  if (entry.type === 'weapon') {
    const def = WEAPONS[entry.id];
    const owned = def.slot === 'primary' ? actor.primary : actor.secondary;
    if (owned && owned.def === def && owned.mag === def.mag && owned.reserve === def.reserve) return 'Owned';
  } else if (entry.type === 'grenade') {
    const g = actor.grenades;
    if (g[entry.id] >= GRENADES[entry.id].max) return 'Carrying max';
    if (g.frag + g.smoke + g.flash >= 3) return 'Pouch full';
  } else if (entry.id === 'vest' && actor.armor >= 100) return 'Owned';
  else if (entry.id === 'helmet' && actor.armor >= 100 && actor.helmet) return 'Owned';
  else if (entry.id === 'kit' && (actor.kit || sideOf(state, actor) !== 'def')) return actor.kit ? 'Owned' : 'Harbor Watch only';
  if (actor.money < price) return 'Need $' + price;
  return '';
}

export function buy(state, actor, entry) {
  if (buyBlock(state, actor, entry)) return false;
  const price = priceOf(actor, entry);
  actor.money -= price;
  if (entry.type === 'weapon') {
    const def = WEAPONS[entry.id], item = { def, mag: def.mag, reserve: def.reserve };
    if (def.slot === 'primary') actor.primary = item; else actor.secondary = item;
    if (def.slot === 'primary' || !actor.primary) actor.pendingSlot = def.slot;
  } else if (entry.type === 'grenade') actor.grenades[entry.id] += 1;
  else if (entry.id === 'kit') actor.kit = true;
  else { actor.armor = 100; actor.helmet ||= entry.id === 'helmet'; }
  const e = state.events.emit('buy', actor);
  e.value = price;
  return true;
}

export function payRound(state, winner, reason) {
  const loser = 1 - winner;
  const winAmount = reason === 'elimination' ? ECONOMY.winElimination : reason === 'time' ? ECONOMY.winTime : ECONOMY.winObjective;
  const streak = state.match.lossStreak;
  streak[winner] = 0;
  const lossAmount = Math.min(ECONOMY.lossMax, ECONOMY.lossBase + ECONOMY.lossStep * streak[loser]);
  streak[loser] = Math.min(4, streak[loser] + 1);
  const planted = state.charge.state === 'planted' || state.charge.state === 'detonated' || state.charge.state === 'defused';
  for (const a of state.actors) {
    let gain = a.squad === winner ? winAmount : lossAmount;
    if (a.squad === loser && planted && sideOf(state, a) === 'atk') gain += ECONOMY.plantBonus;
    // attackers who run the clock out without planting earn nothing
    if (a.squad === loser && reason === 'time' && a.alive && sideOf(state, a) === 'atk') gain = 0;
    a.money = Math.min(ECONOMY.max, a.money + gain);
  }
  return { winAmount, lossAmount };
}

const ITEM = (type, id) => ({ type, id });
const [RIFLE, MARKSMAN, SMG, SHOTGUN] = ['kestrel', 'longshore', 'wisp', 'breaker'].map((id) => ITEM('weapon', id));
const [HELMET, VEST, KIT] = ['helmet', 'vest', 'kit'].map((id) => ITEM('gear', id));
const [FRAG, SMOKE, FLASH] = ['frag', 'smoke', 'flash'].map((id) => ITEM('grenade', id));

/** A bot's shopping list for the round: full buy, force buy, or save with the squad. */
export function botBuy(state, actor, squadSaves) {
  const rng = state.rng, kind = actor.primary ? actor.primary.def.kind : '';
  const m = () => actor.money;
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
