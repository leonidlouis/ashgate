// The sim-to-presentation channel: a fixed ring of reusable event records.
const SIZE = 512;

export function createEventQueue() {
  const ring = Array.from({ length: SIZE }, () => ({ type: '', actor: null, other: null, weapon: null, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, value: 0, flag: false }));
  let head = 0, tail = 0;
  return {
    emit(type, actor = null, at = null) {
      const e = ring[head];
      head = (head + 1) % SIZE;
      if (head === tail) tail = (tail + 1) % SIZE;
      e.type = type; e.actor = actor; e.other = e.weapon = null;
      e.x = at ? at.x : 0; e.y = at ? at.y : 0; e.z = at ? at.z : 0;
      e.nx = e.ny = e.nz = e.value = 0; e.flag = false;
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
