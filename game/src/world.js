// Saltworks in three.js: the grid turned into merged, world-UV geometry (one mesh per material, a
// few dozen draw calls for the whole refinery), plus tanks, barrels, pipes, roof trusses, a gantry
// over the Brine Channel, painted site letters and the refinery's signage.
import * as THREE from 'three';
import { GRID, LEGEND, COLS, ROWS, CELL, cellX, cellZ } from './mapdata.js';
import { createMaterials, signTexture } from './textures.js';

class Batch {
  constructor() { this.p = []; this.n = []; this.uv = []; this.i = []; }
  /** A quad from corner o along edges a and b (normal n), UVs spanning [u0, u0 + ul] x [v0, v0 + vl]. */
  quad(o, a, b, n, [u0, ul], [v0, vl]) {
    const k = this.p.length / 3;
    for (const [s, t] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      this.p.push(o[0] + a[0] * s + b[0] * t, o[1] + a[1] * s + b[1] * t, o[2] + a[2] * s + b[2] * t);
      this.n.push(...n);
      this.uv.push(u0 + ul * s, v0 + vl * t);
    }
    this.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  /** An axis-aligned box with world-space UVs (tile = metres per repeat; 0 = one texture per face). */
  box(x0, y0, z0, x1, y1, z1, tile, bottom = false) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    const u = (start, len) => (tile ? [start / tile, len / tile] : [0, 1]);
    const v = u(y0, dy);
    this.quad([x1, y0, z1], [0, 0, -dz], [0, dy, 0], [1, 0, 0], u(-z1, dz), v);
    this.quad([x0, y0, z0], [0, 0, dz], [0, dy, 0], [-1, 0, 0], u(z0, dz), v);
    this.quad([x0, y0, z1], [dx, 0, 0], [0, dy, 0], [0, 0, 1], u(x0, dx), v);
    this.quad([x1, y0, z0], [-dx, 0, 0], [0, dy, 0], [0, 0, -1], u(-x1, dx), v);
    this.quad([x0, y1, z1], [dx, 0, 0], [0, 0, -dz], [0, 1, 0], u(x0, dx), u(-z1, dz));
    if (bottom) this.quad([x0, y0, z0], [dx, 0, 0], [0, 0, dz], [0, -1, 0], u(x0, dx), u(z0, dz));
  }
  floor(x0, z0, x1, z1, tile) {
    this.quad([x0, 0, z1], [x1 - x0, 0, 0], [0, 0, z0 - z1], [0, 1, 0], [x0 / tile, (x1 - x0) / tile], [-z1 / tile, (z1 - z0) / tile]);
  }
  mesh(material, cast) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.i);
    const m = new THREE.Mesh(g, material);
    m.castShadow = cast; m.receiveShadow = true;
    return m;
  }
}

const FLOOR_MAT = { concrete: 'concrete', sand: 'sand', salt: 'salt', siteA: 'salt', siteB: 'tiles', tiles: 'tiles', spawnDef: 'concrete', spawnAtk: 'sand' };
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 18, 1);
const cylinderLow = new THREE.CylinderGeometry(1, 1, 1, 10, 1);
const cube = new THREE.BoxGeometry(1, 1, 1);

function add(root, geo, mat, [sx, sy, sz], [x, y, z], [rx, ry, rz] = [0, 0, 0], cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = cast; m.receiveShadow = true;
  root.add(m);
  return m;
}

export function buildWorld(scene, collision) {
  const mats = createMaterials();
  const batches = new Map();
  const batch = (mat) => batches.get(mat) || batches.set(mat, new Batch()).get(mat);
  const root = new THREE.Group();
  scene.add(root);

  for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) {
    const type = LEGEND[GRID[r][c]].floor || neighbourFloor(c, r);
    const x0 = (c - COLS / 2) * CELL, z0 = (r - ROWS / 2) * CELL;
    batch(mats[FLOOR_MAT[type]]).floor(x0, z0, x0 + CELL, z0 + CELL, FLOOR_MAT[type] === 'tiles' ? 4 : 6);
  }
  // solids come from the collision boxes, so what you see is what stops you
  for (const b of collision.boxes) {
    const { minX: x0, minY: y0, minZ: z0, maxX: x1, maxY: y1, maxZ: z1 } = b;
    const col = (x0 + x1) / 2 / CELL + COLS / 2;
    switch (b.ch) {
      case '#': batch(mats.perimeter).box(x0, 0, z0, x1, y1, z1, 6); break;
      case 'M': // concrete plinth, corrugated walls (rust west, salt mid, ochre east), dark parapet
        batch(mats.concrete).box(x0, 0, z0, x1, 1.1, z1, 4);
        batch(col < 20.5 ? mats.rustMetal : col > 26.5 ? mats.ochreMetal : mats.saltMetal).box(x0 + 0.04, 1.1, z0 + 0.04, x1 - 0.04, y1 - 0.3, z1 - 0.04, 4);
        batch(mats.dark).box(x0 - 0.05, y1 - 0.3, z0 - 0.05, x1 + 0.05, y1, z1 + 0.05, 4);
        break;
      case 'H': batch(mats.hall).box(x0, 0, z0, x1, y1, z1, 5.5); break;
      case 'c': batch(mats.crate).box(x0, 0, z0, x1, y1, z1, 0); break;
      case 'C': batch(mats.crate).box(x0, 0, z0, x1, 1.2, z1, 0); batch(mats.crate).box(x0 + 0.25, 1.2, z0 + 0.05, x1 - 0.05, y1, z1 - 0.25, 0); break;
      case 'k': batch(mats.hazard).box(x0, 0, z0 + 0.5, x1, y1, z1 - 0.5, 2); break;
      case 'p': batch(mats.rim).box(x0, 0, z0, x1, y1, z1, 3); break;
      case '|': case '=': batch(mats.concrete).box(x0, y0, z0, x1, y1, z1, 4, true); break;
      case '~': for (let i = 0; i < 3; i += 1) add(root, cylinderLow, i === 1 ? mats.pipeRust : mats.pipe, [0.16 + i * 0.03, x1 - x0, 0.16 + i * 0.03], [(x0 + x1) / 2, y0 + 0.2 + i * 0.12, z0 + 0.5 + i * 0.5], [0, 0, Math.PI / 2]); break;
      case 'o': [[-0.4, -0.35], [0.42, -0.2], [0, 0.45]].forEach(([dx, dz], i) => add(root, cylinderLow, (Math.round(x0 + z0) + i) % 3 ? mats.barrelBlue : mats.barrelRed, [0.36, 1.1, 0.36], [(x0 + x1) / 2 + dx, 0.55, (z0 + z1) / 2 + dz])); break;
      case 'T': addTank(root, mats, b); break;
      default: break;
    }
  }
  for (const [mat, b] of batches) root.add(b.mesh(mat, mat !== mats.sand && mat !== mats.salt && mat !== mats.tiles));

  // the Pump Hall lost its roof long ago; the trusses remain
  for (let r = 2; r <= 14; r += 3) add(root, cube, mats.pipeRust, [30, 0.35, 0.3], [cellX(39), 5.6, cellZ(r)]);
  // a conveyor gantry bridging the Brine Channel between the warehouse roofs
  const gz = cellZ(27), gx = cellX(23.5);
  add(root, cube, mats.dark, [18, 0.4, 2.4], [gx, 5.4, gz]);
  add(root, cube, mats.rustMetal, [18, 0.5, 1.4], [gx, 5.85, gz]);
  add(root, cube, mats.hazard, [18, 0.08, 0.08], [gx, 6.4, gz + 1.15]);
  addSigns(root);
  return root;
}

