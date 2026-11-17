/*
 * Stats: numbers across the whole exchange, rather than one market or one
 * address. A first pass from the market data the site already reads; the
 * stats worth tracking here are still being chosen.
 */
import type { Market } from './hl';
import { usdShort, DASH } from './hl';
import { MenuButton } from './MenuButton';

export function Stats({ markets, onMenu }: { markets: Market[]; onMenu: () => void }) {
  const sum = (list: Market[], k: 'vol' | 'oi') => list.reduce((s, m) => s + m[k], 0);
  const hl = markets.filter((m) => !m.dex);
  const xyz = markets.filter((m) => m.dex === 'xyz');
  const ready = markets.length > 0;

  return (
    <section className="detail" aria-labelledby="s-title">
      <div className="m-head">
        <MenuButton onClick={onMenu} />
        <div className="m-id">
          <h1 className="m-ticker" id="s-title"><b>Stats</b><span className="m-name">across Hyperliquid</span></h1>
        </div>
      </div>

      <dl className="stats stats-lead">
        <div><dt>24h volume</dt><dd>{ready ? usdShort(sum(markets, 'vol')) : DASH}</dd></div>
        <div><dt>open interest</dt><dd>{ready ? usdShort(sum(markets, 'oi')) : DASH}</dd></div>
        <div><dt>perp markets</dt><dd>{ready ? markets.length : DASH}</dd></div>
      </dl>

      <dl className="stats">
        <div><dt>Hyperliquid volume</dt><dd>{ready ? usdShort(sum(hl, 'vol')) : DASH}</dd></div>
        <div><dt>trade.xyz volume</dt><dd>{ready ? usdShort(sum(xyz, 'vol')) : DASH}</dd></div>
        <div><dt>Hyperliquid OI</dt><dd>{ready ? usdShort(sum(hl, 'oi')) : DASH}</dd></div>
        <div><dt>trade.xyz OI</dt><dd>{ready ? usdShort(sum(xyz, 'oi')) : DASH}</dd></div>
      </dl>
    </section>
  );
}
