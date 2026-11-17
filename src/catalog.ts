/*
 * What each market is: its category, the ticker to show and a plain name.
 *
 * Borrowed from the midnight repo (lib/assets.ts, lib/assetNames.ts): trade.xyz
 * doesn't publish categories through the API, so they're kept here by hand,
 * after docs.trade.xyz/asset-directory. A trade.xyz ticker that isn't listed
 * counts as an equity. Markets on Hyperliquid's own dex are crypto.
 */
import { label, type Market } from './hl';

export type Category = 'crypto' | 'stock' | 'index' | 'commodity' | 'fx' | 'pre-ipo';

const INDICES = new Set(['XYZ100', 'SP500', 'JP225', 'KR200', 'EWY', 'EWJ', 'USAR', 'XLE', 'EWZ', 'VIX']);
const COMMODITIES = new Set([
  'GOLD', 'SILVER', 'PLATINUM', 'PALLADIUM', 'COPPER', 'ALUMINIUM', 'WTIOIL', 'BRENTOIL', 'CL',
  'NATGAS', 'TTF', 'URANIUM', 'URNM', 'CORN', 'WHEAT',
]);
const FX = new Set(['JPY', 'EUR', 'DXY']);
const PRE_IPO = new Set(['SPCX']);

/** Tickers shown under another name (the API name stays for every request). */
const RENAMES: Record<string, string> = { CL: 'WTIOIL' };

const NAMES: Record<string, string> = {
  // US equities
  AAPL: 'Apple Inc.', AMZN: 'Amazon.com', AMD: 'AMD', COIN: 'Coinbase', CRCL: 'Circle Internet',
  GOOGL: 'Alphabet Inc.', HOOD: 'Robinhood', INTC: 'Intel', META: 'Meta Platforms', MSFT: 'Microsoft',
  MSTR: 'Strategy', MU: 'Micron Technology', NFLX: 'Netflix', NVDA: 'NVIDIA', ORCL: 'Oracle',
  PLTR: 'Palantir', RIVN: 'Rivian', SNDK: 'SanDisk', TSLA: 'Tesla',
  // Korean equities
  SMSN: 'Samsung Electronics', SKHX: 'SK Hynix', HYUNDAI: 'Hyundai Motor',
  // ETFs and indices
  EWY: 'iShares MSCI South Korea', EWJ: 'iShares MSCI Japan', USAR: 'iShares US Aggregate Bond',
  XYZ100: 'XYZ U.S. 100', SP500: 'S&P 500', JP225: 'Nikkei 225', KR200: 'KOSPI 200',
  // Commodities
  GOLD: 'Gold', SILVER: 'Silver', PLATINUM: 'Platinum', PALLADIUM: 'Palladium', COPPER: 'Copper',
  WTIOIL: 'Crude Oil', CL: 'Crude Oil', BRENTOIL: 'Brent Crude Oil', NATGAS: 'Natural Gas', URNM: 'Uranium',
  // FX
  JPY: 'Japanese Yen', EUR: 'Euro',
  // Pre-IPO
  SPCX: 'SpaceX',
  // Crypto
  ZEC: 'ZCash', BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', BNB: 'BNB', XRP: 'XRP', DOGE: 'Dogecoin',
  AVAX: 'Avalanche', LINK: 'Chainlink', ADA: 'Cardano', SUI: 'Sui', HYPE: 'Hyperliquid', TON: 'Toncoin',
  ARB: 'Arbitrum',
};

export function categoryOf(m: Pick<Market, 'name' | 'dex'>): Category {
  if (!m.dex) return 'crypto';
  const t = label(m.name);
  if (INDICES.has(t)) return 'index';
  if (COMMODITIES.has(t)) return 'commodity';
  if (FX.has(t)) return 'fx';
  if (PRE_IPO.has(t)) return 'pre-ipo';
  return 'stock';
}

/** The ticker to show: "xyz:CL" → "WTIOIL". */
export const ticker = (name: string) => RENAMES[label(name)] ?? label(name);

/** A plain name where one is known ("Apple Inc."), else empty. */
export const assetName = (name: string) => NAMES[label(name)] ?? '';

/* ── The sidebar's filters, as midnight has them ── */
export type Filter = 'all' | 'starred' | 'crypto' | 'equities' | 'pre-ipo' | 'commodity' | 'fx';

export const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'starred', label: '★' },
  { key: 'crypto', label: 'CRYPTO' },
  { key: 'equities', label: 'EQUITIES' },
  { key: 'pre-ipo', label: 'PRE IPO' },
  { key: 'commodity', label: 'COMMODITIES' },
  { key: 'fx', label: 'FX' },
];

export function inFilter(filter: Filter, m: Market, starred: boolean): boolean {
  if (filter === 'all') return true;
  if (filter === 'starred') return starred;
  const c = categoryOf(m);
  if (filter === 'equities') return c === 'stock' || c === 'index';
  return c === filter;
}
