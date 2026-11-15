// A frame: interpolated camera with recoil kick and scope, posed soldiers, effects, two-pass draw.
import * as THREE from 'three';
import { heldItem, eyeHeight } from './actors.js';
import { sideOf } from './state.js';
import { buildWorld } from './world.js';
import { createSoldier } from './soldier.js';
import { createViewModel } from './viewmodel.js';
import { createEffects } from './effects.js';
import { buildScenery } from './scenery.js';

const BASE_FOV = 74;

export function createView(container, state, collision) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / window.innerHeight, 0.05, 700);
  scene.add(camera);
  buildScenery(scene, renderer);
  buildWorld(scene, collision);
  const soldiers = state.actors.map((a) => {
    const s = createSoldier(a);
    scene.add(s.root);
    return s;
  });
  const effects = createEffects(scene);
  const vm = createViewModel(camera.aspect);
  let fov = BASE_FOV;

  function placeCamera(viewer, alpha) {
    const own = viewer.isPlayer && !viewer.bot;
    camera.position.lerpVectors(viewer.prev, viewer.pos, alpha);
    camera.position.y += eyeHeight(viewer);
    const item = heldItem(viewer);
    const share = item ? item.def.recoil.view : 0.5;
    const yaw = own ? viewer.yaw : viewer.prevYaw + (viewer.yaw - viewer.prevYaw) * alpha;
    const pitch = own ? viewer.pitch : viewer.prevPitch + (viewer.pitch - viewer.prevPitch) * alpha;
    camera.rotation.set(pitch + viewer.gun.punchPitch * share, yaw + viewer.gun.punchYaw * share, 0, 'YXZ');
    const scoped = viewer.gun.scoped && item && item.def.scope;
    const target = scoped ? item.def.scope : BASE_FOV;
    if (Math.abs(fov - target) > 0.01) { fov = target; camera.fov = fov; camera.updateProjectionMatrix(); }
  }

  function prepare(viewer, alpha) {
    placeCamera(viewer, alpha);
    camera.updateMatrixWorld();
  }

  function draw(state, alpha, viewer, dt, look) {
    const mySquad = state.player.squad;
    for (let i = 0; i < soldiers.length; i += 1) {
      const a = state.actors[i];
      soldiers[i].update(a, sideOf(state, a), alpha, dt, state.time, a.squad === mySquad);
      soldiers[i].root.visible = a !== viewer;
    }
    effects.update(state, dt, alpha);
    vm.update(viewer, sideOf(state, viewer), look, dt);
    renderer.autoClear = true;
    renderer.render(scene, camera);
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(vm.scene, vm.camera);
  }

  function handle(e, viewer) {
    effects.handle(e, camera);
    if (e.type === 'fire' && e.actor === viewer) vm.fired(e.weapon.kind);
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    vm.resize(camera.aspect);
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function age(state, dt) { effects.update(state, dt, 1); vm.settle(); }

  return { prepare, draw, handle, age, resize, clear: effects.clear, get fov() { return fov; } };
}
