/*
 * sound.js — what you hear through the window, synthesised with Web Audio.
 *
 *   sun  — wind in the trees, leaf rustle, the odd bird
 *   moon — low wind and two crickets
 *
 * Nothing loads from the network. Sound starts only after the visitor turns it
 * on, because browsers block audio until someone interacts with the page.
 */
let ac = null, master = null, cur = null, on = false, mode = 'sun', volume = 0.6;
const bufs = {};

function audio() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = volume * 1.4;
    master.connect(ac.destination);
    bufs.pink = noiseBuffer('pink');
    bufs.brown = noiseBuffer('brown');
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

function noiseBuffer(kind) {
  const n = ac.sampleRate * 6;
  const b = ac.createBuffer(2, n, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, lastOut = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      } else {
        lastOut = (lastOut + 0.02 * w) / 1.02;
        d[i] = lastOut * 3.5;
      }
    }
  }
  return b;
}

const src = (kind) => {
  const s = ac.createBufferSource();
  s.buffer = bufs[kind];
  s.loop = true;
  s.start(0, Math.random() * 5);
  return s;
};
const filter = (type, f, q) => {
  const b = ac.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  if (q != null) b.Q.value = q;
  return b;
};
const gain = (v) => {
  const g = ac.createGain();
  g.gain.value = v;
  return g;
};
const chain = (...nodes) => {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
};
const pan = (v, out) => {
  if (!ac.createStereoPanner) return out;
  const p = ac.createStereoPanner();
  p.pan.value = v;
  p.connect(out);
  return p;
};
// A slow oscillator nudging a parameter up and down.
const lfo = (param, rate, depth) => {
  const o = ac.createOscillator();
  o.frequency.value = rate;
  const g = gain(depth);
  o.connect(g);
  g.connect(param);
  o.start();
  return o;
};

function blip(out, t, f, f2, peak, dur, p) {
  const o = ac.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f2, t + dur * 0.6);
  const g = gain(0);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(pan(p, out));
  o.start(t);
  o.stop(t + dur + 0.02);
}

function forestScape(out) {
  const wind = src('brown'), leaves = src('pink');
  const wg = gain(0.35), lg = gain(0.03);
  chain(wind, filter('lowpass', 380), wg, out);
  chain(leaves, filter('bandpass', 2800, 0.6), lg, out);
  const l1 = lfo(wg.gain, 0.07, 0.2), l2 = lfo(lg.gain, 0.11, 0.025);
  let next = ac.currentTime + 1.5;
  return {
    sources: [wind, leaves, l1, l2],
    tick() {
      if (ac.currentTime + 0.2 < next) return;
      const notes = 2 + Math.floor(Math.random() * 4);
      const base = 2400 + Math.random() * 1600;
      const p = Math.random() * 1.6 - 0.8;
      let t = next;
      for (let i = 0; i < notes; i++) {
        const f = base * (1 + (Math.random() - 0.5) * 0.15);
        blip(out, t, f, f * 1.35, 0.022, 0.09, p);
        t += 0.11 + Math.random() * 0.05;
      }
      next += 3 + Math.random() * 7;
    },
  };
}

function nightScape(out) {
  const wind = src('brown');
  const wg = gain(0.22);
  chain(wind, filter('lowpass', 260), wg, out);
  const l = lfo(wg.gain, 0.05, 0.12);
  const crickets = [4400, 4900].map((f, i) => {
    const o = ac.createOscillator();
    o.frequency.value = f;
    const g = gain(0);
    o.connect(g);
    g.connect(pan(i ? 0.5 : -0.6, out));
    o.start();
    return { o, g, next: ac.currentTime + 0.5 + i * 0.37 };
  });
  return {
    sources: [wind, l, ...crickets.map((c) => c.o)],
    tick() {
      const now = ac.currentTime;
      for (const c of crickets) {
        while (c.next < now + 0.4) {
          for (let k = 0; k < 3; k++) {
            const ts = c.next + k * 0.06;
            c.g.gain.setValueAtTime(0, ts);
            c.g.gain.linearRampToValueAtTime(0.012, ts + 0.008);
            c.g.gain.linearRampToValueAtTime(0, ts + 0.035);
          }
          c.next += Math.random() < 0.15 ? 2 + Math.random() * 2 : 0.8 + Math.random() * 0.6;
        }
      }
    },
  };
}

const scapes = { sun: forestScape, moon: nightScape };

function fadeOut(sc) {
  if (!sc) return;
  clearInterval(sc.timer);
  const t = ac.currentTime;
  sc.out.gain.cancelScheduledValues(t);
  sc.out.gain.setValueAtTime(sc.out.gain.value, t);
  sc.out.gain.linearRampToValueAtTime(0, t + 1.2);
  setTimeout(() => {
    sc.sources.forEach((s) => { try { s.stop(); } catch (e) {} });
    sc.out.disconnect();
  }, 1400);
}

function play() {
  audio();
  fadeOut(cur);
  const out = gain(0);
  out.connect(master);
  const sc = scapes[mode](out);
  const t = ac.currentTime;
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(1, t + 1.5);
  sc.out = out;
  sc.timer = setInterval(sc.tick, 100);
  cur = sc;
}

export const sound = {
  get on() { return on; },
  setMode(m) {
    mode = m;
    if (on) play();
  },
  /** 0 to 1: the panel's volume knob. */
  setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (master) master.gain.setTargetAtTime(volume * 1.4, ac.currentTime, 0.08);
  },
  toggle() {
    on = !on;
    if (on) play();
    else { fadeOut(cur); cur = null; }
    return on;
  },
};
