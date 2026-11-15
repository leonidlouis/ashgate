// Synthesised WebAudio: per-weapon shots, steps, clicks, beeps, blasts; panned and distance-dulled.
const CHIMES = { planted: [520, 390], defused: [660, 880], live: [440, 660] };

export function createAudio() {
  let ctx = null, master = null, noise = null;
  const listener = { x: 0, z: 0, yaw: 0 };

  function unlock() {
    if (ctx) { ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.createDynamicsCompressor()).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }

  function play(src, filter, cut, q, gain, attack, decay, pan, at) {
    const t = ctx.currentTime + at, fl = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
    fl.type = filter; fl.frequency.value = cut; fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    p.pan.value = Math.max(-1, Math.min(1, pan));
    src.connect(fl).connect(g).connect(p).connect(master);
    src.start(t);
    src.stop(t + attack + decay + 0.05);
  }
  function hiss(rate, filter, cut, gain, decay, pan = 0, at = 0, q = 0.7, attack = 0.002) {
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.playbackRate.value = 0.7 + rate * 0.3;
    play(src, filter, cut, q, gain, attack, decay, pan, at);
  }
  function tone(f, wave, gain, decay, pan = 0, at = 0, slide = 0, cut = 8000) {
    if (!ctx) return;
    const src = ctx.createOscillator(), t = ctx.currentTime + at;
    src.type = wave;
    src.frequency.setValueAtTime(f, t);
    if (slide) src.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + decay);
    play(src, 'lowpass', cut, 0.7, gain, 0.002, decay, pan, at);
  }

  const where = { pan: 0, near: 1, d: 0 };
  function place(x, z, own) {
    const dx = x - listener.x, dz = z - listener.z, d = own ? 0 : Math.hypot(dx, dz);
    where.d = d;
    where.near = 1 / (1 + d / 9);
    where.pan = d > 0.5 ? (dx * Math.cos(listener.yaw) - dz * Math.sin(listener.yaw)) / d * 0.85 : 0;
    return where;
  }
  const click = (at, cut) => hiss(2, 'bandpass', cut, 0.35, 0.03, 0, at, 4);
  const chime = (a, b) => { tone(a, 'triangle', 0.28, 0.3); tone(b, 'triangle', 0.28, 0.5, 0, 0.22); };

  function handle(e, player) {
    if (!ctx) return;
    const own = e.actor === player;
    const { pan, near, d } = place(e.x, e.z, own);
    switch (e.type) {
      case 'fire': {
        const s = e.weapon.sound;
        if (e.weapon.kind === 'knife') { hiss(2, 'bandpass', 1800, own ? 0.3 : 0.1, 0.12, 0, 0, 1.5); break; }
        hiss(s.pitch, 'lowpass', 1200 + 7000 * near, 0.55 * near * s.body, s.tail, pan);
        tone(140 * s.pitch, 'triangle', 0.5 * near * s.body, 0.12, pan, 0, 0.35);
        hiss(2, 'highpass', 3500, 0.25 * near, 0.04, pan);
        if (d > 20) hiss(0.5, 'lowpass', 500, 0.12, 0.5, pan, d / 340);
        break;
      }
      case 'step': if (near > 0.3) hiss(0.6, 'lowpass', own ? 700 : 600, own ? 0.12 : 0.35 * near, 0.08, pan); break;
      case 'land': if (own) hiss(0.4, 'lowpass', 400, 0.3, 0.12); break;
      case 'reload': if (own) { click(0.15, 1500); click(e.weapon.reload * 0.6, 1100); click(e.weapon.reload * 0.9, 2600); } break;
      case 'dry': case 'draw': case 'pin': if (own) click(0, { dry: 3200, draw: 1800, pin: 4200 }[e.type]); break;
      case 'bounce': tone(900, 'square', 0.08 * near, 0.04, pan); break;
      case 'hurt':
        if (e.other === player && !own) tone(e.flag ? 1900 : 1100, 'sine', 0.18, e.flag ? 0.2 : 0.06);
        if (own) hiss(0.5, 'lowpass', 900, 0.5, 0.15);
        break;
      case 'frag': case 'detonate': {
        const big = e.type === 'detonate' ? 1.6 : 1, loud = Math.min(1, near * 2);
        hiss(0.3, 'lowpass', 900 * big, 0.9 * loud, 1.1 * big, pan);
        tone(60, 'sine', 0.8 * loud, 0.6 * big, pan, 0, 0.4);
        break;
      }
      case 'flash': hiss(3, 'highpass', 2000, 0.5 * near, 0.3, pan); break;
      case 'smoke': hiss(1, 'bandpass', 1200, 0.4 * near, 1.6, pan, 0, 0.7, 0.1); break;
      case 'beep': tone(2300, 'square', 0.08 + 0.12 * near, 0.09, pan, 0, 0, 5000); break;
      case 'roundEnd': tone(330, 'sawtooth', 0.2, 0.9, 0, 0, 0, 1500); break;
      case 'buy': if (own) tone(1250, 'sine', 0.15, 0.08); break;
      default: if (CHIMES[e.type]) chime(...CHIMES[e.type]);
    }
  }

  return {
    unlock, handle,
    ui: () => tone(900, 'sine', 0.1, 0.05),
    setListener(x, z, yaw) { listener.x = x; listener.z = z; listener.yaw = yaw; },
  };
}
