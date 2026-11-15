// The one channel from simulation to presentation: a fixed ring of reusable event records.
// The fixed-step sim writes facts (a shot, a hit, a kill, a sound); audio, effects and HUD drain them
// once per rendered frame. Nothing is allocated after start-up.
const SIZE = 512;

export function createEventQueue() {
  const ring = [];
  for (let i = 0; i < SIZE; i += 1) {
    ring.push({ type: '', actor: null, other: null, weapon: null, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, value: 0, flag: false });
  }
  let head = 0;
  let tail = 0;
  return {
    emit(type, actor = null) {
      const e = ring[head];
      head = (head + 1) % SIZE;
      if (head === tail) tail = (tail + 1) % SIZE; // overwrite the oldest when full
      e.type = type; e.actor = actor; e.other = null; e.weapon = null;
      e.x = e.y = e.z = e.nx = e.ny = e.nz = e.value = 0; e.flag = false;
      return e;
    },
    drain(handler) {
      while (tail !== head) {
        handler(ring[tail]);
        tail = (tail + 1) % SIZE;
      }
    },
    clear() { tail = head; },
  };
}
