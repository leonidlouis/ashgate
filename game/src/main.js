// Boot and the one loop. The simulation advances in fixed 60 Hz ticks from an accumulator; the
// renderer draws once per display frame, blending the last two ticks. Events written by the sim are
// drained once a frame into effects, audio and the HUD.
// ?shot=play|buy|site|end&seed=N runs the same game deterministically to a staged moment and freezes
// it for a screenshot (see shots.js); without it the game starts at the title screen.
import { TICK, MAX_STEPS_PER_FRAME } from './config.js';
import { createState } from './state.js';
import { createCollision } from './collision.js';
import { createNav } from './nav.js';
import { siteAt } from './mapdata.js';
import { createBrain } from './brain.js';
import { initGrenades } from './grenades.js';
import { startMatch } from './rounds.js';
import { stepSim } from './sim.js';
import { createInput } from './input.js';
import { createPlayerController } from './player.js';
import { createHud } from './hud.js';
import { createScreens } from './screens.js';
import { createMinimap } from './minimap.js';
import { loadSettings, saveSettings } from './settings.js';
import { createView } from './render.js';
import { createAudio } from './audio.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '', 10) || (shot ? 1 : (Date.now() % 100000) + 1);
const settings = loadSettings();

const state = createState(seed, shot ? 'veteran' : settings.difficulty);
const collision = createCollision();
const ctx = { collision, nav: createNav(), siteAt };
for (const a of state.actors) if (!a.isPlayer) a.bot = createBrain();
initGrenades(state);
startMatch(state);

const view = createView(document.getElementById('game'), state, collision);
const hud = createHud();
const minimap = createMinimap(document.getElementById('minimap'));
const audio = createAudio();
audio.setVolume(settings.volume);
const input = createInput(document.querySelector('#game canvas'), onLockChange);
const controller = createPlayerController(input, settings);
const screens = createScreens(state, {
  settings,
  saveSettings() { saveSettings(settings); state.difficulty = settings.difficulty; audio.setVolume(settings.volume); },
  play,
  restart,
  ui: () => audio.ui(),
});

let mode = 'title'; // title | playing | paused | over | shot
let accumulator = 0;
let last = performance.now();
const noLook = { x: 0, y: 0 };
const frameInfo = { viewer: state.player, fov: 74, height: 720, onSite: false, shot: !!shot }; // reused every frame

function play() {
  audio.unlock();
  audio.ui();
  input.lock();
}

function restart() {
  startMatch(state);
  view.clear();
  screens.hideEnd();
  state.events.clear();
  mode = 'paused';
  play();
}

function onLockChange(locked) {
  if (mode === 'shot') return;
  if (locked) {
    mode = 'playing';
    screens.hideTitle();
    screens.setBuy(false);
  } else if (mode === 'playing' && !screens.buyOpen) {
    mode = 'paused';
    screens.showTitle(true);
  }
}

/** Whose eyes the camera uses: yours, or a living squadmate's once you are down. */
function viewerOf() {
  const me = state.player;
  if (me.alive || state.round.phase === 'freeze') return me;
  for (const a of state.actors) if (a.alive && a.squad === me.squad) return a;
  return me;
}

function handlePresses() {
  const pressed = input.state.pressed;
  for (const code of pressed) {
    if (code === 'KeyB') {
      if (screens.buyOpen) { screens.setBuy(false); input.lock(); } else if (screens.setBuy(true)) input.unlock();
    } else if (code === 'Escape' && screens.buyOpen) {
      screens.setBuy(false); input.lock();
    } else if (code === 'Tab') screens.showBoard(true);
    else if (code === 'TabUp') screens.showBoard(false);
    else if (screens.buyOpen && /^Digit\d$/.test(code)) screens.buyByIndex((+code.slice(5) + 9) % 10);
    else controller.press(state.player, code);
  }
  pressed.length = 0;
}

function deliver(e) {
  view.handle(e, frameInfo.viewer);
  hud.handle(e, state, frameInfo.viewer);
  audio.handle(e, frameInfo.viewer);
}

function drain(viewer) {
  frameInfo.viewer = viewer;
  state.events.drain(deliver);
}

function present(dt, look) {
  const viewer = viewerOf();
  const alpha = mode === 'shot' ? 1 : accumulator / TICK;
  view.prepare(viewer, alpha);
  drain(viewer);
  audio.setListener(viewer.pos.x, viewer.pos.z, viewer.yaw);
  frameInfo.fov = view.fov;
  frameInfo.height = window.innerHeight;
  frameInfo.onSite = !!siteAt(state.player.pos.x, state.player.pos.z);
  hud.update(state, frameInfo);
  minimap.draw(state, viewer);
  view.draw(state, alpha, viewer, dt, look);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  let look = noLook;
  if (mode === 'playing') {
    handlePresses();
    if (!screens.buyOpen) look = controller.look(state.player);
    accumulator += dt;
    let steps = 0;
    while (accumulator >= TICK && steps < MAX_STEPS_PER_FRAME) {
      if (screens.buyOpen) state.player.input.fwd = state.player.input.side = 0;
      else controller.intent(state.player);
      stepSim(state, ctx);
      accumulator -= TICK;
      steps += 1;
    }
    if (accumulator > TICK * MAX_STEPS_PER_FRAME) accumulator = 0;
    screens.update(-1);
    if (state.round.phase === 'over') {
      mode = 'over';
      screens.setBuy(false);
      input.unlock();
      screens.showEnd();
    }
  } else {
    input.state.pressed.length = 0;
  }
  present(dt, look);
}

window.addEventListener('resize', () => view.resize());

if (shot) {
  mode = 'shot';
  screens.hideTitle();
  // the staging code is only fetched for screenshots; normal play never loads it
  const { runShot } = await import('./shots.js');
  runShot(shot, {
    state, ctx, screens, present,
    step: () => stepSim(state, ctx),
    drain() { const viewer = viewerOf(); view.prepare(viewer, 1); drain(viewer); view.age(state, 0.25); },
  });
} else {
  requestAnimationFrame(frame);
}
