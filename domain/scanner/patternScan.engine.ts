
// Pattern scan engine (pure domain logic).
//
// Bar-SEQUENCE scans in the Screeni-py / PKScreener tradition (the leading
// open NSE screeners) — setups the point-metric screener can't see because
// they live in the shape of recent bars, not in a single indicator value:
// - BREAKOUT: close clears the prior N-day high, with the broken level and
//   volume confirmation in the description (Screeni-py's flagship scan).
// - CONSOLIDATION: the whole window trades inside a tight band; the band
//   top is the "possible breakout value" Screeni-py reports.
// - VOLUME_DRYUP: lowest volume of the last N days inside a consolidation —
//   Screeni-py's "early breakout detection" (supply exhausting before the
//   move).
// - NR7: narrowest true range of the last 7 bars (Toby Crabel) — energy
//   coiled for a range expansion in either direction.
// - INSIDE_BAR: today's range inside yesterday's — compression/continuation.
// - NEAR_52W_HIGH: momentum proximity to the yearly high.
// Every hit carries the actual numbers so it can be verified on the chart.

import { BtBar } from '../backtest/backtest.engine';

export type PatternScanType =
  | 'BREAKOUT'
  | 'CONSOLIDATION'
  | 'VOLUME_DRYUP'
  | 'NR7'
  | 'INSIDE_BAR'
  | 'NEAR_52W_HIGH';

export interface PatternHit {
  type: PatternScanType;
  strength: number; // 0-100
  description: string;
  tags: string[];
}

const clamp = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));
const rupees = (v: number): string => `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const avgVolume = (bars: BtBar[], days: number, endExclusive: number): number => {
  const slice = bars.slice(Math.max(0, endExclusive - days), endExclusive);
  if (slice.length === 0) return 0;
  return slice.reduce((s, b) => s + b.volume, 0) / slice.length;
};

/** Close breaks above the prior `lookback`-day high (excluding today). */
export const detectBreakout = (bars: BtBar[], lookback = 20): PatternHit | null => {
  if (bars.length < lookback + 1) return null;
  const last = bars[bars.length - 1];
  const prior = bars.slice(-(lookback + 1), -1);
  const priorHigh = Math.max(...prior.map(b => b.high));
  if (last.close <= priorHigh) return null;

  const marginPct = ((last.close - priorHigh) / priorHigh) * 100;
  if (marginPct > 12) return null; // too extended — that's a chase, not a breakout
  const vol20 = avgVolume(bars, 20, bars.length - 1);
  const volumeRatio = vol20 > 0 ? last.volume / vol20 : 0;
  const confirmed = volumeRatio >= 1.5;

  return {
    type: 'BREAKOUT',
    strength: clamp(55 + marginPct * 6 + (confirmed ? 15 : 0)),
    description: `Close ${rupees(last.close)} broke the ${lookback}-day high of ${rupees(priorHigh)} (+${marginPct.toFixed(1)}%)${
      confirmed ? ` on ${volumeRatio.toFixed(1)}x average volume` : ` on ${volumeRatio.toFixed(1)}x volume — unconfirmed`
    }.`,
    tags: ['Breakout', confirmed ? 'Volume Confirmed' : 'Risk:Med']
  };
};

/**
 * The last `days` bars all trade inside a band no wider than `maxRangePct`.
 * Reports the band top as the possible breakout value.
 */
export const detectConsolidation = (
  bars: BtBar[],
  days = 15,
  maxRangePct = 6
): PatternHit | null => {
  if (bars.length < days) return null;
  const window = bars.slice(-days);
  const high = Math.max(...window.map(b => b.high));
  const low = Math.min(...window.map(b => b.low));
  if (low <= 0) return null;
  const rangePct = ((high - low) / low) * 100;
  if (rangePct > maxRangePct) return null;

  const tightness = maxRangePct - rangePct; // tighter band = stronger squeeze
  return {
    type: 'CONSOLIDATION',
    strength: clamp(50 + tightness * 7),
    description: `${days} days inside a ${rangePct.toFixed(1)}% band (${rupees(low)}–${rupees(high)}). Possible breakout above ${rupees(high)}.`,
    tags: ['Consolidation', 'Watch']
  };
};

/**
 * Screeni-py's early-breakout scan: today's volume is the lowest of the
 * last `days` while price still sits inside a consolidation band.
 */
export const detectVolumeDryUp = (
  bars: BtBar[],
  days = 10,
  maxRangePct = 8
): PatternHit | null => {
  if (bars.length < days) return null;
  const window = bars.slice(-days);
  const last = window[window.length - 1];
  if (last.volume <= 0) return null;
  if (!window.every(b => b.volume >= last.volume)) return null;

  const high = Math.max(...window.map(b => b.high));
  const low = Math.min(...window.map(b => b.low));
  if (low <= 0) return null;
  const rangePct = ((high - low) / low) * 100;
  if (rangePct > maxRangePct) return null;

  const priorAvg = avgVolume(bars, days, bars.length - 1);
  const dryness = priorAvg > 0 ? last.volume / priorAvg : 1;
  return {
    type: 'VOLUME_DRYUP',
    strength: clamp(75 - dryness * 30),
    description: `Lowest volume in ${days} days (${Math.round(dryness * 100)}% of average) inside a ${rangePct.toFixed(1)}% range — supply drying up before a possible move.`,
    tags: ['Early Breakout', 'Volume']
  };
};

const trueRange = (bar: BtBar, prevClose: number): number =>
  Math.max(bar.high - bar.low, Math.abs(bar.high - prevClose), Math.abs(bar.low - prevClose));

/** Narrowest true range of the last 7 bars (NR7, Toby Crabel). */
export const detectNr7 = (bars: BtBar[]): PatternHit | null => {
  if (bars.length < 8) return null;
  const ranges: number[] = [];
  for (let i = bars.length - 7; i < bars.length; i++) {
    ranges.push(trueRange(bars[i], bars[i - 1].close));
  }
  const todayRange = ranges[ranges.length - 1];
  if (!ranges.slice(0, -1).every(r => r > todayRange)) return null;

  const avgRange = ranges.slice(0, -1).reduce((s, r) => s + r, 0) / 6;
  const compression = avgRange > 0 ? todayRange / avgRange : 1;
  return {
    type: 'NR7',
    strength: clamp(80 - compression * 40),
    description: `Narrowest range in 7 days (${Math.round(compression * 100)}% of the week's average) — coiled for a range expansion in either direction.`,
    tags: ['Volatility Squeeze', 'Direction Unknown']
  };
};

