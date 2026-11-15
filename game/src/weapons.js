// The armoury as data for combat, buy menu, view model, audio and bots. Spread (cone half-angle)
// and recoil (per-shot [pitch, yaw] pattern) are written in milliradians; pen is the share of
// damage that passes armour; range is the damage kept per 12 m.
const MRAD = 0.001;
function gun(id, name, slot, kind, d) {
  const w = { id, name, slot, kind, pellets: 1, head: 4, body: 1, legs: 0.75, auto: false, speed: 1, ...d };
  d.spread ||= { base: 0, move: 0, air: 0, crouch: 1, bloom: 0, recover: 1 }; // the knife: no cone, no kick
  d.recoil ||= { pattern: [[0, 0]], recover: 10, view: 0 };
  w.spread = Object.fromEntries(Object.entries(d.spread).map(([k, v]) => [k, k === 'crouch' || k === 'recover' ? v : v * MRAD]));
  w.recoil = { ...d.recoil, pattern: d.recoil.pattern.map(([p, y]) => [p * MRAD, y * MRAD]) };
  return w;
}

export const WEAPONS = {
  tern: gun('tern', 'Tern P9', 'secondary', 'pistol', {
    price: 200, reward: 300, damage: 32, interval: 0.15, mag: 12, reserve: 36, reload: 2.1, pen: 0.5, range: 0.9,
    spread: { base: 6, move: 50, air: 120, crouch: 0.75, bloom: 16, recover: 0.09 },
    recoil: { pattern: [[12, 0], [16, 2], [18, -3]], recover: 7, view: 0.6 }, sound: { pitch: 1.35, body: 0.6, tail: 0.18 } }),
  wisp: gun('wisp', 'Wisp SMG', 'primary', 'smg', {
    price: 1250, reward: 600, damage: 25, interval: 0.075, mag: 30, reserve: 120, reload: 2.3, auto: true, pen: 0.6, range: 0.8, speed: 0.97,
    spread: { base: 9, move: 28, air: 100, crouch: 0.8, bloom: 7.5, recover: 0.11 },
    recoil: { pattern: [[6, 0], [8, 1], [9, -2], [10, 3], [8, -4], [7, 4]], recover: 9, view: 0.5 }, sound: { pitch: 1.2, body: 0.55, tail: 0.15 } }),
  breaker: gun('breaker', 'Breaker 12', 'primary', 'shotgun', {
    price: 1100, reward: 900, damage: 21, pellets: 9, pelletCone: 0.055, interval: 0.85, mag: 7, reserve: 28, reload: 3, pen: 0.5, head: 2, range: 0.45, speed: 0.95,
    spread: { base: 10, move: 20, air: 80, crouch: 0.9, bloom: 10, recover: 0.6 },
    recoil: { pattern: [[50, 4]], recover: 5, view: 0.7 }, sound: { pitch: 0.7, body: 1.1, tail: 0.32 } }),
  kestrel: gun('kestrel', 'Kestrel AR', 'primary', 'rifle', {
    price: 2700, reward: 300, damage: 34, interval: 0.1, mag: 30, reserve: 90, reload: 2.5, auto: true, pen: 0.78, range: 0.98, speed: 0.9,
    spread: { base: 3.5, move: 85, air: 160, crouch: 0.7, bloom: 5.5, recover: 0.12 },
    // climbs, then walks left and right: learnable, pull down against it
    recoil: { pattern: [[9, 0], [11, 1], [13, 0], [14, 2], [14, 4], [12, 6], [10, 6], [8, -4], [6, -8], [5, -9], [4, -6], [4, 6], [4, 9], [3, 7]], recover: 6.5, view: 0.5 },
    sound: { pitch: 0.95, body: 0.9, tail: 0.26 } }),
  longshore: gun('longshore', 'Longshore .338', 'primary', 'marksman', {
    price: 4500, reward: 100, damage: 115, interval: 1.4, mag: 5, reserve: 20, reload: 3.6, pen: 0.97, range: 0.99, scope: 32, speed: 0.82,
    spread: { base: 50, move: 200, air: 300, crouch: 0.9, bloom: 50, recover: 0.8, scoped: 1.2 },
    recoil: { pattern: [[60, 3]], recover: 3.5, view: 0.8 }, sound: { pitch: 0.6, body: 1.3, tail: 0.5 } }),
  hook: gun('hook', 'Hook Knife', 'knife', 'knife', {
    price: 0, reward: 1500, damage: 55, interval: 0.5, mag: 0, reserve: 0, reload: 0, auto: true, pen: 0.85, head: 1.5, legs: 1, range: 1, reach: 1.9, speed: 1.08,
    sound: { pitch: 2, body: 0.1, tail: 0.05 } }),
};

export const GRENADES = {
  frag: { id: 'frag', name: 'Frag', price: 300, fuse: 1.7, max: 1, damage: 100, radius: 8.5, blurb: 'Blast, falls off behind cover' },
  smoke: { id: 'smoke', name: 'Brine Smoke', price: 300, fuse: 1.8, max: 1, radius: 4.6, duration: 17, blurb: 'Blocks sight for 17 s' },
  flash: { id: 'flash', name: 'Glare', price: 200, fuse: 1.4, max: 2, radius: 24, blurb: 'Blinds whoever looks at it' },
};

const GEAR = {
  vest: { id: 'vest', name: 'Kevlar Vest', price: 650, blurb: '100 armour, chest only' },
  helmet: { id: 'helmet', name: 'Vest + Helmet', price: 1000, blurb: '100 armour, saves the head' },
  kit: { id: 'kit', name: 'Defuse Kit', price: 400, blurb: 'Defuse in 3 s, not 5' },
};

const menu = (title, type, ids) => ({ title, items: ids.map((id) => ({ type, id })) });
export const BUY_MENU = [menu('Sidearm', 'weapon', ['tern']), menu('Primary', 'weapon', ['wisp', 'breaker', 'kestrel', 'longshore']),
  menu('Utility', 'grenade', ['frag', 'smoke', 'flash']), menu('Gear', 'gear', ['vest', 'helmet', 'kit'])];
const TABLES = { weapon: WEAPONS, grenade: GRENADES, gear: GEAR };
/** The data behind a buy-menu entry { type, id }. */
export const itemDef = (entry) => TABLES[entry.type][entry.id];
export const GRENADE_ORDER = ['frag', 'smoke', 'flash'];
