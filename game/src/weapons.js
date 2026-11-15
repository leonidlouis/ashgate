// The armoury as data. Combat, the buy menu, the view model, audio and the bots all read this table.
// spread values are radians of cone half-angle; recoil is a per-shot [pitch, yaw] kick pattern.
// damage is per bullet before hit-zone multipliers and armour; pen is the share that passes armour.
export const WEAPONS = {
  tern: {
    id: 'tern', name: 'Tern P9', slot: 'secondary', kind: 'pistol', price: 200, reward: 300,
    damage: 32, pellets: 1, interval: 0.15, mag: 12, reserve: 36, reload: 2.1, auto: false,
    pen: 0.5, head: 4, body: 1, legs: 0.75, range: 0.9,
    spread: { base: 0.006, move: 0.05, air: 0.12, crouch: 0.75, bloom: 0.016, recover: 0.09 },
    recoil: { pattern: [[0.012, 0], [0.016, 0.002], [0.018, -0.003]], recover: 7, view: 0.6 },
    speed: 1, sound: { pitch: 1.35, body: 0.6, tail: 0.18 },
  },
  wisp: {
    id: 'wisp', name: 'Wisp SMG', slot: 'primary', kind: 'smg', price: 1250, reward: 600,
    damage: 25, pellets: 1, interval: 0.075, mag: 30, reserve: 120, reload: 2.3, auto: true,
    pen: 0.6, head: 4, body: 1, legs: 0.75, range: 0.8,
    spread: { base: 0.009, move: 0.028, air: 0.1, crouch: 0.8, bloom: 0.0075, recover: 0.11 },
    recoil: { pattern: [[0.006, 0], [0.008, 0.001], [0.009, -0.002], [0.01, 0.003], [0.008, -0.004], [0.007, 0.004]], recover: 9, view: 0.5 },
    speed: 0.97, sound: { pitch: 1.2, body: 0.55, tail: 0.15 },
  },
  breaker: {
    id: 'breaker', name: 'Breaker 12', slot: 'primary', kind: 'shotgun', price: 1100, reward: 900,
    damage: 21, pellets: 9, interval: 0.85, mag: 7, reserve: 28, reload: 3.0, auto: false,
    pen: 0.5, head: 2, body: 1, legs: 0.75, range: 0.45, pelletCone: 0.055,
    spread: { base: 0.01, move: 0.02, air: 0.08, crouch: 0.9, bloom: 0.01, recover: 0.6 },
    recoil: { pattern: [[0.05, 0.004]], recover: 5, view: 0.7 },
    speed: 0.95, sound: { pitch: 0.7, body: 1.1, tail: 0.32 },
  },
  kestrel: {
    id: 'kestrel', name: 'Kestrel AR', slot: 'primary', kind: 'rifle', price: 2700, reward: 300,
    damage: 34, pellets: 1, interval: 0.1, mag: 30, reserve: 90, reload: 2.5, auto: true,
    pen: 0.78, head: 4, body: 1, legs: 0.75, range: 0.98,
    spread: { base: 0.0035, move: 0.085, air: 0.16, crouch: 0.7, bloom: 0.0055, recover: 0.12 },
    // climbs up, then walks left and right: learnable, pull down against it
    recoil: {
      pattern: [[0.009, 0], [0.011, 0.001], [0.013, 0], [0.014, 0.002], [0.014, 0.004], [0.012, 0.006], [0.01, 0.006],
        [0.008, -0.004], [0.006, -0.008], [0.005, -0.009], [0.004, -0.006], [0.004, 0.006], [0.004, 0.009], [0.003, 0.007]],
      recover: 6.5, view: 0.5,
    },
    speed: 0.9, sound: { pitch: 0.95, body: 0.9, tail: 0.26 },
  },
  longshore: {
    id: 'longshore', name: 'Longshore .338', slot: 'primary', kind: 'marksman', price: 4500, reward: 100,
    damage: 115, pellets: 1, interval: 1.4, mag: 5, reserve: 20, reload: 3.6, auto: false,
    pen: 0.97, head: 4, body: 1, legs: 0.75, range: 0.99, scope: 32,
    spread: { base: 0.05, move: 0.2, air: 0.3, crouch: 0.9, bloom: 0.05, recover: 0.8, scoped: 0.0012 },
    recoil: { pattern: [[0.06, 0.003]], recover: 3.5, view: 0.8 },
    speed: 0.82, sound: { pitch: 0.6, body: 1.3, tail: 0.5 },
  },
  hook: {
    id: 'hook', name: 'Hook Knife', slot: 'knife', kind: 'knife', price: 0, reward: 1500,
    damage: 55, pellets: 1, interval: 0.5, mag: 0, reserve: 0, reload: 0, auto: true,
    pen: 0.85, head: 1.5, body: 1, legs: 1, range: 1, reach: 1.9,
    spread: { base: 0, move: 0, air: 0, crouch: 1, bloom: 0, recover: 1 },
    recoil: { pattern: [[0, 0]], recover: 10, view: 0 },
    speed: 1.08, sound: { pitch: 2, body: 0.1, tail: 0.05 },
  },
};

export const GRENADES = {
  frag: { id: 'frag', name: 'Frag', price: 300, fuse: 1.7, max: 1, damage: 100, radius: 8.5 },
  smoke: { id: 'smoke', name: 'Brine Smoke', price: 300, fuse: 1.8, max: 1, radius: 4.6, duration: 17 },
  flash: { id: 'flash', name: 'Glare', price: 200, fuse: 1.4, max: 2, radius: 24 },
};

export const GEAR = {
  vest: { id: 'vest', name: 'Kevlar Vest', price: 650 },
  helmet: { id: 'helmet', name: 'Vest + Helmet', price: 1000 },
  kit: { id: 'kit', name: 'Defuse Kit', price: 400, side: 'def' },
};

export const BUY_MENU = [
  { title: 'Sidearm', items: [{ type: 'weapon', id: 'tern' }] },
  { title: 'Primary', items: [{ type: 'weapon', id: 'wisp' }, { type: 'weapon', id: 'breaker' }, { type: 'weapon', id: 'kestrel' }, { type: 'weapon', id: 'longshore' }] },
  { title: 'Utility', items: [{ type: 'grenade', id: 'frag' }, { type: 'grenade', id: 'smoke' }, { type: 'grenade', id: 'flash' }] },
  { title: 'Gear', items: [{ type: 'gear', id: 'vest' }, { type: 'gear', id: 'helmet' }, { type: 'gear', id: 'kit' }] },
];

export const GRENADE_ORDER = ['frag', 'smoke', 'flash'];
