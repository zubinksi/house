/*
 * light.js — the light falling on the wall.
 *
 * Each mode draws one canvas: the patch of light a window throws onto the wall,
 * and whatever stands between the light and the window (leaves, blinds). The
 * canvas is drawn at low resolution, blurred with CSS, and blended over the
 * wall, so it reads as ambient light rather than an image.
 *
 *   sun  — screen:   warm window light, swaying leaf shadows, passing clouds
 *   moon — screen:   cool light through blinds, a curtain edge, cloud shadows
 */
const TAU = Math.PI * 2;

// Small seeded PRNG so the leaves are the same on every visit.
function rng(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 1D value noise in [0, 1].
function noise(x, seed) {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n) => {
    const s = Math.sin((n + seed * 57.13) * 127.1) * 43758.5453;
    return s - Math.floor(s);
  };
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}

// The window's panes projected onto the wall: a grid of parallelograms.
// Fractions of the canvas; `skew` is horizontal shift per unit of height.
function windowPath(ctx, W, H, w) {
  const x0 = w.x * W, y0 = w.y * H, ww = w.w * W, hh = w.h * H, m = w.m * H;
  const pw = (ww - m * (w.cols - 1)) / w.cols;
  const ph = (hh - m * (w.rows - 1)) / w.rows;
  const sx = (y) => (y - y0) * w.skew;
  ctx.beginPath();
  for (let r = 0; r < w.rows; r++) {
    for (let c = 0; c < w.cols; c++) {
      const px = x0 + c * (pw + m);
      const py = y0 + r * (ph + m);
      ctx.moveTo(px + sx(py), py);
      ctx.lineTo(px + pw + sx(py), py);
      ctx.lineTo(px + pw + sx(py + ph), py + ph);
      ctx.lineTo(px + sx(py + ph), py + ph);
      ctx.closePath();
    }
  }
}

/* ── Sunlight ─────────────────────────────────────────────────────────── */
const sun = {
  // screen adds the sun to the grey wall: black leaves it as it is, the warm
  // colour brightens the patch the window throws
  blend: 'screen',
  blur: 3,
  scale: 0.35,
  // the sway, clouds and flutter run at this fraction of real time
  speed: 0.6,
  shade: '#000000',
  light: '#8f7b59',
  // starts below the masthead, so the light never washes out its white text
  win: { x: 0.36, y: 0.1, w: 0.6, h: 1.0, skew: -0.32, cols: 2, rows: 3, m: 0.022 },

  build(W, H) {
    const R = rng(11);
    const U = H;
    this.branches = [];
    for (let i = 0; i < 7; i++) {
      const fromRight = i % 3 === 2;
      const b = {
        x: fromRight ? W * 1.02 : W * (0.32 + R() * 0.72),
        y: fromRight ? H * (0.05 + R() * 0.45) : -U * 0.05,
        a: fromRight ? Math.PI * (0.78 + R() * 0.12) : Math.PI * (0.5 + (R() - 0.5) * 0.4),
        p: R() * TAU,
        sway: 0.6 + R() * 0.7,
        width: U * (0.004 + R() * 0.003),
        segs: [],
      };
      const ns = 12 + Math.floor(R() * 10);
      const L = U * (0.028 + R() * 0.018);
      const bend = (R() - 0.5) * 0.05;
      for (let s = 0; s < ns; s++) {
        const seg = { L, bend: bend + (R() - 0.5) * 0.08, leaves: [] };
        const tip = s === ns - 1;
        const nl = tip ? 3 : s < 2 ? 0 : R() < 0.85 ? (R() < 0.5 ? 1 : 2) : 0;
        for (let l = 0; l < nl; l++) {
          seg.leaves.push({
            side: tip ? l - 1 : (l % 2 ? -1 : 1) * (R() < 0.5 ? 1 : -1),
            off: tip ? 0.35 : 0.45 + R() * 0.6,
            len: U * (0.045 + R() * 0.05),
            wr: 0.16 + R() * 0.1,
            p: R() * TAU,
            f: 1.5 + R() * 2.5,
            amp: 0.08 + R() * 0.16,
          });
        }
        b.segs.push(seg);
      }
      this.branches.push(b);
    }
  },

  frame(ctx, W, H, t) {
    ctx.fillStyle = this.shade;
    ctx.fillRect(0, 0, W, H);

    // Clouds drift across the sun now and then.
    const sunny = Math.min(1, 0.55 + 0.6 * noise(t * 0.05, 3));
    const wind = (noise(t * 0.35, 1) - 0.5) * 1.6 + Math.sin(t * 0.9) * 0.15;

    ctx.save();
    windowPath(ctx, W, H, this.win);
    ctx.clip();
    ctx.globalAlpha = 0.3 + 0.7 * sunny;
    ctx.fillStyle = this.light;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    ctx.fillStyle = this.shade;
    ctx.strokeStyle = this.shade;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const leaves = [];
    for (const b of this.branches) {
      let x = b.x, y = b.y;
      let a = b.a + wind * 0.05 * b.sway + Math.sin(t * 0.7 + b.p) * 0.012;
      ctx.lineWidth = b.width;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const n = b.segs.length;
      b.segs.forEach((s, i) => {
        a += s.bend + wind * 0.012 * (i / n) * b.sway;
        x += Math.cos(a) * s.L;
        y += Math.sin(a) * s.L;
        ctx.lineTo(x, y);
        for (const l of s.leaves) {
          const ang = a + l.side * l.off + Math.sin(t * l.f + l.p) * l.amp * (0.5 + Math.abs(wind)) + wind * 0.25;
          leaves.push(x, y, ang, l.len, l.wr);
        }
      });
      ctx.stroke();
    }
    ctx.beginPath();
    for (let i = 0; i < leaves.length; i += 5) {
      const x = leaves[i], y = leaves[i + 1], ang = leaves[i + 2], len = leaves[i + 3], wr = leaves[i + 4];
      const rx = len * 0.5, ry = len * wr * 0.5;
      const cx = x + Math.cos(ang) * rx, cy = y + Math.sin(ang) * rx;
      ctx.moveTo(cx + Math.cos(ang) * rx, cy + Math.sin(ang) * rx);
      ctx.ellipse(cx, cy, rx, ry, ang, 0, TAU);
    }
    ctx.fill();
    ctx.restore();
  },
};

