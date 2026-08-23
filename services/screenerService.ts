
// Screener service — runs the pure screen catalog over REAL price history
// from the market feed, across a liquid NSE universe plus the user's own
// equity holdings. Returns ScannerResult rows for the existing Explore UI.

import { ScannerResult } from '../types';
import { MOCK_HOLDINGS_DATA } from '../constants';
import { getLiveHistory } from './marketFeed';
import { computeScreenerMetrics, runScreens, ScreenerMetrics } from '../domain/screener/screener.engine';

// Liquid NSE names to sweep alongside holdings (kept small: one feed
// request per symbol per run).
const BASE_UNIVERSE = [
  'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN',
  'TATAMOTORS', 'TATASTEEL', 'M&M', 'ADANIENT', 'LT', 'ITC'
];

const CACHE_TTL_MS = 10 * 60 * 1000;
let cache: { results: ScannerResult[]; ts: number } | null = null;

const universe = (): string[] => [
  ...new Set([
    ...BASE_UNIVERSE,
    ...MOCK_HOLDINGS_DATA.filter(h => h.assetType === 'STOCK').map(h => h.symbol)
  ])
];

/**
 * Live market scans. Null when the feed can't supply enough history for any
 * symbol — the caller falls back to its simulated scans.
 */
export const runLiveScreens = async (): Promise<ScannerResult[] | null> => {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache.results;

  const symbols = universe();
  const histories = await Promise.all(symbols.map(s => getLiveHistory(s, 365)));

  const rows: ScreenerMetrics[] = [];
  symbols.forEach((symbol, i) => {
    const m = computeScreenerMetrics(symbol, histories[i]);
    if (m) rows.push(m);
  });
  if (rows.length === 0) return null;

  const timestamp = new Date().toISOString();
  const results: ScannerResult[] = runScreens(rows).map((hit, i) => ({
    id: `live-scan-${i}`,
    symbol: hit.metrics.symbol,
    type: hit.screen.type,
    signalStrength: hit.strength,
    description: hit.description,
    timestamp,
    tags: hit.screen.tags,
    timeframe: '1D' as const
  }));

  cache = { results, ts: Date.now() };
  return results;
};
