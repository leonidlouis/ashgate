// A* over walkable 2 m cells, string-pulled into straight legs.
import { COLS, ROWS, cellX, cellZ, colOf, rowOf } from './mapdata.js';
import { isWalkable } from './collision.js';

const N = COLS * ROWS;
const MAX_POINTS = 64;

export function createPath() {
  const points = [];
  for (let i = 0; i < MAX_POINTS; i += 1) points.push({ x: 0, z: 0 });
  return { points, count: 0, index: 0 };
}

export function createNav() {
  const walk = new Uint8Array(N);
  const cost = new Float32Array(N);
  for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) walk[r * COLS + c] = isWalkable(c, r) ? 1 : 0;
  for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) {
    let walls = 0;
    for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) if (!open(c + dc, r + dr)) walls += 1;
    cost[r * COLS + c] = 1 + walls * 0.15;
  }
  const g = new Float32Array(N);
  const parent = new Int32Array(N);
  const seen = new Int32Array(N);
  const shut = new Int32Array(N);
  const heap = new Int32Array(N * 4);
  const heapF = new Float32Array(N * 4);
  const chain = new Int32Array(N);
  let search = 0, size = 0;

  function push(i, f) {
    let k = size++;
    for (let p = (k - 1) >> 1; k > 0 && heapF[p] > f; p = (k - 1) >> 1) { heap[k] = heap[p]; heapF[k] = heapF[p]; k = p; }
    heap[k] = i; heapF[k] = f;
  }
  function pop() {
    const top = heap[0], li = heap[--size], lf = heapF[size];
    let k = 0;
    for (let c = 1; c < size; c = 2 * k + 1) {
      if (c + 1 < size && heapF[c + 1] < heapF[c]) c += 1;
      if (heapF[c] >= lf) break;
      heap[k] = heap[c]; heapF[k] = heapF[c]; k = c;
    }
    heap[k] = li; heapF[k] = lf;
    return top;
  }

  function open(c, r) {
    return c >= 0 && r >= 0 && c < COLS && r < ROWS && walk[r * COLS + c] === 1;
  }

  function nearest(c, r) {
    if (open(c, r)) return r * COLS + c;
    for (let ring = 1; ring < 6; ring += 1)
      for (let dr = -ring; dr <= ring; dr += 1) for (let dc = -ring; dc <= ring; dc += 1)
        if (open(c + dc, r + dr)) return (r + dr) * COLS + c + dc;
    return -1;
  }

  function lineWalkable(ax, az, bx, bz) {
    const len = Math.hypot(bx - ax, bz - az);
    const steps = Math.ceil(len / 0.5);
    for (let i = 0; i <= steps; i += 1) {
      const t = steps ? i / steps : 0;
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (!open(colOf(x - 0.45), rowOf(z - 0.45)) || !open(colOf(x + 0.45), rowOf(z - 0.45)) ||
        !open(colOf(x - 0.45), rowOf(z + 0.45)) || !open(colOf(x + 0.45), rowOf(z + 0.45))) return false;
    }
    return true;
  }

  function findPath(fromX, fromZ, toX, toZ, path) {
    path.count = 0; path.index = 0;
    const start = nearest(colOf(fromX), rowOf(fromZ));
    const goal = nearest(colOf(toX), rowOf(toZ));
    if (start < 0 || goal < 0) return 0;
    search += 1;
    const gc = goal % COLS, gr = (goal / COLS) | 0;
    size = 0;
    g[start] = 0; seen[start] = search; parent[start] = -1;
    push(start, 0);
    let found = false;
    while (size > 0) {
      const cur = pop();
      if (shut[cur] === search) continue;
      shut[cur] = search;
      if (cur === goal) { found = true; break; }
      const c = cur % COLS, r = (cur / COLS) | 0;
      for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) {
        if (!dr && !dc) continue;
        const nc = c + dc, nr = r + dr;
        if (!open(nc, nr)) continue;
        if (dr && dc && (!open(c + dc, r) || !open(c, r + dr))) continue;
        const ni = nr * COLS + nc;
        if (shut[ni] === search) continue;
        const ng = g[cur] + (dr && dc ? 1.414 : 1) * cost[ni];
        if (seen[ni] === search && ng >= g[ni]) continue;
        seen[ni] = search; g[ni] = ng; parent[ni] = cur;
        const hx = Math.abs(nc - gc), hz = Math.abs(nr - gr);
        if (size < heap.length - 1) push(ni, ng + Math.max(hx, hz) + 0.414 * Math.min(hx, hz));
      }
    }
    if (!found) return 0;
    let n = 0;
    for (let i = goal; i !== -1; i = parent[i]) chain[n++] = i;
    let ax = fromX, az = fromZ;
    let k = n - 1;
    while (k >= 0 && path.count < MAX_POINTS - 1) {
      let far = k;
      for (let j = k; j >= 0; j -= 1) {
        const x = j === 0 ? toX : cellX(chain[j] % COLS), z = j === 0 ? toZ : cellZ((chain[j] / COLS) | 0);
        if (lineWalkable(ax, az, x, z)) far = j; else if (j < k - 6) break;
      }
      const pt = path.points[path.count++];
      pt.x = far === 0 ? toX : cellX(chain[far] % COLS);
      pt.z = far === 0 ? toZ : cellZ((chain[far] / COLS) | 0);
      ax = pt.x; az = pt.z;
      k = far - 1;
    }
    return path.count;
  }

  return { findPath, open };
}