/** Today's high and low both inside yesterday's bar. */
export const detectInsideBar = (bars: BtBar[]): PatternHit | null => {
  if (bars.length < 2) return null;
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  if (last.high >= prev.high || last.low <= prev.low) return null;

  const motherRange = prev.high - prev.low;
  const insideRange = last.high - last.low;
  const compression = motherRange > 0 ? insideRange / motherRange : 1;
  return {
    type: 'INSIDE_BAR',
    strength: clamp(70 - compression * 30),
    description: `Inside bar: today's range (${rupees(last.low)}–${rupees(last.high)}) sits inside yesterday's — a break of ${rupees(prev.high)} / ${rupees(prev.low)} sets direction.`,
    tags: ['Compression', 'Direction Unknown']
  };
};

/** Momentum proximity: within `withinPct` of the 52-week high (not at a breakout). */
export const detectNear52wHigh = (bars: BtBar[], withinPct = 5): PatternHit | null => {
  if (bars.length < 60) return null;
  const year = bars.slice(-252);
  const high52 = Math.max(...year.map(b => b.high));
  const last = bars[bars.length - 1];
  if (high52 <= 0) return null;
  const distancePct = ((high52 - last.close) / high52) * 100;
  if (distancePct > withinPct || distancePct <= 0) return null;

  return {
    type: 'NEAR_52W_HIGH',
    strength: clamp(70 - distancePct * 8),
    description: `${distancePct.toFixed(1)}% below the 52-week high of ${rupees(high52)} — strength tends to persist near highs.`,
    tags: ['Momentum', '52W High']
  };
};

/** Run every pattern detector over one symbol's bars. */
export const runPatternScans = (bars: BtBar[]): PatternHit[] =>
  [
    detectBreakout(bars),
    detectConsolidation(bars),
    detectVolumeDryUp(bars),
    detectNr7(bars),
    detectInsideBar(bars),
    detectNear52wHigh(bars)
  ].filter((h): h is PatternHit => h !== null);
