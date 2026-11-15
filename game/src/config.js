// Every tuning number: timing, movement, rounds, money, palette.
export const TICK = 1 / 60;
export const MAX_STEPS_PER_FRAME = 6;

export const SQUAD_SIZE = 5;
export const ROUNDS_TO_WIN = 7;
export const HALF_LENGTH = 6;

export const ROUND = {
  freeze: 8,
  live: 115,
  buyWindow: 20,
  plantTime: 3.2,
  fuse: 40,
  defuse: 5,
  defuseKit: 3,
  post: 5,
};

export const ECONOMY = {
  start: 800,
  max: 16000,
  winElimination: 3250,
  winObjective: 3500,
  winTime: 3250,
  lossBase: 1400,
  lossStep: 500,
  lossMax: 3400,
  plantBonus: 800,
  plantReward: 300,
  defuseReward: 300,
};

export const MOVE = {
  run: 5.6,
  walk: 2.8,
  crouch: 1.9,
  accel: 42,
  airAccel: 6,
  friction: 9,
  stopSpeed: 1.6,
  gravity: 17,
  jump: 5.3,
  step: 0.45,
  radius: 0.34,
  height: 1.8,
  crouchHeight: 1.25,
  eye: 1.64,
  crouchEye: 1.12,
  crouchRate: 7,
  stepStride: 2.3,
};

export const SENSE = {
  fov: Math.cos((115 / 2) * Math.PI / 180),
  nearAware: 3.5,
  thinkInterval: 0.1,
  memory: 4,
  hearGun: 48,
  hearStep: 16,
  hearUtility: 22,
};

export const DIFFICULTY = {
  recruit: { reaction: 0.55, aimError: 0.06, turn: 4.5, headChance: 0.12, burst: 3 },
  veteran: { reaction: 0.34, aimError: 0.035, turn: 7, headChance: 0.25, burst: 4 },
  elite: { reaction: 0.2, aimError: 0.018, turn: 10, headChance: 0.45, burst: 5 },
};

export const PALETTE = {
  skyTop: 0x2c5d85,
  skyHorizon: 0xf7b170,
  sun: 0xffc47e,
  fog: 0xe8b07e,
  hemiSky: 0x9cc3dc,
  hemiGround: 0xb98a5c,
  cinder: 0xf07a2a,
  harbor: 0x3aa6b9,
};

export const SIDES = {
  atk: { name: 'Cinder Cell', short: 'CINDER', color: PALETTE.cinder, css: '#f07a2a' },
  def: { name: 'Harbor Watch', short: 'HARBOR', color: PALETTE.harbor, css: '#3aa6b9' },
};
