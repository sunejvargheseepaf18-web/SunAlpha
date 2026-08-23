
// Screener service — runs the pure screen catalog over REAL price history
// from the market feed, across a liquid NSE universe plus the user's own
// equity holdings. Returns ScannerResult rows for the existing Explore UI.

import { ScannerResult } from '../types';
import { getActiveHoldingsData } from './portfolioIoService';
import { getLiveHistory } from './marketFeed';
import { computeScreenerMetrics, runScreens, ScreenerMetrics } from '../domain/screener/screener.engine';
import { runPatternScans } from '../domain/scanner/patternScan.engine';

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
    ...getActiveHoldingsData().filter(h => h.assetType === 'STOCK').map(h => h.symbol)
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
  const metricResults: ScannerResult[] = runScreens(rows).map((hit, i) => ({
    id: `live-scan-${i}`,
    symbol: hit.metrics.symbol,
    type: hit.screen.type,
    signalStrength: hit.strength,
    description: hit.description,
    timestamp,
    tags: hit.screen.tags,
    timeframe: '1D' as const
  }));

  // Bar-pattern scans (breakout/consolidation/NR7/…) over the SAME
  // histories — no extra feed requests.
  const patternResults: ScannerResult[] = [];
  symbols.forEach((symbol, i) => {
    if (histories[i].length < 8) return;
    for (const hit of runPatternScans(histories[i])) {
      patternResults.push({
        id: `pattern-scan-${symbol}-${hit.type}`,
        symbol,
        type: hit.type,
        signalStrength: hit.strength,
        description: hit.description,
        timestamp,
        tags: hit.tags,
        timeframe: '1D' as const
      });
    }
  });

  // Strongest first, capped so the Explore grid stays scannable.
  const results = [...metricResults, ...patternResults]
    .sort((a, b) => b.signalStrength - a.signalStrength)
    .slice(0, 18);

  cache = { results, ts: Date.now() };
  return results;
};
