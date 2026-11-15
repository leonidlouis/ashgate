// Keyboard and mouse into the same input record a bot fills.
import { heldItem } from './actors.js';
import { switchTo } from './combat.js';

const SLOT_KEYS = { Digit1: 'primary', Digit2: 'secondary', Digit3: 'knife', Digit4: 'grenade' };
const look = { x: 0, y: 0 };

export function createPlayerController(input, settings) {
  const keys = input.state.keys;
  const axis = (plus, minus) => (keys.has(plus) ? 1 : 0) - (keys.has(minus) ? 1 : 0);
  return {
    look(actor) {
      input.takeLook(look);
      if (!actor.alive) return look;
      const k = 0.0022 * settings.sensitivity * (actor.gun.scoped ? 0.35 : 1);
      actor.yaw -= look.x * k;
      actor.pitch = Math.max(-1.5, Math.min(1.5, actor.pitch - look.y * k));
      return look;
    },
    intent(actor) {
      const i = actor.input;
      i.fwd = axis('KeyW', 'KeyS');
      i.side = axis('KeyD', 'KeyA');
      i.jump = keys.has('Space');
      i.crouch = keys.has('ControlLeft') || keys.has('KeyC');
      i.walk = keys.has('ShiftLeft') || keys.has('ShiftRight');
      i.fire = input.state.fire;
      i.reload = keys.has('KeyR');
      i.use = keys.has('KeyE');
    },
    press(actor, code) {
      if (SLOT_KEYS[code]) switchTo(actor, SLOT_KEYS[code]);
      if (code === 'Scope') {
        const item = heldItem(actor);
        if (item && item.def.kind === 'marksman' && actor.gun.reload <= 0) actor.gun.scoped = !actor.gun.scoped;
      }
    },
  };
}
