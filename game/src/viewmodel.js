// The gun in your hands, drawn in its own scene and depth pass so it never sinks into a wall.
// Weapons are a few boxes and cylinders from a table; gloves and sleeves follow your side.
// Motion: mouse sway, walk bob, a kick per shot with the recoil, reload dip, draw raise,
// knife slash, grenade wind-up, and a muzzle flash.
import * as THREE from 'three';

const SLEEVES = { atk: 0x4a3a30, def: 0x26384a };
const clamp = (v) => Math.max(-0.05, Math.min(0.05, v));
const M = (color, rough = 0.5, metal = 0.5) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
const MATS = { steel: M(0x4a4d52, 0.42, 0.35), tan: M(0xc8a274, 0.8, 0.05), black: M(0x26272a, 0.6, 0.2), wood: M(0x7a4a28, 0.7, 0), teal: M(0x2f7478, 0.5, 0.3), blade: M(0xd8d8d0, 0.2, 0.9), olive: M(0x4a5a3a, 0.7, 0.2), grey: M(0x8a8f92, 0.6, 0.3), cream: M(0xd8d0b0, 0.5, 0.4) };
const GEO = { b: new THREE.BoxGeometry(1, 1, 1), c: new THREE.CylinderGeometry(1, 1, 1, 12), s: new THREE.SphereGeometry(1, 10, 8) };
// kind: [muzzle z, parts...]; part: [shape (b box, t barrel tube, c can, s ball), material, sx, sy, sz, x, y, z, tilt]
const MODELS = {
  rifle: [-0.82, ['b', 'steel', 0.07, 0.1, 0.42, 0, 0, -0.1], ['b', 'tan', 0.075, 0.08, 0.26, 0, -0.005, -0.42], ['t', 'steel', 0.014, 0.3, 0.014, 0, 0.01, -0.66],
    ['b', 'black', 0.05, 0.2, 0.085, 0, -0.14, -0.16, 0.25], ['b', 'tan', 0.06, 0.12, 0.26, 0, -0.04, 0.22], ['b', 'black', 0.045, 0.12, 0.06, 0, -0.1, 0.03, -0.3], ['b', 'black', 0.03, 0.05, 0.12, 0, 0.075, -0.12]],
  smg: [-0.47, ['b', 'steel', 0.07, 0.11, 0.34, 0, 0, -0.06], ['b', 'teal', 0.075, 0.07, 0.14, 0, -0.01, -0.28], ['t', 'steel', 0.016, 0.12, 0.016, 0, 0.01, -0.4],
    ['b', 'black', 0.045, 0.22, 0.06, 0, -0.15, -0.12], ['b', 'black', 0.045, 0.12, 0.06, 0, -0.1, 0.06, -0.3], ['b', 'steel', 0.02, 0.02, 0.2, 0, -0.02, 0.2]],
  shotgun: [-0.78, ['b', 'steel', 0.075, 0.1, 0.3, 0, 0, -0.02], ['t', 'steel', 0.022, 0.62, 0.022, 0, 0.02, -0.46], ['t', 'steel', 0.018, 0.5, 0.018, 0, -0.03, -0.42],
    ['b', 'wood', 0.08, 0.075, 0.2, 0, -0.035, -0.44], ['b', 'wood', 0.065, 0.12, 0.3, 0, -0.04, 0.24]],
  marksman: [-0.86, ['b', 'tan', 0.075, 0.1, 0.62, 0, -0.01, 0.02], ['t', 'steel', 0.016, 0.55, 0.016, 0, 0.01, -0.58], ['t', 'black', 0.032, 0.32, 0.032, 0, 0.11, -0.1],
    ['t', 'black', 0.042, 0.06, 0.042, 0, 0.11, -0.27], ['b', 'black', 0.05, 0.12, 0.08, 0, -0.1, -0.06, 0.2], ['b', 'steel', 0.06, 0.02, 0.03, 0.06, 0.03, 0.05]],
  pistol: [-0.17, ['b', 'steel', 0.05, 0.065, 0.22, 0, 0.02, -0.05], ['b', 'black', 0.045, 0.15, 0.07, 0, -0.07, 0.03, -0.25]],
  knife: [0, ['b', 'black', 0.035, 0.045, 0.13, 0, 0, 0.02], ['b', 'blade', 0.008, 0.05, 0.24, 0, 0.012, -0.16]],
  frag: [0, ['s', 'olive', 0.05, 0.06, 0.05, 0, 0, 0]],
  smoke: [0, ['c', 'grey', 0.04, 0.13, 0.04, 0, 0, 0]],
  flash: [0, ['c', 'cream', 0.035, 0.12, 0.035, 0, 0, 0]],
};

function build(parent, parts, mats = MATS) {
  for (const [shape, mat, sx, sy, sz, x, y, z, tilt = 0, roll = 0] of parts) {
    const m = new THREE.Mesh(GEO[shape === 't' ? 'c' : shape], mats[mat]);
    m.scale.set(sx, sy, sz); m.position.set(x, y, z);
    m.rotation.set(shape === 't' ? Math.PI / 2 : tilt, 0, roll);
    parent.add(m);
  }
  return parent;
}

function flashTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.translate(64, 64); // the gradient lives in the translated space, centred on the muzzle
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, 64);
  grad.addColorStop(0, 'rgba(255,250,220,1)');
  grad.addColorStop(0.25, 'rgba(255,190,90,0.9)');
  grad.addColorStop(1, 'rgba(255,120,30,0)');
  g.fillStyle = grad;
  for (let i = 0; i < 6; i += 1) { g.rotate(Math.PI / 3); g.fillRect(-6, -60, 12, 120); }
  g.beginPath(); g.arc(0, 0, 34, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createViewModel(aspect) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(64, aspect, 0.01, 10);
  const key = new THREE.DirectionalLight(0xffd29a, 2.4);
  key.position.set(-1, 1.2, 0.6);
  scene.add(new THREE.HemisphereLight(0xbfd8e6, 0x8a6a4a, 1.7), key);
  const rig = new THREE.Group();
  rig.scale.setScalar(0.75);
  scene.add(rig);
  const models = {};
  for (const kind of Object.keys(MODELS)) { models[kind] = build(new THREE.Group(), MODELS[kind].slice(1)); models[kind].visible = false; rig.add(models[kind]); }
  // gloves on grip and fore-end; forearms run down and back out of frame, never through the camera
  const hands = { glove: M(0x2a2622, 0.9, 0), sleeve: M(SLEEVES.atk, 0.9, 0) };
  const right = build(new THREE.Group(), [['b', 'glove', 0.06, 0.08, 0.09, 0.005, -0.09, 0.05], ['b', 'sleeve', 0.085, 0.085, 0.3, 0.03, -0.2, 0.12, 1.15]], hands);
  const left = build(new THREE.Group(), [['b', 'glove', 0.07, 0.055, 0.09, 0, -0.05, 0], ['b', 'sleeve', 0.08, 0.08, 0.32, -0.04, -0.17, 0.06, 1.35, 0.25]], hands);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  rig.add(right, left, flash);
  let current = 'pistol', flashTime = 0, kick = 0, swayX = 0, swayY = 0, bob = 0, slash = 0;

  function fired(kind) {
    kick = kind === 'marksman' || kind === 'shotgun' ? 1 : kind === 'knife' ? 0 : 0.55;
    if (kind === 'knife') slash = 1;
    else { flashTime = 0.05; flash.material.rotation += 2.1; }
  }

  /** Pose for the frame from info { kind, side, speed, onGround, crouch, reload, reloadTotal, draw, throwing, lookX, lookY, punch, scoped }. */
  function update(info, dt) {
    models[current].visible = false;
    current = info.kind;
    models[current].visible = true;
    left.visible = MODELS[current].length > 3; // two-handed guns only
    left.position.set(0, -0.01, current === 'shotgun' ? -0.44 : current === 'smg' ? -0.27 : -0.4);
    hands.sleeve.color.setHex(SLEEVES[info.side]);
    rig.visible = !info.scoped;
    const ease = Math.min(1, dt * 10);
    swayX = clamp(swayX + (-info.lookX * 0.0009 - swayX) * ease);
    swayY = clamp(swayY + (info.lookY * 0.0009 - swayY) * ease);
    const moving = info.onGround ? Math.min(1, info.speed / 5.6) : 0;
    bob += dt * (6 + info.speed * 1.2) * (moving > 0.05 ? 1 : 0.2);
    kick = Math.max(0, kick - dt * 7);
    slash = Math.max(0, slash - dt * 3.5);
    flashTime -= dt;
    const dip = info.reload > 0 ? Math.sin(Math.min(1, 1 - info.reload / info.reloadTotal) * Math.PI) : 0;
    const raise = Math.max(0, info.draw) / 0.5, wind = info.throwing > 0 ? 1 : 0;
    rig.position.set(0.2 + swayX + Math.cos(bob) * 0.012 * moving, -0.2 + swayY - Math.abs(Math.sin(bob)) * 0.014 * moving - dip * 0.12 - raise * 0.25 + wind * 0.08, -0.44 + kick * 0.07);
    rig.rotation.set(kick * 0.12 + info.punch * 0.6 - dip * 0.6 - raise * 0.6 + wind * 0.9, swayX * 2 - slash * 1.2, dip * 0.5 + slash * 0.6);
    const muzzle = MODELS[current][0];
    flash.position.set(0, 0.01, muzzle);
    flash.visible = flashTime > 0 && muzzle < 0;
    flash.scale.setScalar(current === 'shotgun' || current === 'marksman' ? 0.32 : 0.22);
  }

  function resize(a) { camera.aspect = a; camera.updateProjectionMatrix(); }
  /** Drop any flash or kick (time skipped while fast-forwarding a screenshot). */
  function settle() { flashTime = kick = slash = 0; }
  return { scene, camera, update, fired, resize, settle };
}
