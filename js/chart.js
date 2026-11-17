/*
 * chart.js — an ink line with linen shading beneath it.
 *
 * Ported from the home repo's Chart.tsx: fine crossing threads of uneven
 * weight, with slubs and breaks, clipped under the line and fading toward the
 * bottom. Faint dotted rules at round values, the latest value in a small ink
 * tag, and a drag or hover across the plot reads out any point.
 *
 *   const c = House.chart(rootEl, { format, yFormat, when, tick });
 *   c.set([{ t: ms, v: number }, …]);
 */
(function () {
  const House = (window.House = window.House || {});
  const AXIS_PX = 9.5;
  const TAG_PX = 11;
  const TAG_PAD = 5;
  const GUTTER_GAP = 8;
  const PAD = 8;

  // Round values (1, 2, 2.5 or 5 × a power of ten): the widest step giving at least three.
  function yTicks(lo, hi) {
    if (!(hi > lo)) return [];
    const at = (step) => {
      const out = [];
      for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toPrecision(12));
      return out;
    };
    const mag = 10 ** Math.floor(Math.log10(hi - lo));
    for (const step of [5, 2.5, 2, 1, 0.5, 0.25, 0.2, 0.1].map((m) => m * mag)) {
      const ticks = at(step);
      if (ticks.length >= 3) return ticks;
    }
    return at(0.05 * mag);
  }

  House.chart = function (root, opts) {
    root.classList.add('chart');
    root.innerHTML = `
      <div class="chart-tip" aria-live="polite"></div>
      <div class="chart-plot">
        <canvas></canvas>
        <span class="chart-guide" hidden></span>
        <span class="chart-mark" hidden></span>
      </div>
      <div class="chart-axis"></div>`;
    const tip = root.querySelector('.chart-tip');
    const plot = root.querySelector('.chart-plot');
    const canvas = root.querySelector('canvas');
    const guide = root.querySelector('.chart-guide');
    const mark = root.querySelector('.chart-mark');
    const axis = root.querySelector('.chart-axis');
    const measure = document.createElement('canvas').getContext('2d');

    let points = [], W = 0, H = 0, g = null, right = 0, note = '';

    const font = (px, weight = 400) => `${weight} ${px}px ${getComputedStyle(root).getPropertyValue('--mono') || 'monospace'}`;
    const textWidth = (text, px, weight) => {
      measure.font = font(px, weight);
      return measure.measureText(text).width;
    };

    function geometry() {
      const vals = points.map((p) => p.v);
      let lo = Math.min(...vals), hi = Math.max(...vals);
      if (hi === lo) { lo = lo ? lo * 0.95 : -1; hi = hi ? hi * 1.05 : 1; }
      const span = W - PAD * 2 - right;
      const x = (i) => (points.length === 1 ? W / 2 : PAD + (i / (points.length - 1)) * span);
      const y = (v) => PAD + (1 - (v - lo) / (hi - lo)) * (H * 0.72 - PAD);
      const valueAt = (py) => lo + (1 - (py - PAD) / (H * 0.72 - PAD)) * (hi - lo);
      const indexAt = (px) =>
        points.length === 1 ? 0 : Math.max(0, Math.min(points.length - 1, Math.round(((px - PAD) / span) * (points.length - 1))));
      return { vals, lo, hi, span, x, y, valueAt, indexAt };
    }

    function gutter() {
      const vals = points.map((p) => p.v);
      const lo = Math.min(...vals), hi = Math.max(...vals);
      const labels = yTicks(lo - (hi - lo), hi + (hi - lo) * 0.2).map((v) => textWidth(opts.yFormat(v), AXIS_PX));
      const tag = textWidth(opts.format(vals[vals.length - 1]), TAG_PX, 500) + TAG_PAD * 2;
      return Math.ceil(Math.max(tag, ...labels)) + GUTTER_GAP;
    }

    function draw() {
      const rect = canvas.getBoundingClientRect();
      W = Math.floor(rect.width);
      H = Math.floor(rect.height);
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (!W || !H || !points.length) { g = null; return; }

      right = gutter();
      g = geometry();
      const css = getComputedStyle(root);
      const INK = css.getPropertyValue('--ink').trim();
      const STIPPLE = css.getPropertyValue('--stipple').trim();
      const MUTED = css.getPropertyValue('--muted').trim();
      const PAPER = css.getPropertyValue('--slab').trim();
      const { vals, span, x, y } = g;

      const lineAt = (px) => {
        if (points.length === 1) return y(vals[0]);
        const t = ((px - PAD) / span) * (points.length - 1);
        const i = Math.max(0, Math.min(points.length - 2, Math.floor(t)));
        const f = Math.max(0, Math.min(1, t - i));
        return y(vals[i] + (vals[i + 1] - vals[i]) * f);
      };

      // linen, clipped just under the line, fading toward the bottom
      const x0 = x(0), x1 = x(points.length - 1);
      let seed = 11; // fixed, so the weave doesn't shimmer as prices update
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x0, H);
      for (let px = x0; px <= x1; px += 1) ctx.lineTo(px, lineAt(px) + 3);
      ctx.lineTo(x1, H);
      ctx.closePath();
      ctx.clip();
      ctx.strokeStyle = STIPPLE;
      ctx.lineWidth = 0.8;
      const thread = (horizontal, at, len) => {
        let p = -rnd() * 30;
        while (p < len) {
          const seg = 12 + rnd() * 50;
          ctx.globalAlpha = 0.18 + rnd() * 0.32;
          ctx.beginPath();
          if (horizontal) { ctx.moveTo(p, at); ctx.lineTo(p + seg, at); }
          else { ctx.moveTo(at, p); ctx.lineTo(at, p + seg); }
          ctx.stroke();
          p += seg + rnd() * 2.5;
        }
      };
      for (let yy = 0.5; yy < H; yy += 2) thread(true, yy + (rnd() - 0.5) * 0.4, W);
      for (let xx = Math.floor(x0) + 0.5; xx < x1; xx += 2) thread(false, xx, H);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'destination-out';
      const fade = ctx.createLinearGradient(0, 0, 0, H);
      fade.addColorStop(0, 'rgba(0,0,0,0.05)');
      fade.addColorStop(1, 'rgba(0,0,0,0.8)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      // faint dotted rules at round values, labelled in the right-hand gutter
      const ruleEnd = W - right + GUTTER_GAP / 2;
      const tagY = y(vals[vals.length - 1]);
      ctx.font = font(AXIS_PX);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0.06em';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = MUTED;
      ctx.strokeStyle = MUTED;
      ctx.lineWidth = 0.75;
      ctx.setLineDash([1, 3]);
      for (const v of yTicks(g.valueAt(H - 10), g.hi)) {
        const ty = Math.round(y(v)) + 0.5;
        if (ty < 8) continue;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.moveTo(0, ty);
        ctx.lineTo(ruleEnd, ty);
        ctx.stroke();
        ctx.globalAlpha = 1;
        if (Math.abs(ty - tagY) >= 18) ctx.fillText(opts.yFormat(v), W, ty);
      }
      ctx.setLineDash([]);

      // a zero line, when the series crosses it (PnL)
      if (g.lo < 0 && g.hi > 0) {
        ctx.strokeStyle = MUTED;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(0, Math.round(y(0)) + 0.5);
        ctx.lineTo(ruleEnd, Math.round(y(0)) + 0.5);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // the line and its end dot
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      points.forEach((p, i) => (i ? ctx.lineTo(x(i), y(p.v)) : ctx.moveTo(x(i), y(p.v))));
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(x(points.length - 1), tagY, 3, 0, Math.PI * 2);
      ctx.fill();

      // the latest value in a small ink tag, flush right
      const endText = opts.format(vals[vals.length - 1]);
      ctx.font = font(TAG_PX, 500);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      const w = textWidth(endText, TAG_PX, 500) + TAG_PAD * 2;
      const h = 16;
      ctx.fillStyle = INK;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(W - w, tagY - h / 2, w, h, 2);
      else ctx.rect(W - w, tagY - h / 2, w, h);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = PAPER;
      ctx.fillText(endText, W - w / 2, tagY + 0.5);

      // dates beneath, spanning exactly the line
      axis.style.paddingLeft = PAD + 'px';
      axis.style.paddingRight = PAD + right + 'px';
      const n = Math.min(5, points.length);
      const picks = n < 2 ? [points[0]] : Array.from({ length: n }, (_, i) => points[Math.round((i * (points.length - 1)) / (n - 1))]);
      axis.innerHTML = picks.map((p) => `<span>${opts.tick(p.t)}</span>`).join('');
    }

    function scrub(e) {
      if (!g) return;
      const i = g.indexAt(e.clientX - plot.getBoundingClientRect().left);
      const p = points[i];
      guide.hidden = mark.hidden = false;
      guide.style.left = g.x(i) + 'px';
      mark.style.left = g.x(i) + 'px';
      mark.style.top = g.y(p.v) + 'px';
      tip.innerHTML = `${opts.when(p.t)} · <b>${opts.format(p.v)}</b>`;
    }
    function clear() {
      guide.hidden = mark.hidden = true;
      tip.textContent = note;
    }

    plot.addEventListener('pointerdown', (e) => { plot.setPointerCapture(e.pointerId); scrub(e); });
    plot.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || e.buttons) scrub(e); });
    plot.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') clear(); });
    plot.addEventListener('pointercancel', clear);
    plot.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') clear(); });
    new ResizeObserver(() => draw()).observe(canvas);

    return {
      set(next, corner) {
        points = next;
        note = corner || '';
        clear();
        draw();
      },
      redraw: draw,
    };
  };
})();
