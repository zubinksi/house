/*
 * address.js — the portfolio behind any Hyperliquid address: what it's worth,
 * how that has moved, and what it holds.
 *
 * Reads clearinghouseState (perps), spotClearinghouseState (spot balances),
 * portfolio (account value and PnL history), and frontendOpenOrders.
 */
(function () {
  const House = window.House;
  const { fmt, hl } = House;
  const ADDR = /^0x[0-9a-fA-F]{40}$/;
  const EXAMPLE = '0x010461c14e146ac35fe42271bdc1134ee31c703a'; // a trading vault inside HLP

  const PERIODS = { '1D': 'day', '1W': 'week', '1M': 'month', 'All': 'allTime' };

  const el = {};
  let address = '', data = null, period = '1M', series = 'value', table = 'positions', chart, loading = 0;

  const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  const tickFor = () => (t) => {
    const d = new Date(t);
    if (period === '1D') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (period === 'All') return fmt.monthYear(t);
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  async function load(addr) {
    const job = ++loading;
    el.result.hidden = false;
    el.error.hidden = true;
    el.result.dataset.state = 'loading';
    el.who.textContent = short(addr);
    el.who.title = addr;
    try {
      const [perp, spot, portfolio, orders, mkts, spotPx] = await Promise.all([
        hl.info({ type: 'clearinghouseState', user: addr }),
        hl.info({ type: 'spotClearinghouseState', user: addr }),
        hl.info({ type: 'portfolio', user: addr }),
        hl.info({ type: 'frontendOpenOrders', user: addr }),
        hl.markets().catch(() => []),
        hl.spotPrices().catch(() => new Map([['USDC', 1]])),
      ]);
      if (job !== loading) return;
      const marks = new Map(mkts.map((m) => [m.name, m.price]));
      const balances = (spot.balances || [])
        .map((b) => {
          const total = +b.total, px = spotPx.get(b.coin);
          return { coin: b.coin, total, available: total - +b.hold, value: px != null ? total * px : null, entry: +b.entryNtl };
        })
        .filter((b) => b.total !== 0)
        .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
      data = {
        perp,
        balances,
        spotValue: balances.reduce((s, b) => s + (b.value || 0), 0),
        history: Object.fromEntries(portfolio),
        orders,
        positions: (perp.assetPositions || []).map(({ position: p }) => ({
          coin: p.coin,
          size: +p.szi,
          value: +p.positionValue,
          entry: +p.entryPx,
          mark: marks.get(p.coin),
          pnl: +p.unrealizedPnl,
          roe: +p.returnOnEquity,
          liq: p.liquidationPx != null ? +p.liquidationPx : null,
          margin: +p.marginUsed,
          leverage: p.leverage ? `${p.leverage.value}× ${p.leverage.type}` : '',
          funding: p.cumFunding ? -+p.cumFunding.sinceOpen : null,
        })).sort((a, b) => b.value - a.value),
      };
      el.result.dataset.state = 'ready';
      render();
    } catch (e) {
      if (job !== loading) return;
      el.result.hidden = true;
      el.error.hidden = false;
      el.error.textContent = `Couldn't load ${short(addr)} from Hyperliquid. Check your connection and try again.`;
    }
  }

  function render() {
    if (!data) return;
    const h = data.history[PERIODS[period]] || { accountValueHistory: [], pnlHistory: [], vlm: '0' };
    const pnlPts = h.pnlHistory.map(([t, v]) => ({ t, v: +v }));
    const pnl = pnlPts.length ? pnlPts[pnlPts.length - 1].v - pnlPts[0].v : 0;
    const perpValue = +data.perp.marginSummary.accountValue;

    el.total.textContent = fmt.usd(perpValue + data.spotValue);
    el.pnl.textContent = fmt.usd(pnl);
    el.pnl.className = fmt.tone(pnl);
    el.volume.textContent = fmt.usdShort(+h.vlm);
    el.perps.textContent = fmt.usd(perpValue);
    el.spot.textContent = fmt.usd(data.spotValue);
    el.withdrawable.textContent = fmt.usd(+data.perp.withdrawable);
    el.periodLabel.forEach((n) => (n.textContent = { '1D': '24h', '1W': '7d', '1M': '30d', All: 'all-time' }[period]));

    const pts = series === 'value' ? h.accountValueHistory.map(([t, v]) => ({ t, v: +v })) : pnlPts;
    el.chartEmpty.hidden = pts.length > 1;
    el.chartBox.hidden = pts.length <= 1;
    if (pts.length > 1) {
      chart.set(pts, series === 'value' ? 'account value' : 'profit and loss');
    }

    el.periods.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.period === period)));
    el.series.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.series === series)));
    el.tabs.querySelectorAll('button').forEach((b) => {
      const n = { positions: data.positions.length, balances: data.balances.length, orders: data.orders.length }[b.dataset.table];
      b.setAttribute('aria-pressed', String(b.dataset.table === table));
      b.querySelector('small').textContent = n ? String(n) : '';
    });
    renderTable();
  }

  function renderTable() {
    const T = { positions: positionsTable, balances: balancesTable, orders: ordersTable }[table];
    el.table.innerHTML = T();
  }

  const empty = (cols, text) => `<tr><td colspan="${cols}" class="empty">${text}</td></tr>`;

  function positionsTable() {
    const rows = data.positions;
    return `<thead><tr>
        <th scope="col">market</th><th class="num" scope="col">size</th><th class="num" scope="col">value</th>
        <th class="num" scope="col">entry</th><th class="num" scope="col">mark</th><th class="num" scope="col">pnl (roe)</th>
        <th class="num" scope="col">liq. price</th><th class="num" scope="col">margin</th><th class="num" scope="col">funding</th>
      </tr></thead><tbody>${
        rows.length
          ? rows.map((p) => `<tr>
            <th scope="row">${fmt.esc(p.coin)} <span class="side ${p.size > 0 ? 'up' : 'down'}">${p.size > 0 ? 'long' : 'short'}</span><small>${fmt.esc(p.leverage)}</small></th>
            <td class="num">${fmt.size(Math.abs(p.size))}</td>
            <td class="num">${fmt.usd(p.value)}</td>
            <td class="num">${fmt.price(p.entry)}</td>
            <td class="num">${fmt.price(p.mark)}</td>
            <td class="num ${fmt.tone(p.pnl)}">${fmt.usd(p.pnl)} <small>(${fmt.pct(p.roe, 1)})</small></td>
            <td class="num">${p.liq == null ? fmt.DASH : fmt.price(p.liq)}</td>
            <td class="num">${fmt.usd(p.margin)}</td>
            <td class="num ${fmt.tone(p.funding)}">${fmt.usd(p.funding)}</td>
          </tr>`).join('')
          : empty(9, 'No open positions.')
      }</tbody>`;
  }

  function balancesTable() {
    const rows = data.balances;
    return `<thead><tr>
        <th scope="col">coin</th><th class="num" scope="col">total</th><th class="num" scope="col">available</th>
        <th class="num" scope="col">value</th><th class="num" scope="col">pnl</th>
      </tr></thead><tbody>${
        rows.length
          ? rows.map((b) => {
            const pnl = b.value != null && b.coin !== 'USDC' && b.entry ? b.value - b.entry : null;
            return `<tr>
              <th scope="row">${fmt.esc(b.coin)}</th>
              <td class="num">${fmt.size(b.total)}</td>
              <td class="num">${fmt.size(b.available)}</td>
              <td class="num">${b.value == null ? fmt.DASH : fmt.usd(b.value)}</td>
              <td class="num ${fmt.tone(pnl)}">${pnl == null ? fmt.DASH : fmt.usd(pnl)}</td>
            </tr>`;
          }).join('')
          : empty(5, 'No spot balances.')
      }</tbody>`;
  }

  function ordersTable() {
    const rows = data.orders;
    return `<thead><tr>
        <th scope="col">placed</th><th scope="col">market</th><th scope="col">order</th>
        <th class="num" scope="col">size</th><th class="num" scope="col">price</th><th class="num" scope="col">value</th>
      </tr></thead><tbody>${
        rows.length
          ? rows.map((o) => `<tr>
            <td>${new Date(o.timestamp).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
            <th scope="row">${fmt.esc(o.coin)}</th>
            <td class="${o.side === 'B' ? 'up' : 'down'}">${o.side === 'B' ? 'buy' : 'sell'} · ${fmt.esc((o.orderType || 'limit').toLowerCase())}</td>
            <td class="num">${fmt.size(+o.sz)}</td>
            <td class="num">${fmt.price(+o.limitPx)}</td>
            <td class="num">${fmt.usd(+o.sz * +o.limitPx)}</td>
          </tr>`).join('')
          : empty(6, 'No open orders.')
      }</tbody>`;
  }

  function submit(value) {
    const a = value.trim();
    if (!ADDR.test(a)) {
      el.error.hidden = false;
      el.error.textContent = 'An address is 0x followed by 40 letters and numbers.';
      el.input.setAttribute('aria-invalid', 'true');
      return;
    }
    el.input.removeAttribute('aria-invalid');
    address = a.toLowerCase();
    el.input.value = address;
    try { localStorage.setItem('house.address', address); } catch (e) {}
    load(address);
  }

  House.address = {
    mount(root) {
      const q = (k) => root.querySelector(`[data-a="${k}"]`);
      for (const k of ['form', 'input', 'example', 'error', 'result', 'who', 'copy', 'total', 'pnl', 'volume', 'perps', 'spot', 'withdrawable', 'periods', 'series', 'chartBox', 'chartEmpty', 'tabs', 'table']) el[k] = q(k);
      el.periodLabel = root.querySelectorAll('[data-a="periodLabel"]');
      chart = House.chart(el.chartBox, {
        format: (v) => fmt.usd(v),
        yFormat: (v) => fmt.usdShort(v),
        when: (t) => new Date(t).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
        tick: (t) => tickFor()(t),
      });

      el.form.addEventListener('submit', (e) => { e.preventDefault(); submit(el.input.value); });
      el.example.addEventListener('click', () => { el.input.value = EXAMPLE; submit(EXAMPLE); });
      el.copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(address); el.copy.textContent = 'copied'; }
        catch (e) { el.copy.textContent = 'select to copy'; el.who.textContent = address; }
        setTimeout(() => (el.copy.textContent = 'copy'), 1600);
      });
      el.periods.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-period]');
        if (b) { period = b.dataset.period; render(); }
      });
      el.series.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-series]');
        if (b) { series = b.dataset.series; render(); }
      });
      el.tabs.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-table]');
        if (b) { table = b.dataset.table; render(); }
      });

      try {
        const saved = localStorage.getItem('house.address');
        if (saved && ADDR.test(saved)) { el.input.value = saved; address = saved; }
      } catch (e) {}
    },
    // Load the remembered address the first time the page is shown.
    show() {
      if (address && !data && !loading) load(address);
      else if (data) chart.redraw();
      if (!address) el.input.focus({ preventScroll: true });
    },
  };
})();
