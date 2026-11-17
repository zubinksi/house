/*
 * hl.js — Hyperliquid's public info API, and the number formats the house uses.
 *
 * Every request is a POST to /info with a JSON body naming its type. No key is
 * needed. Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint
 */
(function () {
  const House = (window.House = window.House || {});
  const API = 'https://api.hyperliquid.xyz/info';

  async function info(body, timeoutMs = 10000) {
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
      return await r.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // Perp markets with their live context, cached briefly so both pages share it.
  let marketsAt = 0, marketsP = null;
  function markets(maxAgeMs = 10000) {
    if (marketsP && Date.now() - marketsAt < maxAgeMs) return marketsP;
    marketsAt = Date.now();
    marketsP = info({ type: 'metaAndAssetCtxs' })
      .then(([meta, ctxs]) =>
        meta.universe
          .map((u, i) => ({ u, c: ctxs[i] }))
          .filter(({ u, c }) => c && !u.isDelisted && c.markPx != null)
          .map(({ u, c }) => {
            const price = +c.markPx, prev = +c.prevDayPx;
            return {
              name: u.name,
              maxLeverage: u.maxLeverage,
              price,
              oracle: +c.oraclePx,
              prev,
              change: prev ? (price - prev) / prev : 0,
              funding: +c.funding,
              oi: +c.openInterest * price,
              vol: +c.dayNtlVlm,
            };
          }),
      )
      .catch((e) => {
        marketsP = null;
        throw e;
      });
    return marketsP;
  }

  // USD price of each spot token, by name, from the spot markets quoted in USDC.
  async function spotPrices() {
    const [meta, ctxs] = await info({ type: 'spotMetaAndAssetCtxs' });
    const byIndex = new Map(meta.tokens.map((t) => [t.index, t.name]));
    const prices = new Map([['USDC', 1]]);
    meta.universe.forEach((pair, i) => {
      const [base, quote] = pair.tokens;
      const ctx = ctxs[i];
      if (quote === 0 && ctx && ctx.markPx != null) {
        const name = byIndex.get(base);
        if (name && !prices.has(name)) prices.set(name, +ctx.markPx);
      }
    });
    return prices;
  }

  /* ── Formats ── */
  const DASH = '—';
  const num = (v) => typeof v === 'number' && isFinite(v);

  function price(p) {
    if (!num(p)) return DASH;
    const d = p >= 10000 ? 0 : p >= 1000 ? 1 : p >= 10 ? 2 : p >= 1 ? 3 : p >= 0.01 ? 4 : 6;
    return p.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function usd(v, dp = 2) {
    if (!num(v)) return DASH;
    const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
    return (v < 0 ? '−$' : '$') + s;
  }
  function usdShort(v) {
    if (!num(v)) return DASH;
    const a = Math.abs(v), sign = v < 0 ? '−' : '';
    if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
    if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2)}M`;
    if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(1)}K`;
    return `${sign}$${a.toFixed(2)}`;
  }
  function pct(v, dp = 2, signed = true) {
    if (!num(v)) return DASH;
    const sign = !signed ? '' : v > 0 ? '+' : v < 0 ? '−' : '';
    return sign + Math.abs(v * 100).toFixed(dp) + '%';
  }
  function size(v) {
    if (!num(v)) return DASH;
    const a = Math.abs(v);
    const d = a >= 1000 ? 2 : a >= 1 ? 4 : 6;
    return v.toLocaleString('en-US', { maximumFractionDigits: d });
  }
  // "May ’23": a month and year, never mistaken for a day of the month
  const monthYear = (t) => {
    const d = new Date(t);
    return `${d.toLocaleDateString('en-US', { month: 'short' })} \u2019${String(d.getFullYear()).slice(2)}`;
  };
  const tone = (v) => (!num(v) ? '' : v > 0 ? 'up' : v < 0 ? 'down' : '');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  House.hl = { info, markets, spotPrices };
  House.fmt = { price, usd, usdShort, pct, size, tone, esc, monthYear, DASH };
})();
