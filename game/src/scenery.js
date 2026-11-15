// Low west sun with soft shadows, sky and ground fill, haze, sky shader, chimneys beyond the walls.
import * as THREE from 'three';
import { PALETTE } from './config.js';
import { material as mat } from './textures.js';

const SUN_DIR = new THREE.Vector3(-0.62, 0.36, -0.7).normalize();

export function buildScenery(scene, renderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.fog = new THREE.Fog(PALETTE.fog, 45, 190);
  scene.background = new THREE.Color(PALETTE.fog);
  scene.add(new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1.25));
  const sun = new THREE.DirectionalLight(PALETTE.sun, 3.4);
  sun.position.copy(SUN_DIR).multiplyScalar(90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -62, right: 62, top: 62, bottom: -62, near: 10, far: 190 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(PALETTE.skyTop) }, horizon: { value: new THREE.Color(PALETTE.skyHorizon) }, sunDir: { value: SUN_DIR } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y, -0.2, 1.0);
        vec3 col = mix(horizon, top, pow(max(h, 0.0), 0.55));
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        col += vec3(1.0, 0.94, 0.82) * (pow(s, 900.0) * 3.0 + pow(s, 24.0) * 0.45 + pow(s, 4.0) * 0.18);
        col = mix(col, horizon * 0.92, smoothstep(0.02, -0.2, h));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sky.renderOrder = -1;
  scene.add(sky);

  const far = mat(0x9c8a7a, 1), rust = mat(0x8a4a2c, 0.9);
  const add = (geo, m, [sx, sy, sz], [x, y, z]) => {
    const o = new THREE.Mesh(geo, m);
    o.scale.set(sx, sy, sz); o.position.set(x, y, z);
    scene.add(o);
  };
  const stack = new THREE.CylinderGeometry(1, 1.3, 1, 12);
  for (const [x, z, h, r] of [[-30, -78, 34, 2.4], [-18, -84, 26, 1.8], [40, -74, 40, 2.6], [70, -10, 22, 5], [78, 16, 18, 6], [-80, 20, 20, 5]]) {
    add(stack, far, [r, h, r], [x, h / 2, z]);
    add(stack, rust, [r * 1.02, 2, r * 1.02], [x, h - 4, z]);
  }
}
