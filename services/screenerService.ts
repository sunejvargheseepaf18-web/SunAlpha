
// Screener service — runs the pure screen catalog over REAL price history
// from the market feed, across a liquid NSE universe plus the user's own
// equity holdings. Returns ScannerResult rows for the existing Explore UI.

import { ScannerResult } from '../types';
import { getActiveHoldingsData } from './portfolioIoService';
import { getLiveHistory, getLiveQuotes } from './marketFeed';
import {
  computeScreenerMetrics,
  runScreens,
  patchLastBarWithQuote,
  ScreenerMetrics
} from '../domain/screener/screener.engine';
import { runPatternScans } from '../domain/scanner/patternScan.engine';
import { getLiveChainDetail } from './derivativesFeed';
import { computeOiSummary, oiScanHits } from '../domain/derivatives/oiAnalytics.engine';

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
  const [rawHistories, liveQuotes] = await Promise.all([
    Promise.all(symbols.map(s => getLiveHistory(s, 365))),
    getLiveQuotes(symbols)
  ]);

  // Inject each LIVE quote into its forming last bar so every signal below
  // (RSI/SMA screens and bar patterns alike) fires on the latest price,
  // not on a close staled by cache TTLs.
  const histories = symbols.map((symbol, i) => {
    const quote = liveQuotes.get(symbol);
    return quote ? patchLastBarWithQuote(rawHistories[i], quote.price) : rawHistories[i];
  });

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

  // OI-derived signals from the live index chains: the same intraday OI the
  // option chain shows now feeds the scanner (PCR extremes, fresh writing,
  // max-pain gap) instead of living only on a radar card.
  const oiResults: ScannerResult[] = [];
  for (const indexSymbol of ['NIFTY', 'BANKNIFTY']) {
    const detail = await getLiveChainDetail(indexSymbol);
    if (!detail) continue;
    // Whole-chain OI, not the ATM display window — walls beyond 5 strikes count.
    const summary = computeOiSummary(detail.fullRows);
    if (!summary) continue;
    for (const hit of oiScanHits(summary, detail.spot)) {
      oiResults.push({
        id: `oi-scan-${indexSymbol}-${hit.type}`,
        symbol: indexSymbol,
        type: hit.type,
        signalStrength: hit.strength,
        description: hit.description,
        timestamp: detail.asOf, // NSE's own data time, not our fetch time
        tags: ['Open Interest', hit.sentiment === 'BULLISH' ? 'Bullish' : 'Bearish'],
        timeframe: '1D' as const
      });
    }
  }

  // Strongest first, capped so the Explore grid stays scannable.
  const results = [...metricResults, ...patternResults, ...oiResults]
    .sort((a, b) => b.signalStrength - a.signalStrength)
    .slice(0, 18);

  cache = { results, ts: Date.now() };
  return results;
};
