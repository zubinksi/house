/*
 * The portfolio behind any Hyperliquid address: what it's worth, how that has
 * moved, and what it holds. The star keeps the address in the sidebar.
 *
 * Reads clearinghouseState (perps), spotClearinghouseState (spot balances),
 * portfolio (account value and PnL history) and frontendOpenOrders. Perps and
 * orders are read on every dex the house shows: each HIP-3 dex (trade.xyz's
 * stocks and commodities) keeps its own margin account.
 */
import { useEffect, useRef, useState } from 'react';
import { LinenLine } from './LinenLine';
import { info, fetchMarkets, fetchSpotPrices, price, pct, size, tone, usd, usdShort, monthYear, shortAddr, label, DEXES, DASH } from './hl';
import { toggleStar, useStars } from './stars';
import { StarButton } from './StarButton';
import { MenuButton } from './MenuButton';
import type { Palette } from './App';

const ADDR = /^0x[0-9a-fA-F]{40}$/;
const EXAMPLE = '0x010461c14e146ac35fe42271bdc1134ee31c703a'; // a trading vault inside HLP

const PERIODS = { '1D': 'day', '1W': 'week', '1M': 'month', All: 'allTime' } as const;
type Period = keyof typeof PERIODS;
const PERIOD_WORD: Record<Period, string> = { '1D': '24h', '1W': '7d', '1M': '30d', All: 'all-time' };

interface History { accountValueHistory: [number, string][]; pnlHistory: [number, string][]; vlm: string }
interface Position {
  coin: string; size: number; value: number; entry: number; mark?: number; pnl: number; roe: number;
  liq: number | null; margin: number; leverage: string; funding: number | null;
}
interface Balance { coin: string; total: number; available: number; value: number | null; entry: number }
interface Order { coin: string; side: 'A' | 'B'; limitPx: string; sz: string; timestamp: number; orderType?: string }
interface Data {
  /** the vault's name, or null for an ordinary account */
  vault: string | null;
  perpValue: number; withdrawable: number; spotValue: number;
  history: Record<string, History>; positions: Position[]; balances: Balance[]; orders: Order[];
}

async function load(addr: string): Promise<Data> {
  type Perp = {
    marginSummary: { accountValue: string }; withdrawable: string;
    assetPositions: { position: {
      coin: string; szi: string; positionValue: string; entryPx: string; unrealizedPnl: string; returnOnEquity: string;
      liquidationPx: string | null; marginUsed: string; leverage?: { type: string; value: number }; cumFunding?: { sinceOpen: string };
    } }[];
  };
  const empty: Perp = { marginSummary: { accountValue: '0' }, withdrawable: '0', assetPositions: [] };
  const [perps, spot, portfolio, orderLists, mkts, spotPx, vault] = await Promise.all([
    Promise.all(DEXES.map((dex) =>
      info<Perp>({ type: 'clearinghouseState', user: addr, ...(dex && { dex }) }).catch((e) => (dex ? empty : Promise.reject(e))),
    )),
    info<{ balances: { coin: string; total: string; hold: string; entryNtl: string }[] }>({ type: 'spotClearinghouseState', user: addr }),
    info<[string, History][]>({ type: 'portfolio', user: addr }),
    Promise.all(DEXES.map((dex) =>
      info<Order[]>({ type: 'frontendOpenOrders', user: addr, ...(dex && { dex }) }).catch((e) => (dex ? [] : Promise.reject(e))),
    )),
    fetchMarkets().catch(() => []),
    fetchSpotPrices().catch(() => new Map([['USDC', 1]])),
    info<{ name: string } | null>({ type: 'vaultDetails', vaultAddress: addr }).catch(() => null),
  ]);
  const marks = new Map(mkts.map((m) => [m.name, m.price]));
  const balances = (spot.balances || [])
    .map((b) => {
      const total = +b.total, px = spotPx.get(b.coin);
      return { coin: b.coin, total, available: total - +b.hold, value: px != null ? total * px : null, entry: +b.entryNtl };
    })
    .filter((b) => b.total !== 0)
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  return {
    vault: vault?.name ?? null,
    perpValue: perps.reduce((sum, p) => sum + +p.marginSummary.accountValue, 0),
    withdrawable: perps.reduce((sum, p) => sum + +p.withdrawable, 0),
    spotValue: balances.reduce((s, b) => s + (b.value || 0), 0),
    history: Object.fromEntries(portfolio),
    orders: orderLists.flat().sort((a, b) => b.timestamp - a.timestamp),
    balances,
    positions: perps.flatMap((p) => p.assetPositions || [])
      .map(({ position: p }) => ({
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
      }))
      .sort((a, b) => b.value - a.value),
  };
}