function neighbourFloor(c, r) {
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
    const def = GRID[r + dr] && LEGEND[GRID[r + dr][c + dc]];
    if (def && def.floor) return def.floor;
  }
  return 'concrete';
}

function addTank(root, mats, b) {
  const w = b.maxX - b.minX, d = b.maxZ - b.minZ, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  if (Math.abs(w - d) > 0.1) { // a brine tank lying on its side
    const r = Math.min(w, d) / 2 - 0.05;
    add(root, cylinder, mats.steel, [r, Math.max(w, d) - 0.3, r], [cx, r + 0.15, cz], w > d ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]);
    return;
  }
  const r = w / 2 - 0.05, h = b.maxY - 0.6;
  add(root, cylinder, mats.steel, [r, h, r], [cx, h / 2, cz]);
  add(root, new THREE.ConeGeometry(1, 1, 18), mats.steel, [r, 1.2, r], [cx, b.maxY, cz]);
  add(root, cylinder, mats.pipeRust, [r + 0.04, 0.3, r + 0.04], [cx, 2.2, cz]);
}

function plane(root, tex, [x, y, z], [w, h], yaw, flat, opacity = 1) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({
    map: tex, transparent: flat, opacity, roughness: 0.9, depthWrite: !flat, polygonOffset: true, polygonOffsetFactor: -2,
  }));
  m.position.set(x, y, z);
  m.rotation.set(flat ? -Math.PI / 2 : 0, yaw, 0, 'YXZ');
  m.receiveShadow = true;
  root.add(m);
}

function addSigns(root) {
  // painted site letters on the floor
  plane(root, signTexture([{ text: 'A', size: 220, y: 128 }], null, '#e86f2a', 256, 256), [cellX(8), 0.02, cellZ(6)], [5, 5], 0, true, 0.85);
  plane(root, signTexture([{ text: 'B', size: 220, y: 128 }], null, '#3d9fae', 256, 256), [cellX(40), 0.02, cellZ(7)], [5, 5], 0, true, 0.6);
  // boards on the walls: [title, subtitle, board, ink, cell col, cell row, wall offset, yaw]
  const E = Math.PI / 2;
  const boards = [
    ['A', 'EVAPORATION PANS', '#efe8da', '#c4521f', 18.5, 10, [0, 1.03], 0],
    ['B', 'PUMP HALL', '#efe8da', '#23707a', 37, 16, [0, -0.98], Math.PI],
    ['BRINE CHANNEL', 'A  ←   MID   →  B', '#1c2a33', '#efe8da', 23.5, 17, [0, 1.03], 0],
    ['SALT YARD', '↑  SITE A', '#a5532e', '#efe8da', 9, 33, [-1.02, 0], -E],
    ['CONVEYOR ROW', '↑  SITE B', '#e2c27e', '#1c2a33', 37, 33, [1.02, 0], E],
    ['SALTWORKS', 'BRINE REFINERY No. 3', '#efe8da', '#1c2a33', 15, 36, [0, 1.03], 0],
    ['PIPE ALLEY', '→  B', '#efe8da', '#23707a', 27, 18, [-1.02, 0], -E],
  ];
  for (const [title, sub, bg, fg, c, r, [ox, oz], yaw] of boards) {
    const big = title.length < 3;
    const tex = signTexture([{ text: title, size: big ? 150 : title.length > 11 ? 60 : 72, y: big ? 110 : 100 }, { text: sub, size: big ? 46 : 48, y: big ? 210 : 185 }], bg, fg);
    plane(root, tex, [cellX(c) + ox, 3.4, cellZ(r) + oz], [3.2, 1.6], yaw, false);
  }
}
