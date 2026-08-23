
// Portfolio analytics — builds a REAL daily portfolio value series from the
// live feeds (equity closes via marketFeed, MF NAVs via mfNavService),
// aligns it with a NIFTY 50 benchmark, and computes the QuantStats-style
// metric core via the pure performance engine. Returns null when the feeds
// can't supply enough history — callers then keep the simulated chart.

import { PortfolioPosition, PortfolioHistoryPoint } from '../types';
import { getLiveHistory } from './marketFeed';
import { resolveScheme, getNavHistory } from './mfNavService';
import {
  computePerformance,
  PerformanceMetrics
} from '../domain/analytics/performance.engine';

export interface PortfolioAnalytics {
  history: PortfolioHistoryPoint[]; // both series normalized to 100 at start
  metrics: PerformanceMetrics | null;
  benchmarkName: string;
}

export type Series = Map<string, number>; // date -> price/NAV

/** Daily price/NAV history for one holding from the live feeds. */
export const getHoldingPriceSeries = async (
  pos: PortfolioPosition,
  days: number
): Promise<Series | null> => {
  try {
    if (pos.assetType === 'STOCK' || pos.assetType === 'CRYPTO') {
      // Crypto resolves to Yahoo '-INR' tickers via SYMBOL_OVERRIDES
      const bars = await getLiveHistory(pos.symbol, days);
      if (bars.length < 2) return null;
      return new Map(bars.map(b => [b.date, b.close]));
    }
    if (pos.assetType === 'MF') {
      const scheme = await resolveScheme(pos.name || pos.symbol);
      if (!scheme) return null;
      const nav = await getNavHistory(scheme.schemeCode, days);
      if (!nav || nav.history.length < 2) return null;
      return new Map(nav.history.map(h => [h.date, h.value]));
    }
    return null;
  } catch {
    return null;
  }
};

// Forward-fill lookup: latest value on or before `date`, given sorted dates.
const buildFilled = (series: Series, dates: string[]): (number | null)[] => {
  let last: number | null = null;
  return dates.map(d => {
    const v = series.get(d);
    if (v !== undefined) last = v;
    return last;
  });
};

export const buildPortfolioAnalytics = async (
  positions: PortfolioPosition[],
  days = 365
): Promise<PortfolioAnalytics | null> => {
  const priced = positions.filter(p => p.assetType === 'STOCK' || p.assetType === 'MF' || p.assetType === 'CRYPTO');
  if (priced.length === 0) return null;

  const [seriesList, benchmarkBars] = await Promise.all([
    Promise.all(priced.map(p => getHoldingPriceSeries(p, days))),
    getLiveHistory('NIFTY 50', days)
  ]);

  const usable = priced
    .map((pos, i) => ({ pos, series: seriesList[i] }))
    .filter((x): x is { pos: PortfolioPosition; series: Series } => x.series !== null);
  if (usable.length === 0) return null;

  // Date axis: union of all dates, starting where every usable series has
  // begun (so a late-starting fund doesn't fake a portfolio jump).
  const allDates = [...new Set(usable.flatMap(u => [...u.series.keys()]))].sort();
  const startDate = usable
    .map(u => [...u.series.keys()].sort()[0])
    .sort()
    .pop()!;
  const dates = allDates.filter(d => d >= startDate);
  if (dates.length < 2) return null;

  const filled = usable.map(u => buildFilled(u.series, dates));
  const portfolioValues: number[] = dates.map((_, di) =>
    usable.reduce((sum, u, ui) => sum + u.pos.quantity * (filled[ui][di] ?? 0), 0)
  );

  // Benchmark aligned to the same dates (may be absent — beta just stays null)
  let benchmarkValues: number[] | undefined;
  if (benchmarkBars.length >= 2) {
    const bSeries: Series = new Map(benchmarkBars.map(b => [b.date, b.close]));
    const bFilled = buildFilled(bSeries, dates);
    if (bFilled.every(v => v !== null)) benchmarkValues = bFilled as number[];
  }

  const calendarDays = Math.max(
    1,
    Math.round((new Date(dates[dates.length - 1]).getTime() - new Date(dates[0]).getTime()) / 86400000)
  );

  const metrics = computePerformance(portfolioValues, {
    benchmarkValues,
    calendarDays
  });

  const p0 = portfolioValues[0];
  const b0 = benchmarkValues?.[0];
  const history: PortfolioHistoryPoint[] = dates.map((date, i) => ({
    date,
    portfolioValue: parseFloat(((portfolioValues[i] / p0) * 100).toFixed(2)),
    benchmarkValue:
      benchmarkValues && b0
        ? parseFloat(((benchmarkValues[i] / b0) * 100).toFixed(2))
        : parseFloat(((portfolioValues[i] / p0) * 100).toFixed(2))
  }));

  return { history, metrics, benchmarkName: 'NIFTY 50' };
};