export function Address({ address, onAddress, palette, onMenu }: {
  address: string;
  onAddress: (a: string) => void;
  palette: Palette;
  onMenu: () => void;
}) {
  const [searching, setSearching] = useState(false);
  const [state, setState] = useState<{ addr: string; data?: Data; error?: boolean }>({ addr: '' });
  const [period, setPeriod] = useState<Period>('1M');
  const [series, setSeries] = useState<'value' | 'pnl'>('value');
  const [table, setTable] = useState<'positions' | 'balances' | 'orders'>('positions');
  const [copied, setCopied] = useState('');
  const stars = useStars('addresses');

  useEffect(() => {
    if (!address) return;
    let on = true;
    setState((s) => ({ addr: address, data: s.addr === address ? s.data : undefined }));
    load(address)
      .then((data) => on && setState({ addr: address, data }))
      .catch(() => on && setState({ addr: address, error: true }));
    return () => {
      on = false;
    };
  }, [address]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied('copied');
    } catch {
      setCopied(address); // shown in full to select by hand
    }
    setTimeout(() => setCopied(''), 2500);
  };

  const data = state.addr === address ? state.data : undefined;
  const h = data?.history[PERIODS[period]];
  const pnlPts = (h?.pnlHistory ?? []).map(([t, v]) => ({ time: t / 1000, value: +v }));
  const valuePts = (h?.accountValueHistory ?? []).map(([t, v]) => ({ time: t / 1000, value: +v }));
  const pts = series === 'value' ? valuePts : pnlPts;
  const pnl = pnlPts.length ? pnlPts[pnlPts.length - 1].value - pnlPts[0].value : 0;
  const span = pts.length > 1 ? Date.now() / 1000 - pts[0].time : 86400;

  const formatTime = (t: number) => {
    const d = new Date(t * 1000);
    if (period === '1D') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (period === 'All') return monthYear(t * 1000);
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  return (
    <section className="detail" aria-labelledby="a-title">
      {address ? (
        <div className="m-head">
          <MenuButton onClick={onMenu} />
          <div className="m-id">
            <p className="eyebrow">{data ? (data.vault ? `vault · ${data.vault}` : 'portfolio') : '\u00a0'}</p>
            <div className="m-title">
              <h1 className="m-coin" id="a-title" title={address}>{shortAddr(address)}</h1>
              <StarButton on={stars.includes(address)} label={shortAddr(address)} onClick={() => toggleStar('addresses', address)} />
              <button type="button" className="link a-copy" onClick={copy}>{copied === 'copied' ? 'copied' : 'copy'}</button>
            </div>
            {copied && copied !== 'copied' && <code className="a-full">{copied}</code>}
          </div>
          <button type="button" className="icon-btn" aria-label="Look up another address" aria-expanded={searching} title="Look up an address" onClick={() => setSearching((v) => !v)}>
            <svg viewBox="0 0 16 16" aria-hidden><circle cx="7" cy="7" r="4.6" /><path d="M10.4 10.4 14 14" /></svg>
          </button>
          {searching && (
            <AddressSearch
              stars={stars}
              onPick={(a) => {
                onAddress(a);
                setSearching(false);
              }}
              onClose={() => setSearching(false)}
            />
          )}
        </div>
      ) : (
        <div className="a-start">
          <div className="a-start-head">
          <MenuButton onClick={onMenu} />
          <div className="m-id">
            <p className="eyebrow">portfolio or vault</p>
            <h1 className="m-coin" id="a-title">Look up an address</h1>
          </div>
          </div>
          <AddressForm onPick={onAddress} autoFocus />
          <p className="a-hint">
            or try <button type="button" className="link" onClick={() => onAddress(EXAMPLE)}>one of HLP's trading vaults</button>
          </p>
        </div>
      )}

      {state.error && state.addr === address && (
        <p className="a-error" role="alert">Couldn't load {shortAddr(address)} from Hyperliquid. Check your connection and try again.</p>
      )}

      {address && !state.error && (
        <div className="a-result" data-state={data ? 'ready' : 'loading'}>
          <dl className="stats stats-lead">
            <div><dt>account value</dt><dd>{data ? usd(data.perpValue + data.spotValue) : DASH}</dd></div>
            <div><dt>pnl · {PERIOD_WORD[period]}</dt><dd className={tone(pnl)}>{data ? usd(pnl) : DASH}</dd></div>
            <div><dt>volume · {PERIOD_WORD[period]}</dt><dd>{h ? usdShort(+h.vlm) : DASH}</dd></div>
          </dl>
          <dl className="stats">
            <div><dt>perps equity</dt><dd>{usd(data?.perpValue)}</dd></div>
            <div><dt>spot value</dt><dd>{usd(data?.spotValue)}</dd></div>
            <div><dt>withdrawable</dt><dd>{usd(data?.withdrawable)}</dd></div>
          </dl>

          <div className="module">
            <div className="module-head">
              <div className="seg seg-words" role="group" aria-label="Chart">
                <button type="button" aria-pressed={series === 'value'} onClick={() => setSeries('value')}>account value</button>
                <button type="button" aria-pressed={series === 'pnl'} onClick={() => setSeries('pnl')}>pnl</button>
              </div>
              <div className="seg" role="group" aria-label="Period">
                {(Object.keys(PERIODS) as Period[]).map((p) => (
                  <button key={p} type="button" aria-pressed={p === period} onClick={() => setPeriod(p)}>{p}</button>
                ))}
              </div>
            </div>
            <div className="chart-box">
              <LinenLine
                key={series + period}
                data={pts}
                value={pts[pts.length - 1]?.value ?? 0}
                window={span}
                dark={palette.dark}
                ink={palette.ink}
                thread={palette.thread}
                live={false}
                loading={!data}
                formatValue={(v) => usdShort(v)}
                formatTime={formatTime}
                formatWhen={(t) => new Date(t * 1000).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                note={series === 'value' ? 'account value' : 'profit and loss'}
                emptyText="No history for this period yet"
              />
            </div>
          </div>

          {data && (
            <div className="module">
              <div className="tabs" role="group" aria-label="Holdings">
                {([
                  ['positions', 'positions', data.positions.length],
                  ['balances', 'balances', data.balances.length],
                  ['orders', 'open orders', data.orders.length],
                ] as const).map(([id, label, n]) => (
                  <button key={id} type="button" aria-pressed={table === id} onClick={() => setTable(id)}>
                    {label} {n > 0 && <small>{n}</small>}
                  </button>
                ))}
              </div>
              <div className="table-wrap">
                <table>
                  {table === 'positions' && <Positions rows={data.positions} />}
                  {table === 'balances' && <Balances rows={data.balances} />}
                  {table === 'orders' && <Orders rows={data.orders} />}
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** An address field: checks the shape, then hands the address on in lower case. */
function AddressForm({ onPick, autoFocus }: { onPick: (a: string) => void; autoFocus?: boolean }) {
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);
  return (
    <form
      className="a-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const a = value.trim();
        if (!ADDR.test(a)) return setInvalid(true);
        setInvalid(false);
        onPick(a.toLowerCase());
      }}
    >
      <label className="visually-hidden" htmlFor="a-input">Hyperliquid address</label>
      <input
        id="a-input"
        type="text"
        autoComplete="off"
        spellCheck={false}
        autoFocus={autoFocus}
        placeholder="0x… any Hyperliquid address"
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? 'a-invalid' : undefined}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit" className="btn">look up</button>
      {invalid && <p className="a-error" id="a-invalid" role="alert">An address is 0x followed by 40 letters and numbers.</p>}
    </form>
  );
}

/** The search icon's panel: a field for any address, and the starred ones to jump to. */
function AddressSearch({ stars, onPick, onClose }: { stars: string[]; onPick: (a: string) => void; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node) && !(e.target as Element).closest?.('.icon-btn')) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [onClose]);
  return (
    <div className="search search-wide" ref={box}>
      <AddressForm onPick={onPick} autoFocus />
      <ul className="results" aria-label="Starred addresses">
        {stars.map((a) => (
          <li key={a} onClick={() => onPick(a)} title={a}>
            <span>{shortAddr(a)} <span className="side-star">★</span></span>
          </li>
        ))}
        {!stars.includes(EXAMPLE) && (
          <li onClick={() => onPick(EXAMPLE)} title={EXAMPLE}>
            <span>{shortAddr(EXAMPLE)} <span className="r-note">HLP trading vault</span></span>
          </li>
        )}
      </ul>
    </div>
  );
}

const Empty = ({ cols, text }: { cols: number; text: string }) => (
  <tr><td colSpan={cols} className="empty">{text}</td></tr>
);

function Positions({ rows }: { rows: Position[] }) {
  return (
    <>
      <thead>
        <tr>
          <th scope="col">market</th><th className="num" scope="col">size</th><th className="num" scope="col">value</th>
          <th className="num" scope="col">entry</th><th className="num" scope="col">mark</th><th className="num" scope="col">pnl (roe)</th>
          <th className="num" scope="col">liq. price</th><th className="num" scope="col">margin</th><th className="num" scope="col">funding</th>
        </tr>
      </thead>
      <tbody>
        {rows.length ? rows.map((p) => (
          <tr key={p.coin}>
            <th scope="row">
              {label(p.coin)} <span className={`side ${p.size > 0 ? 'up' : 'down'}`}>{p.size > 0 ? 'long' : 'short'}</span>
              <small>{p.leverage}</small>
            </th>
            <td className="num">{size(Math.abs(p.size))}</td>
            <td className="num">{usd(p.value)}</td>
            <td className="num">{price(p.entry)}</td>
            <td className="num">{price(p.mark)}</td>
            <td className={`num ${tone(p.pnl)}`}>{usd(p.pnl)} <small>({pct(p.roe, 1)})</small></td>
            <td className="num">{p.liq == null ? DASH : price(p.liq)}</td>
            <td className="num">{usd(p.margin)}</td>
            <td className={`num ${tone(p.funding)}`}>{usd(p.funding)}</td>
          </tr>
        )) : <Empty cols={9} text="No open positions." />}
      </tbody>
    </>
  );
}

function Balances({ rows }: { rows: Balance[] }) {
  return (
    <>
      <thead>
        <tr>
          <th scope="col">coin</th><th className="num" scope="col">total</th><th className="num" scope="col">available</th>
          <th className="num" scope="col">value</th><th className="num" scope="col">pnl</th>
        </tr>
      </thead>
      <tbody>
        {rows.length ? rows.map((b) => {
          const pnl = b.value != null && b.coin !== 'USDC' && b.entry ? b.value - b.entry : null;
          return (
            <tr key={b.coin}>
              <th scope="row">{b.coin}</th>
              <td className="num">{size(b.total)}</td>
              <td className="num">{size(b.available)}</td>
              <td className="num">{b.value == null ? DASH : usd(b.value)}</td>
              <td className={`num ${tone(pnl)}`}>{pnl == null ? DASH : usd(pnl)}</td>
            </tr>
          );
        }) : <Empty cols={5} text="No spot balances." />}
      </tbody>
    </>
  );
}

function Orders({ rows }: { rows: Order[] }) {
  return (
    <>
      <thead>
        <tr>
          <th scope="col">placed</th><th scope="col">market</th><th scope="col">order</th>
          <th className="num" scope="col">size</th><th className="num" scope="col">price</th><th className="num" scope="col">value</th>
        </tr>
      </thead>
      <tbody>
        {rows.length ? rows.map((o, i) => (
          <tr key={i}>
            <td>{new Date(o.timestamp).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
            <th scope="row">{label(o.coin)}</th>
            <td className={o.side === 'B' ? 'up' : 'down'}>{o.side === 'B' ? 'buy' : 'sell'} · {(o.orderType || 'limit').toLowerCase()}</td>
            <td className="num">{size(+o.sz)}</td>
            <td className="num">{price(+o.limitPx)}</td>
            <td className="num">{usd(+o.sz * +o.limitPx)}</td>
          </tr>
        )) : <Empty cols={6} text="No open orders." />}
      </tbody>
    </>
  );
}
