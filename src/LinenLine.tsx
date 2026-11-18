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
import { useLayoutEffect, useRef, useState } from 'react';
import type { HoverPoint } from 'liveline';
import { Liveline, type LivelinePoint } from 'liveline';

const MONO = '"Geist Mono", ui-monospace, monospace';
const LINE_WIDTH = 1.25;

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
  formatWhen?: (t: number) => string;
  /**
   * Hand the scrubbed point to the page instead (null when the crosshair
   * leaves); the readout above the plot is then left out.
   */
  onScrub?: (pt: { time: number; value: number } | null) => void;
  /**
   * A stretch of the chart chosen to measure: pressed and dragged with a mouse,
   * or two taps on a phone. `to` is missing after the first tap. Pages that
   * take this show it themselves; others get it in the readout.
   */
  onRange?: (r: Range | null) => void;
  /** a span of time, short, for the readout ("10:14 AM – 2:30 PM") */
  formatSpan?: (from: number, to: number) => string;
  emptyText?: string;
}

export interface Point { time: number; value: number }
export interface Range { from: Point; to?: Point; change?: number }

type Mark = Point & { x: number };

export function LinenLine({ ink, thread, dark, live = true, formatWhen, onScrub, onRange, formatSpan, ...p }: LinenLineProps) {
  const host = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const fmt = useRef({ formatWhen, formatValue: p.formatValue, onScrub, onRange, formatSpan });
  fmt.current = { formatWhen, formatValue: p.formatValue, onScrub, onRange, formatSpan };

  /* ── Measuring a stretch: press and drag (mouse), or tap twice (touch) ── */
  const last = useRef<{ pt: Mark; at: number } | null>(null); // the latest point under the crosshair
  const anchor = useRef<Mark | null>(null);
  const pressing = useRef(false);
  const down = useRef<{ x: number; y: number; at: number } | null>(null);
  const [sel, setSelState] = useState<{ a: Mark; b?: Mark } | null>(null);
  const selRef = useRef(sel);

  const setSel = (next: { a: Mark; b?: Mark } | null) => {
    selRef.current = next;
    setSelState(next);
    const f = fmt.current;
    let r: Range | null = null;
    if (next) {
      const [a, b] = next.b && next.b.time < next.a.time ? [next.b, next.a] : [next.a, next.b];
      const plain = (m: Mark) => ({ time: m.time, value: m.value });
      r = b ? { from: plain(a), to: plain(b), change: a.value ? (b.value - a.value) / a.value : 0 } : { from: plain(a) };
    }
    if (f.onRange) return f.onRange(r);
    showRange(r);
  };

  // pages without their own readout get the stretch in the one above the plot
  const showRange = (r: Range | null) => {
    const el = tip.current;
    const f = fmt.current;
    if (!el) return;
    el.innerHTML = '';
    if (!r) return;
    if (!r.to) {
      el.textContent = 'tap a second point';
      return;
    }
    const b = document.createElement('b');
    const c = r.change ?? 0;
    b.textContent = `${c > 0 ? '+' : c < 0 ? '−' : ''}${Math.abs(c * 100).toFixed(2)}%`;
    b.className = c > 0 ? 'up' : c < 0 ? 'down' : '';
    const span = f.formatSpan ? f.formatSpan(r.from.time, r.to.time) : '';
    el.append(span ? `${span} · ` : '', b);
  };

  const mark = (): Mark | null => (last.current && Date.now() - last.current.at < 800 ? last.current.pt : null);

  const onPointerDown = (e: React.PointerEvent) => {
    down.current = { x: e.clientX, y: e.clientY, at: Date.now() };
    if (e.pointerType === 'mouse' && e.button === 0) {
      pressing.current = true;
      anchor.current = mark();
      setSel(null);
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pressing.current = false;
    const d = down.current;
    down.current = null;
    if (e.pointerType === 'mouse') {
      // a click without a drag clears; a drag leaves its stretch showing
      const sel = selRef.current;
      if (!sel?.b || Math.abs((sel.b.x ?? 0) - sel.a.x) < 4) setSel(null);
      anchor.current = null;
      return;
    }
    // touch: a tap, not a drag. The chart takes a tap's point just after the
    // finger lifts, so read it a moment later, and only a point from this tap
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12 || Date.now() - d.at > 500) return;
    setTimeout(() => {
      const l = last.current;
      if (!l || l.at < d.at) return;
      const pt = l.pt;
      const sel = selRef.current;
      if (sel?.b || (sel && Math.abs(pt.x - sel.a.x) < 4)) setSel(null); // a third tap (or the same spot) clears
      else if (sel) setSel({ a: sel.a, b: pt });
      else setSel({ a: pt });
    }, 120);
  };
  const onPointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    pressing.current = false;
    anchor.current = null;
    if (selRef.current) setSel(null);
  };

  // written straight to the DOM: hovering redraws nothing in React
  const onHover = (pt: HoverPoint | null) => {
    if (pt) last.current = { pt: { time: pt.time, value: pt.value, x: pt.x }, at: Date.now() };
    // dragging a stretch: it follows the pointer
    if (pressing.current && pt) {
      if (!anchor.current) anchor.current = { time: pt.time, value: pt.value, x: pt.x };
      else setSel({ a: anchor.current, b: { time: pt.time, value: pt.value, x: pt.x } });
    }
    const f = fmt.current;
    if (selRef.current?.b) return; // a measured stretch holds the readout
    if (f.onScrub) return f.onScrub(pt && { time: pt.time, value: pt.value });
    const el = tip.current;
    if (!el || !f.formatWhen) return;
    if (selRef.current) return;
    el.classList.toggle('is-scrubbing', !!pt);
    el.innerHTML = '';
    if (!pt) return; // the readout shows only while scrubbing
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
    {!onScrub && <div className="chart-tip" ref={tip} aria-live="polite" />}
    <div
      className="linen-line"
      ref={host}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
    >
      {/* the measured stretch: a band between the two points, or one mark */}
      {sel && (
        <span
          className={`chart-range${sel.b ? '' : ' is-mark'}`}
          style={{
            left: Math.min(sel.a.x, sel.b?.x ?? sel.a.x),
            width: sel.b ? Math.abs(sel.b.x - sel.a.x) : 0,
          }}
          aria-hidden
        />
      )}
      <Liveline
        onHover={onHover}
        tooltipOutline={false}
        data={p.data}
        value={p.value}
        window={p.window}
        theme={dark ? 'dark' : 'light'}
        color={ink}
        lineWidth={LINE_WIDTH}
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
