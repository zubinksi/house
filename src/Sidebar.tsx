/*
 * The slab's sidebar: the two pages side by side, and beneath them the list for
 * the page you're on. Markets: starred first, then every market, crypto and
 * traditional (trade.xyz's HIP-3 markets) together, by 24h volume, with live
 * prices.
 * Address: the starred addresses.
 */
import type { Page } from './App';
import { type Market, price, pct, tone, shortAddr, useMids, label } from './hl';
import { useStars } from './stars';

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

function MarketList({ markets, coin, onCoin }: { markets: Market[]; coin: string; onCoin: (c: string) => void }) {
  const stars = useStars('markets');
  const mids = useMids();
  const byName = new Map(markets.map((m) => [m.name, m]));
  const starred = stars.map((s) => byName.get(s)).filter((m): m is Market => !!m);
  const top = markets
    .filter((m) => !stars.includes(m.name))
    .sort((a, b) => b.vol - a.vol);

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
      {starred.length > 0 && <div className="side-rule" />}
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
