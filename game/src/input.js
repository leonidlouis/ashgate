// Raw input: held keys, mouse buttons and mouse motion under pointer lock; one-shot presses queue.
export function createInput(canvas, onLockChange) {
  const keys = new Set();
  const pressed = [];
  const state = { keys, pressed, fire: false, lookX: 0, lookY: 0, locked: false };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Tab' || (state.locked && (e.code === 'Space' || e.ctrlKey))) e.preventDefault();
    if (!e.repeat) pressed.push(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => { keys.delete(e.code); if (e.code === 'Tab') pressed.push('TabUp'); });
  window.addEventListener('blur', () => { keys.clear(); state.fire = false; });
  canvas.addEventListener('mousedown', (e) => {
    if (!state.locked) return;
    if (e.button === 0) state.fire = true;
    if (e.button === 2) pressed.push('Scope');
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) state.fire = false; });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('mousemove', (e) => {
    if (!state.locked) return;
    state.lookX += e.movementX;
    state.lookY += e.movementY;
  });
  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === canvas;
    if (!state.locked) { state.fire = false; keys.clear(); }
    onLockChange(state.locked);
  });
  return {
    state,
    lock() {
      const request = canvas.requestPointerLock && canvas.requestPointerLock();
      if (request && request.catch) request.catch(() => {}); // refused: the overlay stays up
    },
    unlock() { if (document.pointerLockElement) document.exitPointerLock(); },
    takeLook(out) { out.x = state.lookX; out.y = state.lookY; state.lookX = 0; state.lookY = 0; return out; },
  };
}
