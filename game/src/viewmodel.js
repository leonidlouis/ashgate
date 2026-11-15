// The gun in your hands, in its own scene and depth pass: weapons from a table, side-coloured
// sleeves, sway, bob, recoil kick, reload dip, draw, slash, wind-up and muzzle flash.
import * as THREE from 'three';
import { canvasTexture, material } from './textures.js';
import { heldItem } from './actors.js';

const SLEEVES = { atk: 0x4a3a30, def: 0x26384a };
const clamp = (v) => Math.max(-0.05, Math.min(0.05, v));
const M = material;
const MATS = { steel: M(0x4a4d52, 0.42, 0.35), tan: M(0xc8a274, 0.8, 0.05), black: M(0x26272a, 0.6, 0.2), wood: M(0x7a4a28, 0.7, 0), teal: M(0x2f7478, 0.5, 0.3), blade: M(0xd8d8d0, 0.2, 0.9), olive: M(0x4a5a3a, 0.7, 0.2), grey: M(0x8a8f92, 0.6, 0.3), cream: M(0xd8d0b0, 0.5, 0.4) };
const GEO = { b: new THREE.BoxGeometry(1, 1, 1), c: new THREE.CylinderGeometry(1, 1, 1, 12), s: new THREE.SphereGeometry(1, 10, 8) };
// kind: [muzzle z, parts...] in centimetres; a part is 'shape material sx sy sz x y z [tilt roll]' with shape
// b box, t barrel tube, c can, s ball, and tilt/roll in radians
const MODELS = {
  rifle: [-82, 'b steel 7 10 42 0 0 -10', 'b tan 7.5 8 26 0 -0.5 -42', 't steel 1.4 30 1.4 0 1 -66',
    'b black 5 20 8.5 0 -14 -16 0.25', 'b tan 6 12 26 0 -4 22', 'b black 4.5 12 6 0 -10 3 -0.3', 'b black 3 5 12 0 7.5 -12'],
  smg: [-47, 'b steel 7 11 34 0 0 -6', 'b teal 7.5 7 14 0 -1 -28', 't steel 1.6 12 1.6 0 1 -40',
    'b black 4.5 22 6 0 -15 -12', 'b black 4.5 12 6 0 -10 6 -0.3', 'b steel 2 2 20 0 -2 20'],
  shotgun: [-78, 'b steel 7.5 10 30 0 0 -2', 't steel 2.2 62 2.2 0 2 -46', 't steel 1.8 50 1.8 0 -3 -42',
    'b wood 8 7.5 20 0 -3.5 -44', 'b wood 6.5 12 30 0 -4 24'],
  marksman: [-86, 'b tan 7.5 10 62 0 -1 2', 't steel 1.6 55 1.6 0 1 -58', 't black 3.2 32 3.2 0 11 -10',
    't black 4.2 6 4.2 0 11 -27', 'b black 5 12 8 0 -10 -6 0.2', 'b steel 6 2 3 6 3 5'],
  pistol: [-17, 'b steel 5 6.5 22 0 2 -5', 'b black 4.5 15 7 0 -7 3 -0.25'],
  knife: [0, 'b black 3.5 4.5 13 0 0 2', 'b blade 0.8 5 24 0 1.2 -16'],
  frag: [0, 's olive 5 6 5 0 0 0'],
  smoke: [0, 'c grey 4 13 4 0 0 0'],
  flash: [0, 'c cream 3.5 12 3.5 0 0 0'],
};

function build(parent, parts, mats = MATS) {
  for (const part of parts) {
    const [shape, mat, ...n] = part.split(' '), [sx, sy, sz, x, y, z] = n.map((v) => v / 100), [tilt = 0, roll = 0] = n.slice(6).map(Number);
    const m = new THREE.Mesh(GEO[shape === 't' ? 'c' : shape], mats[mat]);
    m.scale.set(sx, sy, sz); m.position.set(x, y, z);
    m.rotation.set(shape === 't' ? Math.PI / 2 : tilt, 0, roll);
    parent.add(m);
  }
  return parent;
}

