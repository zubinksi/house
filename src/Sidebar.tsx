/*
 * The slab's sidebar: the two pages side by side, and beneath them the list for
 * the page you're on. Markets: midnight's filters and sort over every market,
 * crypto and traditional (trade.xyz's HIP-3 markets), with live prices.
 * Address: the starred addresses.
 */
import { useState } from 'react';
import type { Page } from './App';
import { type Market, price, pct, tone, shortAddr, useMids } from './hl';
import { FILTERS, type Filter, inFilter, ticker, assetName } from './catalog';
import { toggleStar, useStars } from './stars';

export function Sidebar({ page, markets, coin, onCoin, address, onAddress, onClose }: {
  page: Page;
  markets: Market[];
  coin: string;
  onCoin: (c: string) => void;
  address: string;
  onAddress: (a: string) => void;
  /** phones: back to the page without choosing */
  onClose: () => void;
}) {
  return (
    <nav className="sidebar" aria-label="Pages">
      <div className="side-pages">
        <a className="side-page" href="#markets" aria-current={page === 'markets' ? 'page' : undefined}>markets</a>
        <a className="side-page" href="#address" aria-current={page === 'address' ? 'page' : undefined}>address</a>
        <button type="button" className="menu-close" aria-label="Close the menu" onClick={onClose}>
          <svg viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
      {/* keyed by page, so switching pages fades one list into the other */}
      <div className="side-body" key={page}>
        {page === 'markets'
          ? <MarketList markets={markets} coin={coin} onCoin={onCoin} />
          : <AddressList address={address} onAddress={onAddress} />}
      </div>
    </nav>
  );
}

type Sort = 'volume' | 'gainers' | 'losers';
const SORTS: Record<Sort, { next: Sort; title: string }> = {
  volume: { next: 'gainers', title: 'Sorted by 24h volume' },
  gainers: { next: 'losers', title: 'Sorted by biggest gain today' },
  losers: { next: 'volume', title: 'Sorted by biggest fall today' },
};

const remembered = <T extends string>(key: string, ok: readonly T[], fallback: T): T => {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && ok.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
};
const remember = (key: string, v: string) => {
  try {
    localStorage.setItem(key, v);
  } catch {
    // remembered for the visit only
  }
};

/**
 * Every market, filtered and sorted as in the midnight repo: filter chips (all,
 * starred, crypto, equities, pre-IPO, commodities, FX), starred markets first
 * in the order they were starred, then by volume or by the day's move. Each
 * row's star keeps a market on top; the row opens it.
 */
function MarketList({ markets, coin, onCoin }: { markets: Market[]; coin: string; onCoin: (c: string) => void }) {
  const [filter, setFilter] = useState<Filter>(() => remembered('house.filter', FILTERS.map((f) => f.key), 'all'));
  const [sort, setSort] = useState<Sort>(() => remembered('house.sort', ['volume', 'gainers', 'losers'] as const, 'volume'));
  const stars = useStars('markets');
  const mids = useMids();

  const rows = markets.map((m) => {
    const px = mids[m.name] ?? m.price;
    return { m, px, change: m.prev ? (px - m.prev) / m.prev : m.change, star: stars.indexOf(m.name) };
  });
  const shown = rows
    .filter((r) => inFilter(filter, r.m, r.star >= 0))
    .sort((a, b) => {
      if ((a.star >= 0) !== (b.star >= 0)) return a.star >= 0 ? -1 : 1;
      if (a.star >= 0) return a.star - b.star;
      if (sort === 'gainers') return b.change - a.change;
      if (sort === 'losers') return a.change - b.change;
      return b.m.vol - a.m.vol;
    });

  if (!markets.length) return <p className="side-empty">Loading markets…</p>;
  return (
    <>
      <div className="side-filters" role="group" aria-label="Show">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className="chip"
            aria-pressed={f.key === filter}
            aria-label={f.key === 'starred' ? 'Starred' : undefined}
            onClick={() => {
              setFilter(f.key);
              remember('house.filter', f.key);
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="side-head">
        <span>{shown.length} {shown.length === 1 ? 'market' : 'markets'}</span>
        <button
          type="button"
          className="sort-btn"
          data-sort={sort}
          title={`${SORTS[sort].title}. Change the order`}
          aria-label={`${SORTS[sort].title}. Change the order`}
          onClick={() => {
            setSort(SORTS[sort].next);
            remember('house.sort', SORTS[sort].next);
          }}
        >
          <svg viewBox="0 0 20 20" aria-hidden><path d="M3 6h10M3 10h7M3 14h4" /><path className="sort-arrow" d="M15.5 5v10m-2.5-2.5 2.5 2.5 2.5-2.5" /></svg>
        </button>
      </div>
      {shown.length ? (
        <ul className="side-list">
          {shown.map(({ m, px, change, star }) => (
            <li key={m.name} className="side-item" aria-current={m.name === coin ? 'true' : undefined}>
              <button
                type="button"
                className="row-star"
                aria-pressed={star >= 0}
                aria-label={star >= 0 ? `Unstar ${ticker(m.name)}` : `Star ${ticker(m.name)}`}
                onClick={() => toggleStar('markets', m.name)}
              >
                ★
              </button>
              <button type="button" className="side-row" onClick={() => onCoin(m.name)}>
                <span className="side-id">
                  <b>{ticker(m.name)}</b>
                  {assetName(m.name) && <small>{assetName(m.name)}</small>}
                </span>
                <span className="side-q">
                  <span className="side-px">{price(px)}</span>
                  <span className={`side-chg ${tone(change)}`}>{pct(change)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="side-empty">{filter === 'starred' ? 'Star a market to keep it here.' : 'Nothing here right now.'}</p>
      )}
    </>
  );
}

function AddressList({ address, onAddress }: { address: string; onAddress: (a: string) => void }) {
  const stars = useStars('addresses');
  if (!stars.length) return <p className="side-empty">Star an address to keep it here.</p>;
  return (
    <ul className="side-list">
      {stars.map((a) => (
        <li key={a}>
          <button type="button" className="side-row side-addr" aria-current={a === address ? 'true' : undefined} onClick={() => onAddress(a)} title={a}>
            <span className="side-name">
              {shortAddr(a)}
              <span className="side-star" aria-label="starred">★</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
