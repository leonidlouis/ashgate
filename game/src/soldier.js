// Low-poly soldiers in side colours (Cinder hoods and goggles, Harbor helmets and visors) with a
// walk cycle, crouch, aim pitch and a death topple.
import * as THREE from 'three';
import { SIDES } from './config.js';
import { signTexture, material } from './textures.js';

const box = new THREE.BoxGeometry(1, 1, 1);
const LOOKS = {
  atk: { armor: SIDES.atk.color, cloth: 0x3a3430, trim: 0x1f1b19, gear: 0xffb347, glow: 0x7a3a00 },
  def: { armor: SIDES.def.color, cloth: 0x22313d, trim: 0x16222b, gear: 0xd8f3f6, glow: 0x0b3a40 },
};
const SKINS = [0xc58c64, 0x8d5a3b, 0xe0b090, 0x6b4630, 0xb07850];
const mat = (color, rough = 0.8, metal = 0, emissive = 0) => material(color, rough, metal, emissive, emissive ? 1.2 : 0);
const GUN = mat(0x2a2b2c, 0.5, 0.6);

// 'pivot role sx sy sz x y z' in centimetres; role picks the material, ':atk'/':def' parts show for one side
const BODY = [
  'torso cloth 42 56 24 0 30 0', 'torso armor 48 42 32 0 36 0',
  'torso trim 36 12 10 0 22 -19', 'torso trim 34 36 16 0 34 24',
  'neck skin 22 25 24 0 12 0', 'neck cloth:atk 27 22 28 0 18 2',
  'neck gear:atk 24 7 6 0 15 -13', 'neck armor:def 29 13 30 0 27 1',
  'neck gear:def 25 8 5 0 16 -14',
  'rArm cloth 12 12 34 0 -8 -14', 'rArm skin 9 9 12 -5 -12 -34',
  'lArm cloth 12 12 40 6 -6 -20', 'lArm skin 9 9 12 12 -6 -44',
  'gun gun 7 10 80 0 0 -20', 'gun gun 5 16 8 0 -10 -5',
  'thigh0 cloth 17 48 19 0 -24 0', 'knee0 cloth 15 44 17 0 -22 0', 'knee0 trim 16 10 27 0 -43 -4',
  'thigh1 cloth 17 48 19 0 -24 0', 'knee1 cloth 15 44 17 0 -22 0', 'knee1 trim 16 10 27 0 -43 -4',
];

export function createSoldier(actor) {
  const root = new THREE.Group();
  const pivot = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const hips = pivot(root, 0, 0.95, 0), torso = pivot(hips, 0, 0, 0), neck = pivot(torso, 0, 0.62, 0), arms = pivot(torso, 0, 0.48, 0);
  const p = { torso, neck, arms, rArm: pivot(arms, 0.25, 0, 0), lArm: pivot(arms, -0.25, 0, 0), gun: pivot(arms, 0.08, -0.1, -0.3) };
  for (const i of [0, 1]) { p['thigh' + i] = pivot(hips, (i ? 1 : -1) * 0.12, 0, 0); p['knee' + i] = pivot(p['thigh' + i], 0, -0.48, 0); }
  const parts = BODY.map((line) => {
    const [where, role, ...n] = line.split(' '), [w, h, d, x, y, z] = n.map((v) => v / 100);
    const m = new THREE.Mesh(box, role === 'skin' ? mat(SKINS[actor.id % 5], 0.7) : GUN);
    m.scale.set(w, h, d); m.position.set(x, y, z);
    m.castShadow = true;
    p[where].add(m);
    return { m, role: role.split(':')[0], only: role.split(':')[1] };
  });
  const barrel = parts[13].m;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTexture([{ text: actor.name, size: 46, weight: 700, y: 64 }], null, '#ffffff', 256, 128), depthTest: false }));
  label.scale.set(1.1, 0.55, 1);
  label.position.y = 2.25;
  label.renderOrder = 5;
  root.add(label);

  let side = '', phase = 0, deadAt = -1;
  function setSide(next) {
    if (next === side) return;
    side = next;
    const look = LOOKS[side];
    for (const { m, role, only } of parts) {
      if (role === 'skin' || role === 'gun') continue;
      m.visible = !only || only === side;
      m.material = role === 'gear' ? mat(look.gear, 0.3, 0.2, look.glow) : mat(look[role], role === 'armor' ? 0.55 : 0.9, role === 'armor' ? 0.15 : 0);
    }
  }

  function update(actor, sideName, alpha, dt, time, friendly) {
    setSide(sideName);
    if (!actor.alive && deadAt < 0) deadAt = time;
    if (actor.alive) deadAt = -1;
    root.visible = true;
    label.visible = friendly && actor.alive && !actor.isPlayer;
    root.position.lerpVectors(actor.prev, actor.pos, alpha);
    root.rotation.set(0, actor.yaw, 0);
    const crouch = actor.crouch, speed = Math.min(1, actor.speed / 5.6);
    phase += dt * (4 + actor.speed * 1.4) * (speed > 0.05 ? 1 : 0);
    const swing = Math.sin(phase) * 0.7 * speed;
    hips.position.y = 0.95 - crouch * 0.42 + Math.abs(Math.cos(phase)) * 0.04 * speed;
    for (let i = 0; i < 2; i += 1) {
      const sgn = i ? -1 : 1;
      p['thigh' + i].rotation.x = sgn * swing + crouch * 1.1;
      p['knee' + i].rotation.x = -Math.max(0, -sgn * Math.sin(phase)) * 0.9 * speed - crouch * 1.9;
    }
    torso.rotation.x = crouch * 0.25;
    arms.rotation.x = actor.pitch - crouch * 0.25;
    neck.rotation.x = actor.pitch * 0.5;
    const kind = actor.primary && actor.slot === 'primary' ? actor.primary.def.kind : '';
    barrel.scale.z = kind === 'marksman' ? 1.2 : kind === 'smg' ? 0.6 : kind ? 0.9 : 0.35;
    if (deadAt >= 0) { // topple sideways from the feet, knees giving way
      const t = Math.min(1, (time - deadAt) / 0.55), ease = t * t * (3 - 2 * t);
      root.rotateZ((actor.id % 2 ? 1 : -1) * ease * 1.45);
      hips.position.y = 0.95 - ease * 0.6;
      p.knee0.rotation.x = p.knee1.rotation.x = -ease * 0.8;
      arms.rotation.x = -ease * 0.9;
      root.position.y = actor.pos.y + 0.12 * ease;
    }
  }

  return { root, update };
}