/* ── Moonlight ────────────────────────────────────────────────────────── */
const moon = {
  blend: 'screen',
  blur: 9,
  scale: 0.25,
  win: { x: 0.1, y: 0.06, w: 0.5, h: 0.86, skew: 0.28, cols: 2, rows: 2, m: 0.02 },

  frame(ctx, W, H, t) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // Faint glow of the night sky filling the room.
    const g = ctx.createRadialGradient(W * 0.78, 0, 0, W * 0.78, 0, H * 1.2);
    g.addColorStop(0, 'rgba(70, 92, 135, 0.18)');
    g.addColorStop(1, 'rgba(70, 92, 135, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const clear = 0.5 + 0.5 * noise(t * 0.04, 7);
    ctx.save();
    windowPath(ctx, W, H, this.win);
    ctx.clip();

    // Light through the slats of a blind.
    const slat = H * 0.034, gap = H * 0.012;
    const drift = Math.sin(t * 0.3) * H * 0.002;
    ctx.fillStyle = `rgba(150, 176, 222, ${0.36 * clear})`;
    for (let y = -slat + drift; y < H; y += slat + gap) ctx.fillRect(0, y, W, slat);

    // Cloud shadows sliding past.
    for (let i = 0; i < 3; i++) {
      const span = W * 1.8;
      const cx = ((t * 0.012 * W * (1 + i * 0.4) + i * W * 0.6) % span) - W * 0.4;
      const cy = H * (0.25 + 0.25 * i);
      const r = H * (0.35 + 0.1 * i);
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      cg.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
      cg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = cg;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();

    // A curtain edge, moving slightly in a draft.
    const base = W * (this.win.x + 0.07);
    const e1 = base + Math.sin(t * 0.45) * W * 0.012;
    const e2 = base + W * 0.05 + Math.sin(t * 0.45 + 0.8) * W * 0.02 + Math.sin(t * 1.1) * W * 0.004;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(e1, 0);
    ctx.bezierCurveTo(e1 + W * 0.01, H * 0.35, e2 - W * 0.02, H * 0.65, e2, H);
    ctx.lineTo(0, H);
    ctx.fill();
  },
};

/* ── Engine ───────────────────────────────────────────────────────────── */
const scenes = { sun, moon };
const PAD = 48; // canvas overhangs the viewport so the blur has no soft edges
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
let canvas, ctx, cur = null, curName = '', t = 0, last = 0, raf = 0, swap = 0;

function fit() {
  const W = Math.ceil((window.innerWidth + PAD * 2) * cur.scale);
  const H = Math.ceil((window.innerHeight + PAD * 2) * cur.scale);
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
    if (cur.build) cur.build(W, H);
  }
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  cur.frame(ctx, canvas.width, canvas.height, t * (cur.speed ?? 1));
  drawPaper();
}

