/*
 * Hyperliquid's public API: REST for snapshots, one WebSocket for live prices.
 *
 * Every REST request is a POST to /info naming its type; no key is needed.
 * The socket subscribes to allMids, the mid price of every market, pushed as
 * it changes.
 *
 * Markets come from two perp dexes: Hyperliquid's own (crypto), and trade.xyz's
 * HIP-3 dex "xyz" (stocks, indices, commodities, currencies). A HIP-3 market's
 * name carries its dex, e.g. "xyz:TSLA"; that full name is what the API, the
 * socket and the stars use. label() gives the name to show. Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api
 */
import { useEffect, useState, useSyncExternalStore } from 'react';

const API = 'https://api.hyperliquid.xyz/info';
const WS = 'wss://api.hyperliquid.xyz/ws';

export async function info<T = unknown>(body: unknown, timeoutMs = 10000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`Hyperliquid answered ${r.status}`);
    return (await r.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/* ── Markets ── */
/** The perp dexes the house reads: '' is Hyperliquid's own. */
export const DEXES = ['', 'xyz'] as const;
/** Who lists a HIP-3 dex's markets. */
export const ISSUER: Record<string, string> = { xyz: 'trade.xyz' };
export const dexOf = (name: string) => (name.includes(':') ? name.slice(0, name.indexOf(':')) : '');
/** "xyz:TSLA" → "TSLA" */
export const label = (name: string) => (name.includes(':') ? name.slice(name.indexOf(':') + 1) : name);

/**
 * What a HIP-3 deployer says about each of its markets (perpConciseAnnotations):
 * its category ("stocks", "indices", "preipo"…), a display name ("WTIOIL" for
 * xyz:CL) and search keywords ("anthropic" for xyz:ANT). Kept up to date by
 * the deployer, so the house never has to keep its own list.
 */
export interface Annotation { category?: string; displayName?: string; keywords?: string[] }
export const annotations = new Map<string, Annotation>();

export interface Market {
  /** the API's name: "HYPE", or "xyz:TSLA" for a HIP-3 market */
  name: string;
  dex: string;
  maxLeverage: number;
  price: number;
  oracle: number;
  prev: number;
  change: number;
  funding: number;
  oi: number;
  vol: number;
}

interface AssetCtx {
  markPx: string | null;
  oraclePx: string;
  prevDayPx: string;
  funding: string;
  openInterest: string;
  dayNtlVlm: string;
}

let marketsAt = 0;
let marketsP: Promise<Market[]> | null = null;

/** Perp markets with their day's context, cached briefly so every view shares one request. */
export function fetchMarkets(maxAgeMs = 10000): Promise<Market[]> {
  if (marketsP && Date.now() - marketsAt < maxAgeMs) return marketsP;
  marketsAt = Date.now();
  type Meta = [{ universe: { name: string; maxLeverage: number; isDelisted?: boolean }[] }, AssetCtx[]];
  const parse = (dex: string) => ([meta, ctxs]: Meta): Market[] =>
    meta.universe.flatMap((u, i) => {
      const c = ctxs[i];
      if (!c || u.isDelisted || c.markPx == null) return [];
      const price = +c.markPx;
      const prev = +c.prevDayPx;
      return [{
        name: u.name,
        dex,
        maxLeverage: u.maxLeverage,
        price,
        oracle: +c.oraclePx,
        prev,
        change: prev ? (price - prev) / prev : 0,
        funding: +c.funding,
        oi: +c.openInterest * price,
        vol: +c.dayNtlVlm,
      }];
    });
  // annotations ride along; if they fail, markets still load (uncategorised)
  const notes = info<[string, Annotation][]>({ type: 'perpConciseAnnotations' })
    .then((list) => {
      annotations.clear();
      for (const [name, a] of list) annotations.set(name, a);
    })
    .catch(() => undefined);
  marketsP = Promise.all(
    DEXES.map((dex) =>
      info<Meta>({ type: 'metaAndAssetCtxs', ...(dex && { dex }) })
        .then(parse(dex))
        // a HIP-3 dex that fails leaves the crypto markets standing
        .catch((e) => (dex ? [] : Promise.reject(e))),
    ),
  )
    .then(async (lists) => {
      await notes;
      return lists.flat();
    })
    .catch((e) => {
      marketsP = null;
      throw e;
    });
  return marketsP;
}

/** Markets, refreshed every 30 seconds while the page is open. */
export function useMarkets() {
  const [state, setState] = useState<{ list: Market[]; error: boolean }>({ list: [], error: false });
  useEffect(() => {
    let live = true;
    const load = () =>
      fetchMarkets()
        .then((list) => live && setState({ list, error: false }))
        .catch(() => live && setState((s) => ({ ...s, error: true })));
    load();
    const id = setInterval(() => !document.hidden && load(), 30000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);
  return state;
}

export interface Candle {
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
}

export function fetchCandles(coin: string, interval: string, ms: number) {
  const now = Date.now();
  return info<Candle[]>({ type: 'candleSnapshot', req: { coin, interval, startTime: now - ms, endTime: now } });
}

/** USD price of each spot token, by name, from the spot markets quoted in USDC. */
export async function fetchSpotPrices(): Promise<Map<string, number>> {
  const [meta, ctxs] = await info<[
    { tokens: { name: string; index: number }[]; universe: { tokens: [number, number] }[] },
    { markPx: string | null }[],
  ]>({ type: 'spotMetaAndAssetCtxs' });
  const byIndex = new Map(meta.tokens.map((t) => [t.index, t.name]));
  const prices = new Map<string, number>([['USDC', 1]]);
  meta.universe.forEach((pair, i) => {
    const [base, quote] = pair.tokens;
    const px = ctxs[i]?.markPx;
    const name = byIndex.get(base);
    if (quote === 0 && px != null && name && !prices.has(name)) prices.set(name, +px);
  });
  return prices;
}

/* ── Live mids over the socket ── */
let mids: Record<string, number> = {};
let socket: WebSocket | null = null;
let retry = 1000;
let status: 'connecting' | 'live' | 'down' = 'connecting';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function connect() {
  status = 'connecting';
  try {
    socket = new WebSocket(WS);
  } catch {
    status = 'down';
    return;
  }
  socket.onopen = () => {
    retry = 1000;
    for (const dex of DEXES) {
      socket?.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'allMids', ...(dex && { dex }) } }));
    }
  };
  socket.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.channel !== 'allMids') return;
    // each dex sends its own mids; HIP-3 names already carry their dex
    const next: Record<string, number> = { ...mids };
    for (const [k, v] of Object.entries(msg.data.mids as Record<string, string>)) next[k] = +v;
    mids = next;
    status = 'live';
    emit();
  };
  socket.onclose = () => {
    status = 'down';
    emit();
    socket = null;
    if (listeners.size) setTimeout(connect, (retry = Math.min(retry * 2, 30000)));
  };
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  if (!socket) connect();
  return () => {
    listeners.delete(fn);
  };
}

