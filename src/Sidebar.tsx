/*
 * The slab's sidebar: the two pages side by side, and beneath them the list for
 * the page you're on. Markets: starred first, then the busiest by 24h volume,
 * crypto or traditional (trade.xyz's HIP-3 markets), with live prices.
 * Address: the starred addresses.
 */
import { useState } from 'react';
import type { Page } from './App';
import { type Market, price, pct, tone, shortAddr, useMids, label } from './hl';
import { useStars } from './stars';

const TOP = 25;

export function Sidebar({ page, markets, coin, onCoin, address, onAddress }: {
  page: Page;
  markets: Market[];
  coin: string;
  onCoin: (c: string) => void;
  address: string;
  onAddress: (a: string) => void;
}) {
  return (
    <nav className="sidebar" aria-label="Pages">
      <div className="side-pages">
        <a className="side-page" href="#markets" aria-current={page === 'markets' ? 'page' : undefined}>markets</a>
        <a className="side-page" href="#address" aria-current={page === 'address' ? 'page' : undefined}>address</a>
      </div>
      {page === 'markets'
        ? <MarketList markets={markets} coin={coin} onCoin={onCoin} />
        : <AddressList address={address} onAddress={onAddress} />}
    </nav>
  );
}

type Group = 'crypto' | 'traditional';
const GROUP_KEY = 'house.group';

function MarketList({ markets, coin, onCoin }: { markets: Market[]; coin: string; onCoin: (c: string) => void }) {
  const [group, setGroupState] = useState<Group>(() => {
    try {
      return localStorage.getItem(GROUP_KEY) === 'traditional' ? 'traditional' : 'crypto';
    } catch {
      return 'crypto';
    }
  });
  const setGroup = (g: Group) => {
    setGroupState(g);
    try {
      localStorage.setItem(GROUP_KEY, g);
    } catch {
      // remembered for the visit only
    }
  };
  const stars = useStars('markets');
  const mids = useMids();
  const byName = new Map(markets.map((m) => [m.name, m]));
  const starred = stars.map((s) => byName.get(s)).filter((m): m is Market => !!m);
  const top = markets
    .filter((m) => !stars.includes(m.name) && (group === 'crypto') === !m.dex)
    .sort((a, b) => b.vol - a.vol)
    .slice(0, TOP);

  const row = (m: Market, star: boolean) => {
    const px = mids[m.name] ?? m.price;
    const change = m.prev ? (px - m.prev) / m.prev : m.change;
    return (
      <li key={m.name}>
        <button type="button" className="side-row" aria-current={m.name === coin ? 'true' : undefined} onClick={() => onCoin(m.name)}>
          <span className="side-name">
            {label(m.name)}
            {star && <span className="side-star" aria-label="starred">★</span>}
          </span>
          <span className="side-px">{price(px)}</span>
          <span className={`side-chg ${tone(change)}`}>{pct(change, 1)}</span>
        </button>
      </li>
    );
  };

  if (!markets.length) return <p className="side-empty">Loading markets…</p>;
  return (
    <>
      {starred.length > 0 && <ul className="side-list">{starred.map((m) => row(m, true))}</ul>}
      <div className="side-groups" role="group" aria-label="Markets">
        {(['crypto', 'traditional'] as const).map((g) => (
          <button key={g} type="button" aria-pressed={g === group} onClick={() => setGroup(g)}>{g}</button>
        ))}
      </div>
      <ul className="side-list">{top.map((m) => row(m, false))}</ul>
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
