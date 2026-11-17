/*
 * liveline (github.com/benjitaylor/liveline), dressed in linen.
 *
 * Liveline draws a real-time line on one canvas: smooth splines, a live dot,
 * a badge on the tip and a crosshair. It has no hook for its area fill, so this
 * adapter wraps the canvas's 2D context:
 *
 *   - the one vertical gradient Liveline makes for the fill under the curve is
 *     swapped for the home repo's linen weave, clipped to the same curve
 *   - its system and SF Mono fonts become Geist Mono
 *   - its crosshair readout (the only 13px text a line chart draws) is left
 *     off the canvas; the home repo's readout sits above the plot instead:
 *     the moment, then the value in ink
 *
 * The adapter relies on Liveline 0.0.7's drawing order, so the package is pinned
 * to that exact version. If an upgrade stops the linen showing, the chart still
 * works with Liveline's own gradient.
 */
import { useLayoutEffect, useRef } from 'react';
import type { HoverPoint } from 'liveline';
import { Liveline, type LivelinePoint } from 'liveline';

const MONO = '"Geist Mono", ui-monospace, monospace';

/** Fine crossing threads of uneven weight, with slubs and breaks, fading toward the bottom. */
function weave(w: number, h: number, dpr: number, thread: string) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * dpr));
  c.height = Math.max(1, Math.round(h * dpr));
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  let seed = 11; // fixed, so the weave doesn't shimmer
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  ctx.strokeStyle = thread;
  ctx.lineWidth = 0.8;
  const run = (horizontal: boolean, at: number, len: number) => {
    let p = -rnd() * 30;
    while (p < len) {
      const seg = 12 + rnd() * 50;
      ctx.globalAlpha = 0.18 + rnd() * 0.32;
      ctx.beginPath();
      if (horizontal) {
        ctx.moveTo(p, at);
        ctx.lineTo(p + seg, at);
      } else {
        ctx.moveTo(at, p);
        ctx.lineTo(at, p + seg);
      }
      ctx.stroke();
      p += seg + rnd() * 2.5;
    }
  };
  for (let y = 0.5; y < h; y += 2) run(true, y + (rnd() - 0.5) * 0.4, w);
  for (let x = 0.5; x < w; x += 2) run(false, x, h);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'destination-out';
  const fade = ctx.createLinearGradient(0, 0, 0, h);
  fade.addColorStop(0, 'rgba(0,0,0,0.05)');
  fade.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, w, h);
  return c;
}

type Ctx = CanvasRenderingContext2D & { __linen?: { thread: string } };

function dress(canvas: HTMLCanvasElement, thread: string) {
  const ctx = canvas.getContext('2d') as Ctx | null;
  if (!ctx) return;
  if (ctx.__linen) {
    ctx.__linen.thread = thread;
    return;
  }
  const state = (ctx.__linen = { thread });
  const fills = new WeakSet<CanvasGradient>();
  let sheet: HTMLCanvasElement | null = null;
  let sheetKey = '';

  const linear = ctx.createLinearGradient.bind(ctx);
  ctx.createLinearGradient = (x0: number, y0: number, x1: number, y1: number) => {
    const g = linear(x0, y0, x1, y1);
    if (x0 === 0 && x1 === 0) fills.add(g); // the area fill is the only vertical gradient
    return g;
  };

  const fill = ctx.fill.bind(ctx) as (...a: unknown[]) => void;
  ctx.fill = ((...args: unknown[]) => {
    const style = ctx.fillStyle;
    if (args.length === 0 && typeof style === 'object' && fills.has(style as CanvasGradient)) {
      const { width, height } = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const k = `${width}x${height}@${dpr}:${state.thread}`;
      if (k !== sheetKey) {
        sheet = weave(width, height, dpr, state.thread);
        sheetKey = k;
      }
      ctx.save();
      ctx.clip();
      ctx.drawImage(sheet!, 0, 0, width, height);
      ctx.restore();
      return;
    }
    fill(...args);
  }) as typeof ctx.fill;

  // the crosshair readout is drawn in 13px; the house draws its own above the plot
  const readout = () => /(^|\s)13px\s/.test(ctx.font);
  const fillText = ctx.fillText.bind(ctx);
  const strokeText = ctx.strokeText.bind(ctx);
  ctx.fillText = ((...a: Parameters<typeof fillText>) => void (readout() || fillText(...a))) as typeof ctx.fillText;
  ctx.strokeText = ((...a: Parameters<typeof strokeText>) => void (readout() || strokeText(...a))) as typeof ctx.strokeText;

  const font = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font')!;
  Object.defineProperty(ctx, 'font', {
    configurable: true,
    get: () => font.get!.call(ctx),
    set: (v: string) => font.set!.call(ctx, v.replace(/(\d+(?:\.\d+)?px)\s.*$/, `$1 ${MONO}`)),
  });
}

export interface LinenLineProps {
  data: LivelinePoint[];
  value: number;
  /** visible span, in seconds */
  window: number;
  dark: boolean;
  ink: string;
  thread: string;
  loading?: boolean;
  live?: boolean;
  formatValue: (v: number) => string;
  formatTime: (t: number) => string;
  /** the moment under the crosshair, in full, for the readout above the plot */
  formatWhen: (t: number) => string;
  /** shown in the readout's place when nothing is under the crosshair */
  note?: string;
  emptyText?: string;
}

export function LinenLine({ ink, thread, dark, live = true, formatWhen, note = '', ...p }: LinenLineProps) {
  const host = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const fmt = useRef({ formatWhen, formatValue: p.formatValue, note });
  fmt.current = { formatWhen, formatValue: p.formatValue, note };

  // written straight to the DOM: hovering redraws nothing in React
  const onHover = (pt: HoverPoint | null) => {
    const el = tip.current;
    if (!el) return;
    const f = fmt.current;
    el.classList.toggle('is-scrubbing', !!pt);
    el.innerHTML = '';
    if (!pt) {
      el.textContent = f.note;
      return;
    }
    const b = document.createElement('b');
    b.textContent = f.formatValue(pt.value);
    el.append(`${f.formatWhen(pt.time)} · `, b);
  };

  // Liveline renders its canvas on mount; dress it, and re-dress when the ink changes
  useLayoutEffect(() => {
    const canvas = host.current?.querySelector('canvas');
    if (canvas) dress(canvas, thread);
  });

  return (
    <div className="linen-wrap">
    <div className="chart-tip" ref={tip} aria-live="polite">{note}</div>
    <div className="linen-line" ref={host}>
      <Liveline
        onHover={onHover}
        tooltipOutline={false}
        data={p.data}
        value={p.value}
        window={p.window}
        theme={dark ? 'dark' : 'light'}
        color={ink}
        lineWidth={1.25}
        momentum={false}
        pulse={live}
        badgeTail={false}
        exaggerate
        loading={p.loading}
        formatValue={p.formatValue}
        formatTime={p.formatTime}
        emptyText={p.emptyText}
        lerpSpeed={0.12}
      />
    </div>
    </div>
  );
}