/** The live mid of every market, by name (e.g. mids.HYPE). Empty until the socket answers. */
export function useMids() {
  return useSyncExternalStore(subscribe, () => mids);
}
export const midsStatus = () => status;

/* ── Formats ── */
export const DASH = '—';
const ok = (v: unknown): v is number => typeof v === 'number' && isFinite(v);

export function price(p: number | null | undefined) {
  if (!ok(p)) return DASH;
  const d = p >= 10000 ? 0 : p >= 1000 ? 1 : p >= 10 ? 2 : p >= 1 ? 3 : p >= 0.01 ? 4 : 6;
  return p.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
export function usd(v: number | null | undefined, dp = 2) {
  if (!ok(v)) return DASH;
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  return (v < 0 ? '−$' : '$') + s;
}
export function usdShort(v: number | null | undefined) {
  if (!ok(v)) return DASH;
  const a = Math.abs(v), sign = v < 0 ? '−' : '';
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(1)}K`;
  return `${sign}$${a.toFixed(2)}`;
}
export function pct(v: number | null | undefined, dp = 2, signed = true) {
  if (!ok(v)) return DASH;
  const sign = !signed ? '' : v > 0 ? '+' : v < 0 ? '−' : '';
  return sign + Math.abs(v * 100).toFixed(dp) + '%';
}
export function size(v: number | null | undefined) {
  if (!ok(v)) return DASH;
  const a = Math.abs(v);
  return v.toLocaleString('en-US', { maximumFractionDigits: a >= 1000 ? 2 : a >= 1 ? 4 : 6 });
}
export const tone = (v: number | null | undefined) => (!ok(v) ? '' : v > 0 ? 'up' : v < 0 ? 'down' : '');
/** "May ’23": a month and year, never mistaken for a day of the month. */
export const monthYear = (t: number) => {
  const d = new Date(t);
  return `${d.toLocaleDateString('en-US', { month: 'short' })} ’${String(d.getFullYear()).slice(2)}`;
};
export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** A stretch of time, short: "Nov 17, 10:14 AM – 2:30 PM", or "Nov 3 – Nov 17". */
export const span = (from: number, to: number) => {
  const a = new Date(from * 1000), b = new Date(to * 1000);
  const day = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const hm = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (to - from < 2 * 86400) {
    return a.toDateString() === b.toDateString() ? `${day(a)}, ${hm(a)} – ${hm(b)}` : `${day(a)}, ${hm(a)} – ${day(b)}, ${hm(b)}`;
  }
  const y = a.getFullYear() !== b.getFullYear();
  const dy = (d: Date) => (y ? d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : day(d));
  return `${dy(a)} – ${dy(b)}`;
};
