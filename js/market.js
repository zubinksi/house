/*
 * market.js — the first room: Hyperliquid perpetual markets.
 *
 * Reads the public info endpoint (no key needed) every 15 seconds. If the
 * request fails — offline, or a sandbox that blocks outside requests — the room
 * shows a small set of sample rows and says so.
 */
(function () {
  const House = (window.House = window.House || {});
  const API = 'https://api.hyperliquid.xyz/info';
  const POLL_MS = 15000;
  const ROWS = 20;

  // Illustrative only. Shown, and labelled, when the live API can't be reached.
  const SAMPLE = [
    ['BTC', 98450, 97120, 0.0000125, 2.41e9, 3.12e9],
    ['ETH', 3412.6, 3488.1, 0.0000100, 1.36e9, 1.48e9],
    ['HYPE', 38.72, 36.9, 0.0000214, 6.9e8, 4.1e8],
    ['SOL', 182.41, 179.05, 0.0000125, 5.2e8, 6.3e8],
    ['XRP', 2.312, 2.354, 0.0000081, 2.1e8, 1.9e8],
    ['DOGE', 0.2184, 0.2131, 0.0000125, 1.4e8, 1.2e8],
    ['SUI', 3.861, 3.702, 0.0000162, 9.8e7, 1.1e8],
    ['ENA', 0.6124, 0.6302, -0.0000034, 7.4e7, 9.1e7],
    ['LINK', 19.42, 19.18, 0.0000125, 6.6e7, 5.4e7],
    ['AVAX', 31.6, 32.22, 0.0000097, 4.9e7, 4.4e7],
    ['AAVE', 268.3, 259.9, 0.0000125, 4.1e7, 3.7e7],
    ['kPEPE', 0.01842, 0.01791, 0.0000188, 3.8e7, 5.6e7],
  ].map(([name, price, prev, funding, oi, vol]) => ({ name, price, change: (price - prev) / prev, funding, oi, vol }));

  const COLS = [
    { key: 'name', label: 'market', num: false },
    { key: 'price', label: 'price', num: true },
    { key: 'change', label: '24h', num: true },
    { key: 'funding', label: 'funding / 1h', num: true },
    { key: 'oi', label: 'open interest', num: true },
    { key: 'vol', label: '24h volume', num: true },
  ];

  let rows = [], prices = new Map(), sortKey = 'vol', sortDir = -1;
  let source = 'loading', updated = 0, els = {};

  const fmtPrice = (p) => {
    const d = p >= 1000 ? 1 : p >= 100 ? 2 : p >= 1 ? 3 : p >= 0.01 ? 4 : 6;
    return p.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  };
  const fmtUsd = (v) => {
    const a = Math.abs(v);
    if (a >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
    return '$' + v.toFixed(0);
  };
  const fmtPct = (v, d) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v * 100).toFixed(d) + '%';
  const tone = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : '');

  async function fetchLive() {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
        signal: ctrl.signal,
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const [meta, ctxs] = await r.json();
      return meta.universe
        .map((u, i) => ({ u, c: ctxs[i] }))
        .filter(({ u, c }) => c && !u.isDelisted && c.markPx != null)
        .map(({ u, c }) => {
          const price = +c.markPx, prev = +c.prevDayPx;
          return {
            name: u.name,
            price,
            change: prev ? (price - prev) / prev : 0,
            funding: +c.funding,
            oi: +c.openInterest * price,
            vol: +c.dayNtlVlm,
          };
        });
    } finally {
      clearTimeout(timer);
    }
  }

  function sorted() {
    return rows.slice().sort((a, b) => {
      const x = a[sortKey], y = b[sortKey];
      return (typeof x === 'string' ? x.localeCompare(y) : x - y) * sortDir;
    });
  }

  function renderHead() {
    els.head.innerHTML = COLS.map((c) => {
      const active = c.key === sortKey;
      const arrow = active ? (sortDir < 0 ? ' ↓' : ' ↑') : '';
      const aria = active ? (sortDir < 0 ? 'descending' : 'ascending') : 'none';
      return `<th scope="col" class="${c.num ? 'num' : ''}" aria-sort="${aria}"><button type="button" data-key="${c.key}">${c.label}${arrow}</button></th>`;
    }).join('');
  }

  function renderBody() {
    if (!rows.length) {
      els.body.innerHTML = `<tr><td colspan="${COLS.length}" class="empty">opening the door…</td></tr>`;
      return;
    }
    els.body.innerHTML = sorted().slice(0, ROWS).map((r) => {
      const before = prices.get(r.name);
      const flash = before == null || before === r.price ? '' : r.price > before ? ' flash-up' : ' flash-down';
      return `<tr>
        <th scope="row">${r.name}</th>
        <td class="num${flash}">${fmtPrice(r.price)}</td>
        <td class="num ${tone(r.change)}">${fmtPct(r.change, 2)}</td>
        <td class="num ${tone(r.funding)}">${fmtPct(r.funding, 4)}</td>
        <td class="num">${fmtUsd(r.oi)}</td>
        <td class="num">${fmtUsd(r.vol)}</td>
      </tr>`;
    }).join('');
    prices = new Map(rows.map((r) => [r.name, r.price]));
  }

  function renderSummary() {
    const vol = rows.reduce((s, r) => s + r.vol, 0);
    const oi = rows.reduce((s, r) => s + r.oi, 0);
    els.vol.textContent = rows.length ? fmtUsd(vol) : '—';
    els.oi.textContent = rows.length ? fmtUsd(oi) : '—';
    els.count.textContent = rows.length ? String(rows.length) : '—';
  }

  function renderStatus() {
    const el = els.status;
    el.dataset.source = source;
    if (source === 'live') {
      const s = Math.max(0, Math.round((Date.now() - updated) / 1000));
      el.textContent = `live · updated ${s}s ago`;
    } else if (source === 'sample') {
      el.textContent = 'sample data · live feed unreachable';
    } else {
      el.textContent = 'connecting…';
    }
  }

  async function refresh() {
    try {
      rows = await fetchLive();
      source = 'live';
      updated = Date.now();
    } catch (e) {
      if (source !== 'live') {
        rows = SAMPLE;
        source = 'sample';
      }
    }
    renderSummary();
    renderBody();
    renderStatus();
  }

  House.market = {
    mount(root) {
      els = {
        head: root.querySelector('[data-market-head]'),
        body: root.querySelector('[data-market-body]'),
        status: root.querySelector('[data-market-status]'),
        vol: root.querySelector('[data-sum-vol]'),
        oi: root.querySelector('[data-sum-oi]'),
        count: root.querySelector('[data-sum-count]'),
      };
      els.head.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-key]');
        if (!b) return;
        const key = b.dataset.key;
        sortDir = key === sortKey ? -sortDir : key === 'name' ? 1 : -1;
        sortKey = key;
        renderHead();
        prices = new Map(); // no flashes on a re-sort
        renderBody();
      });
      renderHead();
      renderBody();
      renderStatus();
      refresh();
      setInterval(() => { if (!document.hidden) refresh(); }, POLL_MS);
      setInterval(renderStatus, 1000);
    },
  };
})();
