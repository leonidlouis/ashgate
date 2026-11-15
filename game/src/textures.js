// Canvas-painted surfaces (seeded, identical every load) and the shared texture and material
// helpers every builder uses.
import * as THREE from 'three';
import { createRng } from './rng.js';

const rng = createRng(90210);
const S = 256;

/** A texture drawn by draw(g) on a fresh w x h canvas; tiled surfaces repeat. */
export function canvasTexture(w, h, draw, repeat = false) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A soft round glow from inner to transparent outer colour (smoke puffs, blasts, bullet holes). */
export const softTexture = (inner, outer) => canvasTexture(64, 64, (g) => {
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, inner); grad.addColorStop(1, outer);
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
});

const cache = {};
/** One shared standard material per look (clone it before animating its colours). */
export function material(color, rough = 0.8, metal = 0, emissive = 0, glow = 0) {
  return (cache[[color, rough, metal, emissive, glow]] ||= new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive, emissiveIntensity: glow }));
}

const paint = (base, draw) => canvasTexture(S, S, (g) => { g.fillStyle = base; g.fillRect(0, 0, S, S); draw(g); }, true);

function speckle(g, count, colors, max) {
  for (let i = 0; i < count; i += 1) {
    g.fillStyle = colors[i % colors.length];
    g.globalAlpha = 0.05 + rng.next() * 0.18;
    const r = 1 + rng.next() * (max - 1);
    g.fillRect(rng.next() * S, rng.next() * S, r, r);
  }
  g.globalAlpha = 1;
}

function stains(g, color, count, alpha) {
  for (let i = 0; i < count; i += 1) {
    const x = rng.next() * S, y = rng.next() * S, r = S * (0.05 + rng.next() * 0.2);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = alpha * (0.4 + rng.next() * 0.6);
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.globalAlpha = 1;
}

function streaks(g, color, count, alpha) {
  g.globalAlpha = alpha;
  for (let i = 0; i < count; i += 1) {
    const x = rng.next() * S, y = rng.next() * S * 0.4, h = S * (0.15 + rng.next() * 0.6);
    const grad = g.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x, y, 1 + rng.next() * 5, h);
  }
  g.globalAlpha = 1;
}

function line(g, style, width, x0, y0, x1, y1) {
  g.strokeStyle = style; g.lineWidth = width;
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
}

// grime shared by every surface: [speckle colours, stain colour, streak colour or '']
const grime = (g, specks, stain, streak) => { speckle(g, 1600, specks, 3); stains(g, stain, 7, 0.28); if (streak) streaks(g, streak, 30, 0.35); };

