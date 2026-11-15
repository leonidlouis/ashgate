// Every sound is synthesised with WebAudio: filtered noise and oscillators shaped per weapon,
// footsteps, reload clicks, the charge's beeps, blasts and UI ticks. Sounds pan by direction from
// the listener and dull with distance. The context is created on the first click only.
export function createAudio() {
  let ctx = null, master = null, noise = null, volume = 0.7;
  const listener = { x: 0, z: 0, yaw: 0 };

  function unlock() {
    if (ctx) { ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.createDynamicsCompressor()).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0, seed = 7; i < data.length; i += 1) { seed = (seed * 16807) % 2147483647; data[i] = seed / 1073741823.5 - 1; }
  }

  // one voice: noise (n) or a tone (f, wave) through a filter, an envelope and a panner
  function voice({ f = 0, wave = 'sine', n = 0, filter = 'lowpass', cut = 8000, q = 0.7, gain = 0.5, attack = 0.002, decay = 0.2, pan = 0, at = 0, slide = 0 }) {
    if (!ctx) return;
    const t = ctx.currentTime + at;
    let src;
    if (n) { src = ctx.createBufferSource(); src.buffer = noise; src.playbackRate.value = 0.7 + n * 0.3; } else {
      src = ctx.createOscillator();
      src.type = wave;
      src.frequency.setValueAtTime(f, t);
      if (slide) src.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + decay);
    }
    const fl = ctx.createBiquadFilter();
    fl.type = filter; fl.frequency.value = cut; fl.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    src.connect(fl).connect(g).connect(p).connect(master);
    src.start(t);
    src.stop(t + attack + decay + 0.05);
  }

  // where a sound sits for the listener: pan by its bearing, loudness and brightness by distance
  const where = { pan: 0, near: 1, d: 0 };
  function place(x, z, own) {
    const dx = x - listener.x, dz = z - listener.z, d = own ? 0 : Math.hypot(dx, dz);
    where.d = d;
    where.near = 1 / (1 + d / 9);
    where.pan = d > 0.5 ? (dx * Math.cos(listener.yaw) - dz * Math.sin(listener.yaw)) / d * 0.85 : 0;
    return where;
  }
  const click = (at, cut) => voice({ n: 2, filter: 'bandpass', cut, q: 4, gain: 0.35, decay: 0.03, at });
  const chime = (a, b) => { voice({ f: a, wave: 'triangle', gain: 0.28, decay: 0.3 }); voice({ f: b, wave: 'triangle', gain: 0.28, decay: 0.5, at: 0.22 }); };

  function handle(e, player) {
    if (!ctx) return;
    const own = e.actor === player;
    const { pan, near, d } = place(e.x, e.z, own);
    switch (e.type) {
      case 'fire': {
        const s = e.weapon.sound;
        if (e.weapon.kind === 'knife') { voice({ n: 2, filter: 'bandpass', cut: 1800, q: 1.5, gain: own ? 0.3 : 0.1, decay: 0.12 }); break; }
        voice({ n: s.pitch, cut: 1200 + 7000 * near, gain: 0.55 * near * s.body, decay: s.tail, pan });
        voice({ f: 140 * s.pitch, wave: 'triangle', slide: 0.35, gain: 0.5 * near * s.body, decay: 0.12, pan });
        voice({ n: 2, filter: 'highpass', cut: 3500, gain: 0.25 * near, decay: 0.04, pan });
        if (d > 20) voice({ n: 0.5, cut: 500, gain: 0.12, decay: 0.5, pan, at: d / 340 }); // the echo off the far walls
        break;
      }
      case 'step': if (near > 0.3) voice({ n: 0.6, cut: own ? 700 : 600, gain: own ? 0.12 : 0.35 * near, decay: 0.08, pan }); break;
      case 'land': if (own) voice({ n: 0.4, cut: 400, gain: 0.3, decay: 0.12 }); break;
      case 'reload': if (own) { click(0.15, 1500); click(e.weapon.reload * 0.6, 1100); click(e.weapon.reload * 0.9, 2600); } break;
      case 'dry': case 'draw': case 'pin': if (own) click(0, { dry: 3200, draw: 1800, pin: 4200 }[e.type]); break;
      case 'bounce': voice({ f: 900, wave: 'square', gain: 0.08 * near, decay: 0.04, pan }); break;
      case 'hurt':
        if (e.other === player && !own) voice({ f: e.flag ? 1900 : 1100, gain: 0.18, decay: e.flag ? 0.2 : 0.06 }); // hit tick, headshot ring
        if (own) voice({ n: 0.5, cut: 900, gain: 0.5, decay: 0.15 });
        break;
      case 'frag': case 'detonate': {
        const big = e.type === 'detonate' ? 1.6 : 1, loud = Math.min(1, near * 2);
        voice({ n: 0.3, cut: 900 * big, gain: 0.9 * loud, decay: 1.1 * big, pan });
        voice({ f: 60, slide: 0.4, gain: 0.8 * loud, decay: 0.6 * big, pan });
        break;
      }
      case 'flash': voice({ n: 3, filter: 'highpass', cut: 2000, gain: 0.5 * near, decay: 0.3, pan }); break;
      case 'smoke': voice({ n: 1, filter: 'bandpass', cut: 1200, gain: 0.4 * near, decay: 1.6, attack: 0.1, pan }); break;
      case 'beep': voice({ f: 2300, wave: 'square', cut: 5000, gain: 0.08 + 0.12 * near, decay: 0.09, pan }); break;
      case 'planted': chime(520, 390); break;
      case 'defused': chime(660, 880); break;
      case 'live': chime(440, 660); break;
      case 'roundEnd': voice({ f: 330, wave: 'sawtooth', cut: 1500, gain: 0.2, decay: 0.9 }); break;
      case 'buy': if (own) voice({ f: 1250, gain: 0.15, decay: 0.08 }); break;
      default: break;
    }
  }

  return {
    unlock, handle,
    ui: () => voice({ f: 900, gain: 0.1, decay: 0.05 }),
    setVolume(v) { volume = v; if (master) master.gain.value = v; },
    setListener(x, z, yaw) { listener.x = x; listener.z = z; listener.yaw = yaw; },
  };
}
