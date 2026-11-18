/*
 * light.js — the light falling on the wall.
 *
 * Each mode draws one canvas: the patch of light a window throws onto the wall,
 * and the blind it comes through. The
 * canvas is drawn at low resolution, blurred with CSS, and blended over the
 * wall, so it reads as ambient light rather than an image.
 *
 *   sun  — warm daylight through a blind, a curtain edge, cloud shadows
 *   moon — the same blind in faint, warm dusk light
 */
const TAU = Math.PI * 2;

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

/* ── Light through a blind: one scene, lit by the sun or the moon ─────────
 * The patch a window throws on the wall, through the slats of a blind, with a
 * curtain edge stirring in a draft and cloud shadows sliding past. Screened
 * onto the wall: black leaves it as it is, the light brightens it. By day the
 * light is warm and stronger; by night it's cool and faint. */
function blinds({ blur, glow, light, strength }) {
  return {
    blend: 'screen',
    blur,
    scale: 0.25,
    // starts below the masthead, so the light never washes out its white text
    win: { x: 0.1, y: 0.1, w: 0.5, h: 0.84, skew: 0.28, cols: 2, rows: 2, m: 0.02 },

    frame(ctx, W, H, t) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);

      // the sky's glow filling the room
      const g = ctx.createRadialGradient(W * 0.78, 0, 0, W * 0.78, 0, H * 1.2);
      g.addColorStop(0, `rgba(${glow}, 0.18)`);
      g.addColorStop(1, `rgba(${glow}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      const clear = 0.5 + 0.5 * noise(t * 0.04, 7);
      ctx.save();
      windowPath(ctx, W, H, this.win);
      ctx.clip();

      // light through the slats of the blind
      const slat = H * 0.034, gap = H * 0.012;
      const drift = Math.sin(t * 0.3) * H * 0.002;
      ctx.fillStyle = `rgba(${light}, ${strength * clear})`;
      for (let y = -slat + drift; y < H; y += slat + gap) ctx.fillRect(0, y, W, slat);

      // cloud shadows sliding past
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

      // a curtain edge, moving slightly in a draft
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
}

/* ── Sunlight: warm daylight through the blind ──────────────────────────── */
const sun = blinds({ blur: 8, glow: '255, 226, 182', light: '255, 232, 196', strength: 0.5 });

/* ── Moonlight: faint, warm dusk light through the same blind ─────────── */
const moon = blinds({ blur: 9, glow: '120, 100, 78', light: '214, 192, 160', strength: 0.32 });

/* ── Engine ───────────────────────────────────────────────────────────── */
const scenes = { sun, moon };
const PAD = 48; // canvas overhangs the viewport so the blur has no soft edges
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
let canvas, ctx, cur = null, t = 0, last = 0, raf = 0, swap = 0;

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
    reduce.addEventListener?.('change', start);
  },
  set(name) {
    if (!scenes[name]) return;
    clearTimeout(swap);
    if (!cur) {
      apply(name);
      canvas.style.opacity = '1';
      start();
      return;
    }
    canvas.style.opacity = '0';
    swap = setTimeout(() => {
      apply(name);
      canvas.style.opacity = '1';
    }, 650);
  },
};
