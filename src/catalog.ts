/*
 * What each market is: its category, the ticker to show and a plain name.
 *
 * Categories, display names and search keywords for HIP-3 markets come from
 * Hyperliquid's API (perpConciseAnnotations), as set by each deployer, so a
 * market that changes (SpaceX listing, Anthropic arriving pre-IPO) moves on its
 * own. Markets on Hyperliquid's own dex are crypto. Only the plain names shown
 * beside a ticker are kept here by hand (from the midnight repo).
 */
import { annotations, label, type Market } from './hl';

/** A market's category, in the API's words, lower case ("stocks", "preipo"…). */
export function categoryOf(m: Pick<Market, 'name' | 'dex'>): string {
  if (!m.dex) return 'crypto';
  const c = annotations.get(m.name)?.category?.toLowerCase();
  if (!c) return 'other';
  return c === 'stock' ? 'stocks' : c;
}

/** The ticker to show: the deployer's display name ("xyz:CL" → "WTIOIL"), else the API's. */
export const ticker = (name: string) => annotations.get(name)?.displayName ?? label(name);

/** Words a search should also match ("anthropic" for ANT, "nasdaq" for XYZ100). */
export const keywords = (name: string) => annotations.get(name)?.keywords ?? [];

const NAMES: Record<string, string> = {
  // US equities
  AAPL: 'Apple Inc.', AMZN: 'Amazon.com', AMD: 'AMD', COIN: 'Coinbase', CRCL: 'Circle Internet',
  GOOGL: 'Alphabet Inc.', HOOD: 'Robinhood', INTC: 'Intel', META: 'Meta Platforms', MSFT: 'Microsoft',
  MSTR: 'Strategy', MU: 'Micron Technology', NFLX: 'Netflix', NVDA: 'NVIDIA', ORCL: 'Oracle',
  PLTR: 'Palantir', RIVN: 'Rivian', SNDK: 'SanDisk', TSLA: 'Tesla', SPCX: 'SpaceX', ANT: 'Anthropic',
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
  // Crypto
  ZEC: 'ZCash', BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', BNB: 'BNB', XRP: 'XRP', DOGE: 'Dogecoin',
  AVAX: 'Avalanche', LINK: 'Chainlink', ADA: 'Cardano', SUI: 'Sui', HYPE: 'Hyperliquid', TON: 'Toncoin',
  ARB: 'Arbitrum',
};

/** A plain name where one is known ("Apple Inc."), else empty. */
export const assetName = (name: string) => NAMES[label(name)] ?? '';

/* ── The sidebar's filters ── */
export type Filter = string; // 'all', 'starred', or a category

/** Known categories in the order their chips appear, with their labels. */
const CATEGORY_LABELS: [string, string][] = [
  ['crypto', 'CRYPTO'],
  ['stocks', 'EQUITIES'],
  ['indices', 'INDICES'],
  ['preipo', 'PRE IPO'],
  ['commodities', 'COMMODITIES'],
  ['fx', 'FX'],
];

/**
 * The chips for the markets there are: all, starred, then each category that
 * has a market, known ones first in a fixed order, any new one after by its own
 * name. A category with nothing in it shows no chip.
 */
export function filtersFor(markets: Market[]): { key: Filter; label: string }[] {
  const present = new Set(markets.map(categoryOf));
  const known = CATEGORY_LABELS.filter(([k]) => present.has(k));
  const others = [...present].filter((c) => !CATEGORY_LABELS.some(([k]) => k === c)).sort();
  return [
    { key: 'all', label: 'ALL' },
    { key: 'starred', label: '★' },
    ...known.map(([key, label]) => ({ key, label })),
    ...others.map((c) => ({ key: c, label: c === 'preipo' ? 'PRE IPO' : c.toUpperCase() })),
  ];
}

export function inFilter(filter: Filter, m: Market, starred: boolean): boolean {
  if (filter === 'all') return true;
  if (filter === 'starred') return starred;
  return categoryOf(m) === filter;
}