// a six-pointed star of hot light; the gradient lives in the translated space, centred on the muzzle
const flashTexture = () => canvasTexture(128, 128, (g) => {
  g.translate(64, 64);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, 64);
  grad.addColorStop(0, 'rgba(255,250,220,1)'); grad.addColorStop(0.25, 'rgba(255,190,90,0.9)'); grad.addColorStop(1, 'rgba(255,120,30,0)');
  g.fillStyle = grad;
  for (let i = 0; i < 6; i += 1) { g.rotate(Math.PI / 3); g.fillRect(-6, -60, 12, 120); }
  g.beginPath(); g.arc(0, 0, 34, 0, 7); g.fill();
});

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
  const hands = { glove: M(0x2a2622, 0.9, 0), sleeve: M(SLEEVES.atk, 0.9, 0).clone() };
  const right = build(new THREE.Group(), ['b glove 6 8 9 0.5 -9 5', 'b sleeve 8.5 8.5 30 3 -20 12 1.15'], hands);
  const left = build(new THREE.Group(), ['b glove 7 5.5 9 0 -5 0', 'b sleeve 8 8 32 -4 -17 6 1.35 0.25'], hands);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  rig.add(right, left, flash);
  let current = 'pistol', flashTime = 0, kick = 0, swayX = 0, swayY = 0, bob = 0, slash = 0;

  function fired(kind) {
    kick = kind === 'marksman' || kind === 'shotgun' ? 1 : kind === 'knife' ? 0 : 0.55;
    if (kind === 'knife') slash = 1;
    else { flashTime = 0.05; flash.material.rotation += 2.1; }
  }

  /** Pose for the frame from the viewer's soldier state, its side and this frame's mouse motion. */
  function update(actor, side, look, dt) {
    const item = heldItem(actor), gun = actor.gun;
    models[current].visible = false;
    current = item ? item.def.kind : actor.grenadeType;
    models[current].visible = true;
    left.visible = MODELS[current].length > 3; // two-handed guns only
    left.position.set(0, -0.01, current === 'shotgun' ? -0.44 : current === 'smg' ? -0.27 : -0.4);
    hands.sleeve.color.setHex(SLEEVES[side]);
    rig.visible = !gun.scoped && actor.alive;
    const ease = Math.min(1, dt * 10);
    swayX = clamp(swayX + (-look.x * 0.0009 - swayX) * ease);
    swayY = clamp(swayY + (look.y * 0.0009 - swayY) * ease);
    const moving = actor.onGround ? Math.min(1, actor.speed / 5.6) : 0;
    bob += dt * (6 + actor.speed * 1.2) * (moving > 0.05 ? 1 : 0.2);
    kick = Math.max(0, kick - dt * 7);
    slash = Math.max(0, slash - dt * 3.5);
    flashTime -= dt;
    const dip = gun.reload > 0 ? Math.sin(Math.min(1, 1 - gun.reload / item.def.reload) * Math.PI) : 0;
    // hands drop while drawing, and while planting or defusing
    const raise = Math.max(0, gun.draw, actor.input.use && actor.speed < 1 ? 0.3 : 0) / 0.5, wind = gun.throwing > 0 ? 1 : 0;
    rig.position.set(0.2 + swayX + Math.cos(bob) * 0.012 * moving, -0.2 + swayY - Math.abs(Math.sin(bob)) * 0.014 * moving - dip * 0.12 - raise * 0.25 + wind * 0.08, -0.44 + kick * 0.07);
    rig.rotation.set(kick * 0.12 + gun.punchPitch * 0.6 - dip * 0.6 - raise * 0.6 + wind * 0.9, swayX * 2 - slash * 1.2, dip * 0.5 + slash * 0.6);
    const muzzle = MODELS[current][0] / 100;
    flash.position.set(0, 0.01, muzzle);
    flash.visible = flashTime > 0 && muzzle < 0;
    flash.scale.setScalar(current === 'shotgun' || current === 'marksman' ? 0.32 : 0.22);
  }

  function resize(a) { camera.aspect = a; camera.updateProjectionMatrix(); }
  function settle() { flashTime = kick = slash = 0; }
  return { scene, camera, update, fired, resize, settle };
}
