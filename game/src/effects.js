// Pooled visuals fed by sim events: tracers, sparks, blood, holes, smoke, blasts, grenades, charge.
import * as THREE from 'three';
import { softTexture, material } from './textures.js';

const PARTICLES = 384;
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

export function createEffects(scene) {
  const pool = (n, make) => Array.from({ length: n }, () => { const o = make(); o.visible = false; o.userData.life = 0; scene.add(o); return o; });
  const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false };
  const tracerGeo = new THREE.BoxGeometry(0.011, 0.011, 1).translate(0, 0, -0.5);
  const tracers = pool(32, () => new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ color: 0xffc070, ...additive })));
  const holeMat = new THREE.MeshBasicMaterial({ map: softTexture('rgba(20,16,12,0.95)', 'rgba(40,30,20,0)'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  const holeGeo = new THREE.PlaneGeometry(0.12, 0.12);
  const holes = pool(72, () => new THREE.Mesh(holeGeo, holeMat));
  const puffTex = softTexture('rgba(235,225,210,0.95)', 'rgba(235,225,210,0)');
  const puffs = pool(4 * 14, () => new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: 0xd9d2c6, transparent: true, depthWrite: false })));
  const blastTex = softTexture('rgba(255,240,200,1)', 'rgba(255,120,30,0)');
  const blasts = pool(4, () => new THREE.Sprite(new THREE.SpriteMaterial({ map: blastTex, ...additive })));
  const nadeGeo = new THREE.SphereGeometry(0.07, 8, 6);
  const nadeMat = material(0x3d4a33, 0.6);
  const nades = pool(12, () => new THREE.Mesh(nadeGeo, nadeMat));
  // lights stay in the scene, dark until needed, so shaders never recompile
  const blastLight = new THREE.PointLight(0xffa850, 0, 30, 2);
  const muzzleLight = new THREE.PointLight(0xffc070, 0, 9, 2);
  const chargeLight = new THREE.PointLight(0xff3010, 0, 6, 2);
  scene.add(blastLight, muzzleLight, chargeLight);
  let particleHead = 0, beaconTime = 0;
  const next = (list) => list[list.head = ((list.head || 0) + 1) % list.length];

  const pos = new Float32Array(PARTICLES * 3).fill(-999);
  const col = new Float32Array(PARTICLES * 3);
  const vel = new Float32Array(PARTICLES * 3);
  const life = new Float32Array(PARTICLES);
  const cloud = new THREE.BufferGeometry();
  cloud.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  cloud.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const points = new THREE.Points(cloud, new THREE.PointsMaterial({ size: 0.07, vertexColors: true, transparent: true, depthWrite: false }));
  points.frustumCulled = false;
  scene.add(points);
  function burst(x, y, z, nx, ny, nz, n, r, g, b, speed, heavy) {
    for (let i = 0; i < n; i += 1) {
      const k = particleHead * 3;
      particleHead = (particleHead + 1) % PARTICLES;
      const j = (i * 7919) % 97 / 97, h = (i * 104729) % 89 / 89, q = (i * 1299709) % 83 / 83;
      pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
      vel[k] = (nx + (j - 0.5) * 1.6) * speed; vel[k + 1] = (ny + (h - 0.2) * 1.4) * speed; vel[k + 2] = (nz + (q - 0.5) * 1.6) * speed;
      col[k] = r; col[k + 1] = g; col[k + 2] = b;
      life[k / 3] = heavy ? 0.5 + j * 0.3 : 0.25 + j * 0.2;
    }
  }

  const charge = new THREE.Group();
  const beaconMat = material(0x400808, 0.65, 0, 0xff2a10).clone();
  for (const [w, h, d, x, y, m] of [[0.42, 0.16, 0.3, 0, 0.08, material(0x3b3229)], [0.44, 0.17, 0.06, 0, 0.08, material(0xf07a2a)], [0.08, 0.06, 0.08, 0.1, 0.19, beaconMat], [0.16, 0.02, 0.1, -0.08, 0.165, material(0x102010, 0.8, 0, 0x40ff60, 0.8)]]) {
    const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    part.position.set(x, y, 0);
    part.castShadow = true;
    charge.add(part);
  }
  charge.visible = false;
  scene.add(charge);

  function tracer(from, x, y, z) {
    const m = next(tracers);
    m.position.copy(from);
    m.lookAt(tmp.set(x, y, z));
    m.scale.set(1, 1, tmp.distanceTo(from));
    m.visible = true;
    m.userData.life = 0.07;
  }

  function blast(x, y, z, size, duration, light) {
    const sp = next(blasts);
    sp.position.set(x, y + 0.5, z);
    Object.assign(sp.userData, { life: duration, max: duration, size });
    sp.visible = true;
    blastLight.position.set(x, y + 1, z);
    blastLight.intensity = light;
  }

  function muzzleOf(actor, camera, out) {
    if (actor.isPlayer) return out.set(0.16, -0.14, -0.75).applyMatrix4(camera.matrixWorld);
    const s = Math.sin(actor.yaw), c = Math.cos(actor.yaw);
    return out.set(actor.pos.x - s * 0.7 + c * 0.1, actor.pos.y + 1.35 - actor.crouch * 0.45, actor.pos.z - c * 0.7 - s * 0.1);
  }

  function handle(e, camera) {
    switch (e.type) {
      case 'tracer':
        muzzleOf(e.actor, camera, tmp2);
        // your own tracer starts 3 m out, a streak rather than a beam across the screen
        if (e.actor.isPlayer) tmp2.lerp(tmp.set(e.x, e.y, e.z), Math.min(0.5, 3 / Math.max(3, tmp2.distanceTo(tmp))));
        tracer(tmp2, e.x, e.y, e.z);
        break;
      case 'fire':
        if (e.weapon.kind === 'knife') break;
        muzzleLight.position.copy(muzzleOf(e.actor, camera, tmp2));
        muzzleLight.intensity = e.actor.isPlayer ? 6 : 4;
        break;
      case 'impact': {
        const m = next(holes);
        m.position.set(e.x + e.nx * 0.012, e.y + e.ny * 0.012, e.z + e.nz * 0.012);
        m.lookAt(tmp.set(e.x + e.nx, e.y + e.ny, e.z + e.nz));
        m.visible = true;
        burst(e.x, e.y, e.z, e.nx, e.ny, e.nz, 6, 1, 0.8, 0.45, 3, true);
        burst(e.x, e.y, e.z, e.nx, e.ny, e.nz, 4, 0.75, 0.68, 0.58, 1.2, false);
        break;
      }
      case 'blood': burst(e.x, e.y, e.z, 0, 0.3, 0, e.flag ? 14 : 8, 0.55, 0.06, 0.04, 1.8, true); break;
      case 'frag': blast(e.x, e.y, e.z, 7, 0.45, 40); burst(e.x, e.y + 0.3, e.z, 0, 1, 0, 40, 1, 0.65, 0.3, 7, true); break;
      case 'flash': blast(e.x, e.y, e.z, 5, 0.2, 60); break;
      case 'detonate': blast(e.x, e.y, e.z, 26, 1.2, 120); burst(e.x, e.y + 0.5, e.z, 0, 1, 0, 90, 1, 0.6, 0.25, 12, true); break;
      case 'beep': beaconTime = 0.12; break;
      default: break;
    }
  }

  function update(state, dt, alpha) {
    for (const m of tracers) {
      if (!m.visible) continue;
      m.userData.life -= dt;
      m.material.opacity = Math.max(0, m.userData.life / 0.07) * 0.75;
      m.visible = m.userData.life > 0;
    }
    for (let k = 0; k < PARTICLES; k += 1) {
      if (life[k] <= 0) continue;
      life[k] -= dt;
      const i = k * 3;
      vel[i + 1] -= 9 * dt;
      pos[i] += vel[i] * dt; pos[i + 1] += vel[i + 1] * dt; pos[i + 2] += vel[i + 2] * dt;
      if (life[k] <= 0) pos[i + 1] = -999;
    }
    cloud.attributes.position.needsUpdate = true;
    cloud.attributes.color.needsUpdate = true;
    for (const sp of blasts) {
      if (!sp.visible) continue;
      const u = sp.userData;
      u.life -= dt;
      const t = 1 - u.life / u.max;
      sp.scale.setScalar(u.size * (0.4 + t));
      sp.material.opacity = 1 - t;
      sp.visible = u.life > 0;
    }
    blastLight.intensity = Math.max(0, blastLight.intensity - dt * 200);
    muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 120);
    for (let p = 0; p < puffs.length; p += 1) {
      const s = state.smokes[(p / 14) | 0], sp = puffs[p];
      sp.visible = s.active && s.radius > 0.2;
      if (!sp.visible) continue;
      const a = p * 2.4 + state.time * 0.05, ring = (p % 3 + 1) / 3 * s.radius * 0.6;
      sp.position.set(s.pos.x + Math.cos(a) * ring, s.pos.y + 0.6 + (p % 4) * 0.12 * s.radius, s.pos.z + Math.sin(a) * ring);
      sp.scale.setScalar(s.radius * 1.15);
      sp.material.opacity = Math.min(0.9, s.radius / 3);
    }
    for (let i = 0; i < nades.length; i += 1) {
      const g = state.grenades[i];
      nades[i].visible = g.active;
      if (g.active) nades[i].position.lerpVectors(g.prev, g.pos, alpha);
    }
    const c = state.charge;
    const planted = c.state === 'planted';
    charge.visible = planted || c.state === 'dropped' || c.state === 'defused';
    charge.position.copy(c.pos);
    beaconTime -= dt;
    beaconMat.emissiveIntensity = planted ? (beaconTime > 0 ? 6 : 0.6) : 0;
    chargeLight.position.set(c.pos.x, c.pos.y + 0.4, c.pos.z);
    chargeLight.intensity = planted && beaconTime > 0 ? 3 : 0;
  }

  function clear() {
    for (const m of holes) m.visible = false;
    for (const m of tracers) m.visible = false;
    life.fill(0);
    pos.fill(-999);
  }

  return { handle, update, clear };
}