/* ── The same light, falling faintly across the slab (prototype) ──
 * A second canvas, clipped to the slab's outline, carries a softened copy of
 * the wall's light. By day it multiplies onto the paper: the paper's own light
 * warm shade where the window's light doesn't reach, warm white where it does,
 * so text never sits in real shadow. By night the blinds' light is screened on
 * faintly. It is blurred more than the wall, as light on a sheet is. */
const PAPER = {
  // by day: faint, and moving at about a third of the wall's pace, so what
  // crosses the numbers drifts rather than sways
  sun: { blend: 'multiply', shade: '#e4dccf', gain: 2, blur: 7, opacity: 0.35, speed: 0.35 },
  moon: { blend: 'screen', blur: 10, opacity: 0.65 },
};
let paper = null, pctx = null, slab = null, paperOn = true, shown = false, lastClip = '';
let slow = null, sctx = null; // the slab's own, slower frame of the scene

function clipToSlab() {
  if (!paper || !slab) return;
  const r = slab.getBoundingClientRect();
  const box = paper.getBoundingClientRect();
  const clip = `inset(${r.top - box.top}px ${box.right - r.right}px ${box.bottom - r.bottom}px ${r.left - box.left}px round 3px)`;
  if (clip !== lastClip) {
    paper.style.clipPath = clip;
    lastClip = clip;
  }
}

function paperOpacity() {
  if (!paper) return;
  paper.style.opacity = paperOn && shown && cur ? String(PAPER[curName].opacity) : '0';
}

function drawPaper() {
  if (!paper || !paperOn || !cur) return;
  slab = slab && slab.isConnected ? slab : document.querySelector('.slab');
  const p = PAPER[curName];
  const W = canvas.width, H = canvas.height;
  if (paper.width !== W || paper.height !== H) {
    paper.width = W;
    paper.height = H;
  }
  // a slower slab draws its own frame of the scene on its own clock
  let source = canvas;
  if (p.speed && p.speed !== 1) {
    if (!slow) {
      slow = document.createElement('canvas');
      sctx = slow.getContext('2d');
    }
    if (slow.width !== W || slow.height !== H) {
      slow.width = W;
      slow.height = H;
    }
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalAlpha = 1;
    cur.frame(sctx, W, H, t * p.speed);
    source = slow;
  }
  pctx.setTransform(1, 0, 0, 1, 0, 0);
  pctx.globalAlpha = 1;
  pctx.globalCompositeOperation = 'source-over';
  if (p.shade) {
    pctx.fillStyle = p.shade;
    pctx.fillRect(0, 0, W, H);
    pctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < p.gain; i++) pctx.drawImage(source, 0, 0);
    pctx.globalCompositeOperation = 'source-over';
  } else {
    pctx.clearRect(0, 0, W, H);
    pctx.drawImage(source, 0, 0);
  }
  paper.style.mixBlendMode = p.blend;
  paper.style.filter = `blur(${p.blur}px)`;
  clipToSlab();
}

function loop(now) {
  raf = requestAnimationFrame(loop);
  if (now - last < 32) return; // ~30fps is plenty for ambient light
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  t += dt;
  draw();
}

function apply(name) {
  cur = scenes[name];
  curName = name;
  canvas.width = 0;
  fit();
  canvas.style.mixBlendMode = cur.blend;
  canvas.style.filter = `blur(${cur.blur}px)`;
  t += 1;
  draw();
}

function start() {
  cancelAnimationFrame(raf);
  if (reduce.matches) return;
  last = performance.now();
  raf = requestAnimationFrame(loop);
}

export const light = {
  mount(el) {
    canvas = el;
    ctx = canvas.getContext('2d');
    window.addEventListener('resize', () => {
      if (!cur) return;
      fit();
      draw();
    });
    // the slab moves with the page on a phone; its light goes with it
    window.addEventListener('scroll', clipToSlab, { passive: true });
    reduce.addEventListener?.('change', start);
  },
  set(name) {
    if (!scenes[name]) return;
    clearTimeout(swap);
    if (!cur) {
      apply(name);
      canvas.style.opacity = '1';
      shown = true;
      paperOpacity();
      start();
      return;
    }
    canvas.style.opacity = '0';
    shown = false;
    paperOpacity();
    swap = setTimeout(() => {
      apply(name);
      canvas.style.opacity = '1';
      shown = true;
      paperOpacity();
    }, 650);
  },
  /** The canvas that carries the light across the slab. */
  mountPaper(el) {
    paper = el;
    pctx = paper.getContext('2d');
  },
  /** Light on the slab, on or off. */
  paper(on) {
    paperOn = on;
    paperOpacity();
    if (on && cur) draw();
  },
};
