// Saltworks: a coastal salt refinery at golden hour, drawn as a 48 x 44 grid of 2 m cells (north is up).
// One map string drives everything: collision boxes, the navigation grid, the meshes and the minimap.
//   Site A, Evaporation Pans (north-west)   Site B, Pump Hall (north-east)
//   Salt Yard (west lane)  Brine Channel (mid, long sightline through the Gate)  Conveyor Row (east lane)
//   Short A (mid to A)  Pipe Alley (mid to B)  Underpass (Salt Yard to mid)
//   Harbor Watch spawn D (north), Cinder Cell spawn S (south)
export const CELL = 2;
export const COLS = 48;
export const ROWS = 44;

export const GRID = [
  '################################################',
  '#TT..........CC..#DDDDDDDDDDDDHHTT:::::::::::CC#',
  '#TT..........CC..#DDDDDDDDDDDDHHTT:::::::::::CC#',
  '#....pppppppp....#DDccDDDDDDDD||:::::::::::::::#',
  '#....pAAAAAAp..o.|DDccDDDDDDDD||::::BBBBBBBB:::#',
  '#....pAAcAAAp....|DDDDDDDDDDDDHH::TTBBBBBBBB:::#',
  '#....pAAcAAAp....MMMM......MMMHH::TTBBcBBBBB:::#',
  '#....pAAAAAAp.cc.MMMM..c...MMMHH::::BBBBBBcc:::#',
  '#....ppp..ppp.cc.MMMM.c....MMMHH:::::BBBBBcc:::#',
  '#................MMMM.c....MMMHH:::::BBBBBB::TT#',
  '#.pppp.....C.....MMMM......MMMHH:CC::::::::::TT#',
  '#.pxxp.....C...............MMMHH:CC::::::::::::#',
  '#.pxxp.....................MMMHH:::::TT::::::::#',
  '#.pppp...................c.MMMHH:::::TT:::oo:::#',
  '#........cc......MMMM......MMMHH:::::::::::::::#',
  '#...o....cc...kkkMMMM......MMMHH::cc:::::::::cc#',
  '#..............k.MMMMMM..MMMMMHHH||HHHHH||||HHH#',
  '#,,,,,,,,MMMMMMMMMMMMMM..MMMMMMMM..MMM...o.....#',
  '#,,,,,,,,MMMMMMMMMMMM......MMMMMM..MMM.........#',
  '#,,cc,,,,MMMMMMMMMMMM......~~~~~~~~~~~.........#',
  '#,,cc,,,,MMMMMMMMMMMM.......................cc.#',
  '#,,,,,,,,MMMMMMMMMMMM......MMMMMMMMMMM......cc.#',
  '#,,,,,,C,MMMMMMMMMMMM......MMMMMMMMMMM.........#',
  '#,,,,,,C,MMMMMMMMMMMM......MMMMMMMMMMM.oo......#',
  '#,,,,,,,,MMMMMMMMMMMM..cc..MMMMMMMMMMM.........#',
  '#,cc,,,,,MMMMMMMMMMMM..cc..MMMMMMMMMMM......CC.#',
  '#,cc,,,,,MMMMMMMMMMMM......MMMMMMMMMMM......CC.#',
  '#,,,,,,,,MMMMMMMMMMMM......MMMMMMMMMMM.........#',
  '#,,,,,,,,MMMMMMMMMMMM......MMMMMMMMMMM..kkk....#',
  '#,,,,,,,,|==========|......MMMMMMMMMMM.........#',
  '#,,,,,,,,|==========|......MMMMMMMMMMM.........#',
  '#,,,oo,,,MMMMMMMMMMMM......MMMMMMMMMMM.........#',
  '#,,,,,,,,MMMMMMMMMMMM....c.MMMMMMMMMMM...CC....#',
  '#,,,,,,,,MMMMMMMMMMMM......MMMMMMMMMMM...CC....#',
  '#kkk,,,,,MMMMMMMMMMMM......MMMMMMMMMMM.........#',
  '#,,,,,,,,MMMMMMMMMMMM......MMMMMMMMMMM.........#',
  '#,,,,,,,,MMMMMMMMMMMM......MMMMMMMMMMM.........#',
  '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
  '#,,,,,,,,,CC,,,,,,,,,,,,,,,,,,,,,,,,,,,CC,,,,,,#',
  '#,,,,,,,,,CC,,,SSSSSSSSSSSSSSSSSS,,,,,,,,,,,,,,#',
  '#,,oo,,,,,,,,,,SSSSSSSSSSSSSSSSSS,,,,,,,,,,oo,,#',
  '#,,,,,,,,,,,,,,SSSSSSSSSSSSSSSSSS,,,,,,,,,,,,,,#',
  '#TT,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,TT#',
  '################################################',
];

