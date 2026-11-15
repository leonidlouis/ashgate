// Saltworks, a salt refinery at golden hour: a 48 x 44 grid of 2 m cells, north up, driving collision,
// navigation, meshes and minimap. Site A Evaporation Pans (NW), Site B Pump Hall (NE); lanes Salt Yard
// (west), Brine Channel (mid, long sightline through the Gate), Conveyor Row (east); connectors Short A,
// Pipe Alley, Underpass. Harbor Watch spawns north (D), Cinder Cell south (S).
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

// solid: block height (# wall, M warehouse, H hall, T tank, c/C crates, o barrels, k barrier, p steppable
// pan rim); floor: walkable surface; over: lintel, roof or pipes spanning [from, to] m.
export const LEGEND = {
  '#': { solid: 7 }, M: { solid: 5 }, H: { solid: 5.5 }, T: { solid: 6 }, c: { solid: 1.2 }, C: { solid: 2.4 }, o: { solid: 1.1 }, k: { solid: 1 }, p: { solid: 0.4, step: true },
  '.': { floor: 'concrete' }, ',': { floor: 'sand' }, x: { floor: 'salt' }, ':': { floor: 'tiles' }, D: { floor: 'spawnDef' }, S: { floor: 'spawnAtk' },
  A: { floor: 'siteA', site: 'A' }, B: { floor: 'siteB', site: 'B' },
  '|': { floor: 'concrete', over: [3.1, 5] }, '=': { floor: 'concrete', over: [3.3, 5] }, '~': { floor: 'concrete', over: [3.2, 3.7] },
};

// Cells [col, row]. Holds carry the angle a defender watches; routes are the lanes attackers take.
export const SPOTS = {
  spawn: {
    def: [[19, 2], [22, 2], [25, 2], [28, 2], [25, 4]],
    atk: [[18, 40], [21, 40], [24, 40], [27, 40], [30, 40]],
  },
  sites: {
    A: { center: [9, 6], plant: [[7, 4], [10, 7], [9, 5]],
      holds: [[[16, 9], [19, 12]], [[13, 5], [4, 16]], [[2, 8], [8, 15]], [[12, 2], [17, 5]]],
      post: [[14, 9], [3, 9], [10, 13], [13, 2]] },
    B: { center: [39, 7], plant: [[40, 5], [37, 8], [41, 9]],
      holds: [[[44, 7], [41, 16]], [[36, 11], [33, 16]], [[45, 13], [40, 16]], [[33, 6], [30, 3]]],
      post: [[44, 12], [35, 8], [33, 13], [45, 3]] },
  },
  mid: [[[22, 10], [23, 22]], [[25, 12], [24, 26]]],
  routes: {
    A: { long: [[4, 30], [4, 19]], short: [[24, 30], [23, 18], [19, 12]], under: [[4, 32], [14, 29], [22, 24], [23, 17], [18, 12]] },
    B: { east: [[42, 30], [42, 19]], pipe: [[24, 30], [24, 20], [33, 19]] },
  },
};

// [name, col0, row0, col1, row1]: area names shown under the radar
const ZONES = [['Evaporation Pans', 1, 1, 16, 16], ['Harbor Watch spawn', 17, 1, 29, 5], ['Pump Hall', 30, 1, 46, 16], ['Short A', 17, 11, 20, 13],
  ['Brine Channel', 21, 6, 26, 36], ['Salt Yard', 1, 17, 8, 36], ['Underpass', 9, 29, 20, 30], ['Pipe Alley', 27, 17, 37, 20], ['Conveyor Row', 38, 17, 46, 36], ['Cinder yard', 1, 37, 46, 42]];

export function cellX(col) { return (col - COLS / 2) * CELL + CELL / 2; }
export function cellZ(row) { return (row - ROWS / 2) * CELL + CELL / 2; }
export function colOf(x) { return Math.floor(x / CELL + COLS / 2); }
export function rowOf(z) { return Math.floor(z / CELL + ROWS / 2); }

export function siteAt(x, z) {
  const c = colOf(x), r = rowOf(z);
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return '';
  return LEGEND[GRID[r][c]].site || '';
}

export function zoneAt(x, z) {
  const c = colOf(x), r = rowOf(z);
  for (const [name, c0, r0, c1, r1] of ZONES) if (c >= c0 && c <= c1 && r >= r0 && r <= r1) return name;
  return 'Saltworks';
}
