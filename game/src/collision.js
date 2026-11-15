// The map as solid boxes, built once from the grid and indexed per cell. Movement, bullets,
// grenades and bot sight all query it; rays walk the grid cell by cell (DDA) so a sight check only
// touches boxes along its line. Nothing allocates after the build.
import { GRID, LEGEND, COLS, ROWS, CELL, colOf, rowOf } from './mapdata.js';

const EPS = 0.001;

/** Greedy rectangles over the cells holding one character: few, large boxes. */
function mergeRects(ch) {
  const used = new Uint8Array(COLS * ROWS);
  const take = (c, r) => c < COLS && r < ROWS && !used[r * COLS + c] && GRID[r][c] === ch;
  const rects = [];
  for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) {
    if (!take(c, r)) continue;
    let w = 1, h = 1;
    if (ch !== 'o') { // barrels stay one cell each so every cluster reads as its own prop
      while (take(c + w, r)) w += 1;
      while ([...Array(w).keys()].every((i) => take(c + i, r + h))) h += 1;
    }
    for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) used[(r + j) * COLS + c + i] = 1;
    rects.push({ c, r, w, h });
  }
  return rects;
}

export function createCollision() {
  const boxes = [];
  for (const ch of Object.keys(LEGEND)) {
    const def = LEGEND[ch];
    if (!def.solid && !def.over) continue;
    const inset = ch === 'o' ? 0.25 : ch === 'c' || ch === 'C' ? 0.08 : 0;
    for (const { c, r, w, h } of mergeRects(ch)) {
      const x0 = (c - COLS / 2) * CELL + inset, z0 = (r - ROWS / 2) * CELL + inset;
      boxes.push({ ch, minX: x0, maxX: x0 + w * CELL - inset * 2, minZ: z0, maxZ: z0 + h * CELL - inset * 2, minY: def.solid ? 0 : def.over[0], maxY: def.solid || def.over[1] });
    }
  }
  const cellBoxes = Array.from({ length: COLS * ROWS }, () => []);
  boxes.forEach((b, k) => {
    for (let r = rowOf(b.minZ + EPS); r <= rowOf(b.maxZ - EPS); r += 1)
      for (let c = colOf(b.minX + EPS); c <= colOf(b.maxX - EPS); c += 1) cellBoxes[r * COLS + c].push(k);
  });
  const stamp = new Int32Array(boxes.length);
  let stampId = 1;
  const near = [], nearHead = [];

  function gather(x0, z0, x1, z1, out) {
    out.length = 0;
    stampId += 1;
    for (let r = Math.max(0, rowOf(z0)); r <= Math.min(ROWS - 1, rowOf(z1)); r += 1)
      for (let c = Math.max(0, colOf(x0)); c <= Math.min(COLS - 1, colOf(x1)); c += 1)
        for (const k of cellBoxes[r * COLS + c]) if (stamp[k] !== stampId) { stamp[k] = stampId; out.push(boxes[k]); }
    return out;
  }
  const overlaps = (b, x, z, r) => x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ;

  // slab test against one box, one axis at a time into a reused span; writes the entry face normal
  const span = { t0: 0, t1: 0, axis: -1, sign: 0 };
  function slab(o, inv, lo, hi, k) {
    let a = (lo - o) * inv, c = (hi - o) * inv;
    if (a > c) { const s = a; a = c; c = s; }
    if (a > span.t0) { span.t0 = a; span.axis = k; span.sign = inv > 0 ? -1 : 1; }
    if (c < span.t1) span.t1 = c;
    return span.t0 <= span.t1;
  }
  function rayBox(b, ox, oy, oz, ix, iy, iz, maxT, hit) {
    span.t0 = 0; span.t1 = maxT; span.axis = -1;
    if (!slab(ox, ix, b.minX, b.maxX, 0) || !slab(oy, iy, b.minY, b.maxY, 1) || !slab(oz, iz, b.minZ, b.maxZ, 2) || span.axis < 0) return -1;
    hit.nx = span.axis === 0 ? span.sign : 0; hit.ny = span.axis === 1 ? span.sign : 0; hit.nz = span.axis === 2 ? span.sign : 0;
    return span.t0;
  }

  const probe = { nx: 0, ny: 0, nz: 0 };
  /** First solid (or the ground) along a unit direction within maxT. Fills hit; returns t or Infinity. */
  function raycast(ox, oy, oz, dx, dy, dz, maxT, hit) {
    const ix = 1 / (dx || 1e-9), iy = 1 / (dy || 1e-9), iz = 1 / (dz || 1e-9);
    let best = maxT;
    hit.box = null;
    if (dy < 0 && oy > 0 && -oy / dy < best) { best = -oy / dy; hit.nx = 0; hit.ny = 1; hit.nz = 0; }
    let c = colOf(ox), r = rowOf(oz);
    const sc = dx > 0 ? 1 : -1, sr = dz > 0 ? 1 : -1;
    const dX = Math.abs(dx) < 1e-9 ? Infinity : CELL / Math.abs(dx), dZ = Math.abs(dz) < 1e-9 ? Infinity : CELL / Math.abs(dz);
    let nX = dX === Infinity ? Infinity : ((c + (dx > 0) - COLS / 2) * CELL - ox) / dx;
    let nZ = dZ === Infinity ? Infinity : ((r + (dz > 0) - ROWS / 2) * CELL - oz) / dz;
    stampId += 1;
    for (let tCell = 0; tCell <= best && c >= 0 && c < COLS && r >= 0 && r < ROWS;) {
      for (const k of cellBoxes[r * COLS + c]) {
        if (stamp[k] === stampId) continue;
        stamp[k] = stampId;
        const t = rayBox(boxes[k], ox, oy, oz, ix, iy, iz, best, probe);
        if (t >= 0 && t < best) { best = t; hit.nx = probe.nx; hit.ny = probe.ny; hit.nz = probe.nz; hit.box = boxes[k]; }
      }
      if (nX < nZ) { tCell = nX; nX += dX; c += sc; } else { tCell = nZ; nZ += dZ; r += sr; }
    }
    hit.t = best < maxT ? best : Infinity;
    return hit.t;
  }

  const losHit = { t: 0, nx: 0, ny: 0, nz: 0, box: null };
  function clearLine(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz);
    return len < 1e-4 || raycast(ax, ay, az, dx / len, dy / len, dz / len, len, losHit) === Infinity;
  }

  /** Moves an upright body (pos at the feet) axis by axis, stepping up ledges below 0.45 m. */
  function moveBody(body, dt, radius, height) {
    const p = body.pos, v = body.vel;
    for (let axis = 0; axis < 2; axis += 1) {
      const vel = axis ? v.z : v.x;
      if (!vel) continue;
      const next = (axis ? p.z : p.x) + vel * dt;
      const x = axis ? p.x : next, z = axis ? next : p.z;
      let resolved = next;
      for (const b of gather(x - radius - 0.1, z - radius - 0.1, x + radius + 0.1, z + radius + 0.1, near)) {
        if (b.maxY <= p.y + EPS || b.minY >= p.y + height || !overlaps(b, x, z, radius)) continue;
        if (body.onGround && b.maxY - p.y <= 0.45 && headroom(x, z, radius, b.maxY, height)) { p.y = b.maxY; continue; }
        const lo = axis ? b.minZ : b.minX, hi = axis ? b.maxZ : b.maxX;
        resolved = vel > 0 ? Math.min(resolved, lo - radius - EPS) : Math.max(resolved, hi + radius + EPS);
      }
      if (resolved !== next) { if (axis) v.z = 0; else v.x = 0; }
      if (axis) p.z = resolved; else p.x = resolved;
    }
    // vertical: land on the highest top underfoot, stop under ceilings
    const nextY = p.y + v.y * dt;
    let floor = 0, ceiling = Infinity;
    for (const b of gather(p.x - radius, p.z - radius, p.x + radius, p.z + radius, near)) {
      if (!overlaps(b, p.x, p.z, radius)) continue;
      if (b.maxY <= p.y + 0.05 + EPS && b.maxY > floor) floor = b.maxY;
      if (b.minY >= p.y + height - EPS && b.minY < ceiling) ceiling = b.minY;
    }
    body.onGround = nextY <= floor;
    if (body.onGround) { p.y = floor; v.y = 0; } else if (nextY + height > ceiling) { p.y = ceiling - height; v.y = Math.min(0, v.y); } else p.y = nextY;
  }

  function headroom(x, z, radius, y, height) {
    for (const b of gather(x - radius, z - radius, x + radius, z + radius, nearHead)) if (overlaps(b, x, z, radius) && b.maxY > y + EPS && b.minY < y + height) return false;
    return true;
  }

  return { boxes, raycast, clearLine, moveBody };
}

/** Walkable for navigation: open floor, or a low step bots can climb. */
export function isWalkable(c, r) {
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return false;
  const def = LEGEND[GRID[r][c]];
  return !def.solid || def.step === true;
}