const painters = {
  concrete: () => paint('#bdb3a4', (g) => {
    grime(g, ['#8f877b', '#d8cfc0', '#a39887'], '#7d7366');
    g.strokeStyle = 'rgba(70,62,54,0.35)'; g.lineWidth = 2; g.strokeRect(1, 1, S - 2, S - 2);
    line(g, 'rgba(70,62,54,0.35)', 2, 0, S / 2, S, S / 2);
  }),
  sand: () => paint('#d4b085', (g) => {
    grime(g, ['#b98f62', '#e8cca2', '#f0dcb8'], '#a77d55');
    for (let i = 0; i < 9; i += 1) { const y = rng.next() * S; line(g, 'rgba(160,120,80,0.18)', 3, 0, y, S, y + rng.signed() * 12); }
  }),
  salt: () => paint('#efe9dd', (g) => {
    grime(g, ['#ffffff', '#d9cfbd'], '#c9a98a');
    g.strokeStyle = 'rgba(150,130,110,0.45)'; g.lineWidth = 1.5;
    for (let i = 0; i < 26; i += 1) {
      const x = rng.next() * S, y = rng.next() * S;
      g.beginPath();
      for (let k = 0; k < 6; k += 1) { const a = k * 1.047 + rng.next() * 0.4, r = 18 + rng.next() * 22; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      g.closePath(); g.stroke();
    }
  }),
  tiles: () => paint('#a8a196', (g) => {
    for (let i = 0; i < 16; i += 1) { const v = 150 + rng.int(30); g.fillStyle = `rgb(${v},${v - 6},${v - 16})`; g.fillRect((i % 4) * 64 + 2, (i >> 2) * 64 + 2, 60, 60); }
    grime(g, ['#6f675d', '#cfc7b8'], '#5d5247');
  }),
  corrugated: () => paint('#ccc', (g) => { // grey ribs: the paint colour comes from the material
    for (let x = 0; x < S; x += 1) { const v = 205 + Math.sin(x / S * Math.PI * 24) * 40; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, S); }
    grime(g, ['#5a2a12', '#e0d6c8'], '#7a3a1a', 'rgba(120,50,20,0.9)');
  }),
  brick: () => paint('#8f8576', (g) => {
    for (let row = 0; row < 16; row += 1) for (let col = -1; col < 5; col += 1) {
      const v = rng.int(26);
      g.fillStyle = `rgb(${205 + v},${186 + v},${160 + v})`;
      g.fillRect(col * 64 + (row % 2) * 32 + 2, row * 16 + 2, 60, 12);
    }
    g.fillStyle = '#2f7478'; g.fillRect(0, S * 0.62, S, S * 0.14);
    grime(g, ['#6b5a48'], '#6b5a48', 'rgba(90,70,50,0.8)');
  }),
  crate: () => paint('#b8834c', (g) => {
    for (let i = 0; i < 6; i += 1) { const v = rng.int(24); g.fillStyle = `rgb(${170 + v},${118 + v},${66 + v})`; g.fillRect(0, i * S / 6 + 1, S, S / 6 - 2); }
    grime(g, ['#7a5230', '#d9a96f'], '#7a5230');
    g.strokeStyle = '#6e4826'; g.lineWidth = 18; g.strokeRect(9, 9, S - 18, S - 18);
    line(g, '#6e4826', 18, 15, 15, S - 15, S - 15);
    g.fillStyle = 'rgba(30,20,12,0.75)';
    g.font = 'bold 26px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('SALTWORKS', S / 2, S * 0.3);
    g.fillText('BRINE 07', S / 2, S * 0.78);
  }),
  steel: () => paint('#e6e0d4', (g) => {
    for (let i = 0; i < 4; i += 1) line(g, 'rgba(120,110,100,0.4)', 2, 0, i * 64, S, i * 64);
    grime(g, ['#a59a8a'], '#9b6a44', 'rgba(150,70,30,0.9)');
  }),
  hazard: () => paint('#e9b23a', (g) => {
    for (let i = -S; i < S * 2; i += 64) line(g, '#26221f', 22, i, 0, i - S, S);
    grime(g, ['#7a6a50', '#fff2cf'], '#7a6a50');
  }),
};

export function createMaterials() {
  const tex = {};
  for (const key of Object.keys(painters)) tex[key] = painters[key]();
  const std = (map, color, rough = 0.9, metal = 0, bump = 0) => new THREE.MeshStandardMaterial({ map, color, roughness: rough, metalness: metal, bumpMap: bump ? map : null, bumpScale: bump });
  return {
    concrete: std(tex.concrete, 0xffffff, 0.93, 0, 1.2),
    perimeter: std(tex.concrete, 0xe7d8c4, 0.95, 0, 1.2),
    sand: std(tex.sand, 0xffffff, 1),
    salt: std(tex.salt, 0xffffff, 0.8),
    tiles: std(tex.tiles, 0xffffff, 0.75),
    rustMetal: std(tex.corrugated, 0xd27448, 0.75, 0.2, 2),
    ochreMetal: std(tex.corrugated, 0xe2c27e, 0.7, 0.2, 2),
    saltMetal: std(tex.corrugated, 0xf1e6d2, 0.75, 0.2, 2),
    hall: std(tex.brick, 0xffffff, 0.9, 0, 1),
    crate: std(tex.crate, 0xffffff, 0.85, 0, 1.5),
    steel: std(tex.steel, 0xffffff, 0.55, 0.35),
    hazard: std(tex.hazard, 0xffffff, 0.8),
    rim: std(tex.salt, 0xd9d0c0, 0.9, 0, 1),
    dark: material(0x2b2d2e, 0.6, 0.6),
    pipe: material(0x3f8f95, 0.45, 0.5),
    pipeRust: material(0xa4552c, 0.6, 0.4),
    barrelBlue: material(0x2c6c8c, 0.5, 0.4),
    barrelRed: material(0xb0432a, 0.55, 0.35),
  };
}

export const signTexture = (lines, bg, fg, w = 512, h = 256) => canvasTexture(w, h, (g) => {
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(12, 12, w - 24, h - 24); }
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const l of lines) {
    g.font = `${l.weight || 800} ${l.size}px system-ui, 'Segoe UI', sans-serif`;
    g.fillText(l.text, w / 2, l.y);
  }
});