// solid: blocks of a height; floor: walkable surface type; over: something overhead at [from, to] metres.
export const LEGEND = {
  '#': { solid: 7, mat: 'perimeter' },
  M: { solid: 5, mat: 'building' },
  H: { solid: 5.5, mat: 'hall' },
  c: { solid: 1.2, mat: 'crate' },
  C: { solid: 2.4, mat: 'crateStack' },
  o: { solid: 1.1, mat: 'barrel' },
  T: { solid: 6, mat: 'tank' },
  k: { solid: 1.0, mat: 'barrier' },
  p: { solid: 0.4, mat: 'rim', step: true },
  '.': { floor: 'concrete' },
  ',': { floor: 'sand' },
  x: { floor: 'salt' },
  A: { floor: 'siteA', site: 'A' },
  B: { floor: 'siteB', site: 'B' },
  ':': { floor: 'tiles' },
  D: { floor: 'spawnDef' },
  S: { floor: 'spawnAtk' },
  '|': { floor: 'concrete', over: [3.1, 5], mat: 'lintel' },
  '=': { floor: 'concrete', over: [3.3, 5], mat: 'roof' },
  '~': { floor: 'concrete', over: [3.2, 3.7], mat: 'pipes' },
};

// Cells [col, row]. Holds carry the angle a defender watches; routes are the lanes attackers take.
export const SPOTS = {
  spawn: {
    def: [[19, 2], [22, 2], [25, 2], [28, 2], [25, 4]],
    atk: [[18, 40], [21, 40], [24, 40], [27, 40], [30, 40]],
  },
  sites: {
    A: { name: 'Evaporation Pans', center: [9, 6], plant: [[7, 4], [10, 7], [9, 5]],
      holds: [[[16, 9], [19, 12]], [[13, 5], [4, 16]], [[2, 8], [8, 15]], [[12, 2], [17, 5]]],
      post: [[14, 9], [3, 9], [10, 13], [13, 2]] },
    B: { name: 'Pump Hall', center: [39, 7], plant: [[40, 5], [37, 8], [41, 9]],
      holds: [[[44, 7], [41, 16]], [[36, 11], [33, 16]], [[45, 13], [40, 16]], [[33, 6], [30, 3]]],
      post: [[44, 12], [35, 8], [33, 13], [45, 3]] },
  },
  mid: [[[22, 10], [23, 22]], [[25, 12], [24, 26]]],
  routes: {
    A: { long: [[4, 30], [4, 19]], short: [[24, 30], [23, 18], [19, 12]], under: [[4, 32], [14, 29], [22, 24], [23, 17], [18, 12]] },
    B: { east: [[42, 30], [42, 19]], pipe: [[24, 30], [24, 20], [33, 19]] },
  },
};

export const ZONES = [
  { name: 'Evaporation Pans', c0: 1, r0: 1, c1: 16, r1: 16 },
  { name: 'Harbor Watch spawn', c0: 17, r0: 1, c1: 29, r1: 5 },
  { name: 'Pump Hall', c0: 30, r0: 1, c1: 46, r1: 16 },
  { name: 'Short A', c0: 17, r0: 11, c1: 20, r1: 13 },
  { name: 'Brine Channel', c0: 21, r0: 6, c1: 26, r1: 36 },
  { name: 'Salt Yard', c0: 1, r0: 17, c1: 8, r1: 36 },
  { name: 'Underpass', c0: 9, r0: 29, c1: 20, r1: 30 },
  { name: 'Pipe Alley', c0: 27, r0: 17, c1: 37, r1: 20 },
  { name: 'Conveyor Row', c0: 38, r0: 17, c1: 46, r1: 36 },
  { name: 'Cinder yard', c0: 1, r0: 37, c1: 46, r1: 42 },
];

export function cellX(col) { return (col - COLS / 2) * CELL + CELL / 2; }
export function cellZ(row) { return (row - ROWS / 2) * CELL + CELL / 2; }
export function colOf(x) { return Math.floor(x / CELL + COLS / 2); }
export function rowOf(z) { return Math.floor(z / CELL + ROWS / 2); }

/** 'A' or 'B' when the point is on a plant zone, else ''. */
export function siteAt(x, z) {
  const c = colOf(x), r = rowOf(z);
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return '';
  return LEGEND[GRID[r][c]].site || '';
}

export function zoneAt(x, z) {
  const c = colOf(x);
  const r = rowOf(z);
  for (const zone of ZONES) if (c >= zone.c0 && c <= zone.c1 && r >= zone.r0 && r <= zone.r1) return zone.name;
  return 'Saltworks';
}
