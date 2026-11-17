/*
 * markets.js — one market at a time: its price in linen, and the few numbers
 * that matter. HYPE by default; the search icon (or "/") switches market.
 */
(function () {
  const House = window.House;
  const { fmt, hl } = House;
  const POLL_MS = 15000;

  const RANGES = {
    '1D': { interval: '15m', ms: 864e5 },
    '1W': { interval: '1h', ms: 7 * 864e5 },
    '1M': { interval: '4h', ms: 30 * 864e5 },
    '1Y': { interval: '1d', ms: 365 * 864e5 },
  };

  // Illustrative only: shown, and labelled, when Hyperliquid can't be reached.
  const SAMPLE = [
    ['HYPE', 38.72, 36.9, 0.0000214, 6.9e8, 4.1e8, 10],
    ['BTC', 98450, 97120, 0.0000125, 2.41e9, 3.12e9, 40],
    ['ETH', 3412.6, 3488.1, 0.00001, 1.36e9, 1.48e9, 25],
    ['SOL', 182.41, 179.05, 0.0000125, 5.2e8, 6.3e8, 20],
    ['XRP', 2.312, 2.354, 0.0000081, 2.1e8, 1.9e8, 20],
    ['DOGE', 0.2184, 0.2131, 0.0000125, 1.4e8, 1.2e8, 10],
  ].map(([name, price, prev, funding, oi, vol, maxLeverage]) => ({
    name, price, prev, oracle: price * 1.0002, change: (price - prev) / prev, funding, oi, vol, maxLeverage,
  }));

  function sampleSeries(m, range) {
    const { ms } = RANGES[range];
    const n = 120, now = Date.now();
    let seed = [...m.name].reduce((s, c) => s + c.charCodeAt(0), range.length * 97);
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const vals = [m.price];
    for (let i = 1; i < n; i++) vals.push(vals[i - 1] * (1 + (rnd() - 0.52) * 0.018));
    vals.reverse();
    return vals.map((v, i) => ({ t: now - ms + (i / (n - 1)) * ms, v }));
  }

  const el = {};
  let list = [], current = null, coin = 'HYPE', range = '1W', source = 'loading', chart;
  let series = [], seriesKey = '';

  try {
    coin = localStorage.getItem('house.coin') || 'HYPE';
    range = RANGES[localStorage.getItem('house.range')] ? localStorage.getItem('house.range') : '1W';
  } catch (e) {}

  const tick = (t) => {
    const d = new Date(t);
    if (range === '1D') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (range === '1Y') return fmt.monthYear(t);
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };
  const when = (t) =>
    new Date(t).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  async function loadSeries() {
    const key = coin + range;
    const { interval, ms } = RANGES[range];
    try {
      const now = Date.now();
      const candles = await hl.info({ type: 'candleSnapshot', req: { coin, interval, startTime: now - ms, endTime: now } });
      if (coin + range !== key) return; // switched while loading
      series = candles.map((c) => ({ t: c.t, v: +c.c }));
    } catch (e) {
      series = current ? sampleSeries(current, range) : [];
    }
    seriesKey = key;
    drawChart();
  }

  function drawChart() {
    if (!series.length) return;
    if (current && source === 'live') series[series.length - 1].v = current.price;
    const first = series[0].v, last = series[series.length - 1].v;
    const label = { '1D': 'past day', '1W': 'past week', '1M': 'past month', '1Y': 'past year' }[range];
    chart.set(series, `${fmt.pct((last - first) / first)} over the ${label}`);
  }

  function render() {
    const m = current;
    el.coin.textContent = coin;
    el.eyebrow.textContent = m ? `${coin}-USD perpetual · up to ${m.maxLeverage}× leverage` : `${coin}-USD perpetual`;
    el.price.textContent = m ? '$' + fmt.price(m.price) : fmt.DASH;
    el.change.textContent = m ? `${fmt.pct(m.change)} today` : '';
    el.change.className = 'm-change ' + (m ? fmt.tone(m.change) : '');
    el.oracle.textContent = m ? '$' + fmt.price(m.oracle) : fmt.DASH;
    el.vol.textContent = m ? fmt.usdShort(m.vol) : fmt.DASH;
    el.oi.textContent = m ? fmt.usdShort(m.oi) : fmt.DASH;
    el.funding.textContent = m ? fmt.pct(m.funding, 4) : fmt.DASH;
    el.funding.className = m ? fmt.tone(m.funding) : '';
    el.apr.textContent = m ? fmt.pct(m.funding * 24 * 365, 1) : fmt.DASH;
    el.apr.className = m ? fmt.tone(m.funding) : '';
    el.status.dataset.source = source;
    el.status.textContent =
      source === 'live' ? 'live' : source === 'sample' ? "sample data · couldn't reach Hyperliquid" : 'connecting…';
    el.ranges.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.range === range)));
  }

  async function refresh() {
    try {
      list = await hl.markets();
      source = 'live';
    } catch (e) {
      if (source !== 'live') { list = SAMPLE; source = 'sample'; }
    }
    current = list.find((m) => m.name === coin) || null;
    if (!current && list.length) { coin = list.find((m) => m.name === 'HYPE') ? 'HYPE' : list[0].name; current = list.find((m) => m.name === coin); }
    render();
    if (seriesKey !== coin + range) loadSeries();
    else drawChart();
  }

  function choose(name) {
    coin = name;
    try { localStorage.setItem('house.coin', name); } catch (e) {}
    current = list.find((m) => m.name === name) || null;
    series = [];
    render();
    closeSearch();
    loadSeries();
  }

  /* ── Search ── */
  let matches = [], active = 0;
  function openSearch() {
    el.search.hidden = false;
    el.searchBtn.setAttribute('aria-expanded', 'true');
    el.query.value = '';
    filter();
    el.query.focus();
  }
  function closeSearch() {
    el.search.hidden = true;
    el.searchBtn.setAttribute('aria-expanded', 'false');
  }
  function filter() {
    const q = el.query.value.trim().toUpperCase();
    matches = list
      .filter((m) => !q || m.name.toUpperCase().includes(q))
      .sort((a, b) => (q && (a.name.toUpperCase().startsWith(q) ? 0 : 1) - (b.name.toUpperCase().startsWith(q) ? 0 : 1)) || b.vol - a.vol)
      .slice(0, 40);
    active = 0;
    paint();
  }
  function paint() {
    el.results.innerHTML = matches.length
      ? matches.map((m, i) => `
        <li role="option" id="opt-${i}" data-name="${fmt.esc(m.name)}" aria-selected="${i === active}">
          <span class="r-name">${fmt.esc(m.name)}</span>
          <span class="r-price">${fmt.price(m.price)}</span>
          <span class="r-chg ${fmt.tone(m.change)}">${fmt.pct(m.change)}</span>
        </li>`).join('')
      : '<li class="r-none">No market by that name.</li>';
    el.query.setAttribute('aria-activedescendant', matches.length ? `opt-${active}` : '');
    el.results.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }

  House.markets = {
    mount(root) {
      for (const k of ['coin', 'eyebrow', 'price', 'change', 'oracle', 'vol', 'oi', 'funding', 'apr', 'status', 'ranges', 'search', 'searchBtn', 'query', 'results']) {
        el[k] = root.querySelector(`[data-m="${k}"]`);
      }
      chart = House.chart(root.querySelector('[data-m="chart"]'), {
        format: (v) => '$' + fmt.price(v),
        yFormat: (v) => fmt.price(v),
        when,
        tick,
      });

      el.ranges.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-range]');
        if (!b || b.dataset.range === range) return;
        range = b.dataset.range;
        try { localStorage.setItem('house.range', range); } catch (e) {}
        render();
        loadSeries();
      });

      el.searchBtn.addEventListener('click', () => (el.search.hidden ? openSearch() : closeSearch()));
      el.query.addEventListener('input', filter);
      el.query.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { active = Math.min(matches.length - 1, active + 1); paint(); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); paint(); e.preventDefault(); }
        else if (e.key === 'Enter' && matches[active]) choose(matches[active].name);
        else if (e.key === 'Escape') { closeSearch(); el.searchBtn.focus(); }
      });
      el.results.addEventListener('click', (e) => {
        const li = e.target.closest('li[data-name]');
        if (li) choose(li.dataset.name);
      });
      document.addEventListener('pointerdown', (e) => {
        if (!el.search.hidden && !el.search.contains(e.target) && !el.searchBtn.contains(e.target)) closeSearch();
      });

      render();
      refresh();
      setInterval(() => { if (!document.hidden && House.page === 'markets') refresh(); }, POLL_MS);
      setInterval(() => { if (!document.hidden && House.page === 'markets' && source === 'live') loadSeries(); }, 60000);
    },
    openSearch,
    redraw: () => chart && chart.redraw(),
  };
})();
