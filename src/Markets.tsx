/*
 * One market at a time: its live price in linen, and the few numbers that
 * matter. The star keeps it at the top of the sidebar; the search icon (or "/")
 * switches market.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LivelinePoint } from 'liveline';
import { LinenLine } from './LinenLine';
import { type Market, fetchCandles, price, pct, tone, usdShort, monthYear, useMids } from './hl';
import { toggleStar, useStars } from './stars';
import { StarButton } from './StarButton';
import type { Palette } from './App';

const RANGES = {
  '1H': { interval: '1m', secs: 3600 },
  '1D': { interval: '15m', secs: 86400 },
  '1W': { interval: '1h', secs: 7 * 86400 },
  '1M': { interval: '4h', secs: 30 * 86400 },
  '1Y': { interval: '1d', secs: 365 * 86400 },
} as const;
type Range = keyof typeof RANGES;

const stored = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

export function Markets({ coin, onCoin, markets, error, palette, searchSignal }: {
  coin: string;
  onCoin: (c: string) => void;
  markets: Market[];
  error: boolean;
  palette: Palette;
  searchSignal: number;
}) {
  const [range, setRange] = useState<Range>(() => (stored('house.range') as Range) in RANGES ? (stored('house.range') as Range) : '1D');
  const [history, setHistory] = useState<{ key: string; points: LivelinePoint[] }>({ key: '', points: [] });
  const [ticks, setTicks] = useState<LivelinePoint[]>([]);
  const [searching, setSearching] = useState(false);
  const mids = useMids();
  const stars = useStars('markets');
  const m = markets.find((x) => x.name === coin);
  const live = mids[coin];
  const px = live ?? m?.price;
  const change = m && px != null && m.prev ? (px - m.prev) / m.prev : m?.change;
  const key = coin + range;

  // the range's candles, refetched every minute
  useEffect(() => {
    let on = true;
    const { interval, secs } = RANGES[range];
    const load = () =>
      fetchCandles(coin, interval, secs * 1000)
        .then((cs) => {
          if (!on) return;
          setHistory({ key, points: cs.map((c) => ({ time: c.t / 1000, value: +c.c })) });
          setTicks([]);
        })
        .catch(() => on && setHistory((h) => (h.key === key ? h : { key, points: [] })));
    load();
    const id = setInterval(() => !document.hidden && load(), 60000);
    return () => {
      on = false;
      clearInterval(id);
    };
  }, [coin, range, key]);

  // each live mid from the socket extends the line
  const lastTick = useRef(0);
  useEffect(() => {
    if (live == null) return;
    const now = Date.now() / 1000;
    if (now - lastTick.current < 1) return;
    lastTick.current = now;
    setTicks((t) => [...t.slice(-600), { time: now, value: live }]);
  }, [live]);
  useEffect(() => setTicks([]), [coin]);

  const data = useMemo(() => {
    if (history.key !== key) return [];
    const last = history.points[history.points.length - 1]?.time ?? 0;
    return [...history.points, ...ticks.filter((t) => t.time > last)];
  }, [history, ticks, key]);

  const formatTime = (t: number) => {
    const d = new Date(t * 1000);
    if (range === '1H' || range === '1D') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (range === '1Y') return monthYear(t * 1000);
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  useEffect(() => {
    if (searchSignal) setSearching(true);
  }, [searchSignal]);

  return (
    <section className="detail" aria-labelledby="m-coin">
      <div className="m-head">
        <div className="m-id">
          <p className="eyebrow">{coin}-USD</p>
          <div className="m-title">
            <h1 className="m-coin" id="m-coin">{coin}</h1>
            <StarButton on={stars.includes(coin)} label={coin} onClick={() => toggleStar('markets', coin)} />
          </div>
        </div>
        <button type="button" className="icon-btn" aria-label="Search markets" aria-expanded={searching} title="Search markets (/)" onClick={() => setSearching((s) => !s)}>
          <svg viewBox="0 0 16 16" aria-hidden><circle cx="7" cy="7" r="4.6" /><path d="M10.4 10.4 14 14" /></svg>
        </button>
        {searching && (
          <Search
            markets={markets}
            onPick={(c) => {
              onCoin(c);
              setSearching(false);
            }}
            onClose={() => setSearching(false)}
          />
        )}
      </div>

      <div className="m-price-row">
        <span className="m-price">{px != null ? '$' + price(px) : '—'}</span>
        {change != null && <span className={`m-change ${tone(change)}`}>{pct(change)} today</span>}
        {error && !m && <span className="m-error">Couldn't reach Hyperliquid.</span>}
      </div>

      <div className="module">
        <div className="module-head">
          <div className="seg" role="group" aria-label="Range">
            {(Object.keys(RANGES) as Range[]).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={r === range}
                onClick={() => {
                  setRange(r);
                  try {
                    localStorage.setItem('house.range', r);
                  } catch {
                    // remembered for the visit only
                  }
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="chart-box">
          <LinenLine
            data={data}
            value={px ?? data[data.length - 1]?.value ?? 0}
            window={RANGES[range].secs}
            dark={palette.dark}
            ink={palette.ink}
            thread={palette.thread}
            loading={!data.length && !error}
            formatValue={(v) => '$' + price(v)}
            formatTime={formatTime}
            emptyText="No prices for this range"
          />
        </div>
      </div>

      <dl className="stats">
        <div><dt>oracle price</dt><dd>{m ? '$' + price(m.oracle) : '—'}</dd></div>
        <div><dt>24h volume</dt><dd>{usdShort(m?.vol)}</dd></div>
        <div><dt>open interest</dt><dd>{usdShort(m?.oi)}</dd></div>
        <div><dt>funding / 1h</dt><dd className={tone(m?.funding)}>{pct(m?.funding, 4)}</dd></div>
        <div><dt>funding / yr</dt><dd className={tone(m?.funding)}>{m ? pct(m.funding * 24 * 365, 1) : '—'}</dd></div>
        <div><dt>max leverage</dt><dd>{m ? `${m.maxLeverage}×` : '—'}</dd></div>
      </dl>
    </section>
  );
}

function Search({ markets, onPick, onClose }: { markets: Market[]; onPick: (c: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const mids = useMids();

  const matches = useMemo(() => {
    const s = q.trim().toUpperCase();
    const starts = (m: Market) => (s && m.name.toUpperCase().startsWith(s) ? 0 : 1);
    return markets
      .filter((m) => !s || m.name.toUpperCase().includes(s))
      .sort((a, b) => starts(a) - starts(b) || b.vol - a.vol)
      .slice(0, 40);
  }, [q, markets]);

  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node) && !(e.target as Element).closest?.('.icon-btn')) onClose();
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [onClose]);
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <div className="search" ref={box}>
      <label className="visually-hidden" htmlFor="m-query">Market</label>
      <input
        id="m-query"
        autoFocus
        type="text"
        placeholder="search markets"
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded
        aria-controls="m-results"
        aria-activedescendant={matches.length ? `opt-${active}` : undefined}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { setActive((a) => Math.min(matches.length - 1, a + 1)); e.preventDefault(); }
          else if (e.key === 'ArrowUp') { setActive((a) => Math.max(0, a - 1)); e.preventDefault(); }
          else if (e.key === 'Enter' && matches[active]) onPick(matches[active].name);
          else if (e.key === 'Escape') onClose();
        }}
      />
      <ul id="m-results" className="results" role="listbox" aria-label="Markets" ref={list}>
        {matches.length ? (
          matches.map((m, i) => {
            const px = mids[m.name] ?? m.price;
            const chg = m.prev ? (px - m.prev) / m.prev : m.change;
            return (
              <li key={m.name} id={`opt-${i}`} role="option" aria-selected={i === active} onClick={() => onPick(m.name)} onMouseMove={() => setActive(i)}>
                <span>{m.name}</span>
                <span className="r-price">{price(px)}</span>
                <span className={`r-chg ${tone(chg)}`}>{pct(chg)}</span>
              </li>
            );
          })
        ) : (
          <li className="r-none">No market by that name.</li>
        )}
      </ul>
    </div>
  );
}
