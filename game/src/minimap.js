// North-up radar: squad, spotted enemies, charge, smokes, view cone.
import { GRID, LEGEND, COLS, ROWS, CELL, SPOTS } from './mapdata.js';
import { SIDES } from './config.js';

const FLOOR = { concrete: '#5d6266', sand: '#7a6a55', salt: '#8c8a84', siteA: '#8a5a3c', siteB: '#3d6c72', tiles: '#596366', spawnDef: '#38575e', spawnAtk: '#6b4a34' };

export function createMinimap(canvas) {
  const g = canvas.getContext('2d'), size = canvas.width, k = size / COLS, top = (size - ROWS * k) / 2;
  const base = document.createElement('canvas');
  base.width = base.height = size;
  const b = base.getContext('2d');
  for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) {
    const def = LEGEND[GRID[r][c]];
    b.fillStyle = def.solid ? (def.solid > 2 ? '#1a2025' : '#3a3f44') : FLOOR[def.floor];
    b.fillRect(c * k, top + r * k, k + 0.5, k + 0.5);
  }
  b.font = '800 15px system-ui, sans-serif';
  b.textAlign = 'center'; b.textBaseline = 'middle'; b.fillStyle = 'rgba(244,239,230,0.85)';
  for (const key of ['A', 'B']) b.fillText(key, (SPOTS.sites[key].center[0] + 0.5) * k, top + (SPOTS.sites[key].center[1] + 0.5) * k);
  const px = (x) => (x / CELL + COLS / 2) * k, pz = (z) => top + (z / CELL + ROWS / 2) * k;

  function dot(x, z, color, r, ring) {
    g.beginPath();
    g.arc(px(x), pz(z), r, 0, Math.PI * 2);
    g.fillStyle = color;
    g.fill();
    if (ring) { g.lineWidth = 1.5; g.strokeStyle = ring; g.stroke(); }
  }

  function draw(state, viewer) {
    g.clearRect(0, 0, size, size);
    g.globalAlpha = 0.92;
    g.drawImage(base, 0, 0);
    g.globalAlpha = 1;
    for (const s of state.smokes) if (s.active) dot(s.pos.x, s.pos.z, 'rgba(225,220,210,0.7)', s.radius * k / CELL);
    const x = px(viewer.pos.x), z = pz(viewer.pos.z), ang = Math.atan2(-Math.cos(viewer.yaw), -Math.sin(viewer.yaw));
    g.beginPath(); g.moveTo(x, z); g.arc(x, z, 30, ang - 0.55, ang + 0.55); g.closePath();
    g.fillStyle = 'rgba(244,239,230,0.16)'; g.fill();
    const mine = state.player.squad;
    for (const a of state.actors) {
      const css = SIDES[state.match.side[a.squad]].css;
      if (a.squad !== mine) { if (a.alive && state.time - state.spotted[a.id] < 2) dot(a.pos.x, a.pos.z, '#e5483b', 3.8, '#ffffff'); } else if (a.alive) dot(a.pos.x, a.pos.z, css, a === viewer ? 4.5 : 3.5, a === viewer ? '#ffffff' : '#10161b');
      else dot(a.pos.x, a.pos.z, 'rgba(20,20,20,0.6)', 2.5, css);
    }
    const c = state.charge, carried = c.carrier && c.carrier.squad === mine;
    if (c.state === 'planted' || carried || (c.state === 'dropped' && state.match.side[mine] === 'atk')) {
      const p = carried ? c.carrier.pos : c.pos;
      g.fillStyle = c.state === 'planted' && Math.floor(state.time * 4) % 2 ? '#ff3a1a' : '#f2b230';
      g.strokeStyle = '#10161b';
      g.fillRect(px(p.x) - 3.5, pz(p.z) - (carried ? 10.5 : 3.5), 7, 7);
      g.strokeRect(px(p.x) - 3.5, pz(p.z) - (carried ? 10.5 : 3.5), 7, 7);
    }
  }
  return { draw };
}
