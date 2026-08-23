
// Screener engine (pure domain logic) — the FinViz/tradingview-screener
// model: compute a metric row per symbol from its price history, then apply
// declarative criteria. Screens are data (field/op/value), not code, so new
// ones are additions to a catalog. Descriptions carry the actual numbers —
// a scan hit you can verify, not a vibe.

import { BtBar } from '../backtest/backtest.engine';
import { rsi, sma } from '../backtest/strategies';

export interface ScreenerMetrics {
  symbol: string;
  price: number;
  changePercent: number; // last bar vs previous close
  rsi14: number;
  sma20: number;
  sma50: number;
  priceVsSma20Pct: number; // +ve = above
  sma20VsSma50Pct: number; // +ve = golden alignment
  pctFrom52wHigh: number; // <= 0 (distance below the high)
  pctFrom52wLow: number; // >= 0 (distance above the low)
  volumeRatio: number; // last volume / 20-day average volume
}

const MIN_BARS = 60; // need enough history for SMA50 + RSI to mean anything

export const computeScreenerMetrics = (symbol: string, bars: BtBar[]): ScreenerMetrics | null => {
  if (bars.length < MIN_BARS) return null;
  const last = bars.length - 1;
  const price = bars[last].close;
  const prevClose = bars[last - 1].close;
  const rsi14 = rsi(bars, 14, last);
  const sma20 = sma(bars, 20, last);
  const sma50 = sma(bars, 50, last);
  if (rsi14 === null || sma20 === null || sma50 === null || price <= 0 || prevClose <= 0) return null;

  const yearBars = bars.slice(-252);
  const high52 = Math.max(...yearBars.map(b => b.high));
  const low52 = Math.min(...yearBars.map(b => b.low));

  const vol20 = bars.slice(-21, -1).reduce((s, b) => s + b.volume, 0) / 20;

  return {
    symbol,
    price,
    changePercent: parseFloat((((price - prevClose) / prevClose) * 100).toFixed(2)),
    rsi14: parseFloat(rsi14.toFixed(1)),
    sma20: parseFloat(sma20.toFixed(2)),
    sma50: parseFloat(sma50.toFixed(2)),
    priceVsSma20Pct: parseFloat((((price - sma20) / sma20) * 100).toFixed(2)),
    sma20VsSma50Pct: parseFloat((((sma20 - sma50) / sma50) * 100).toFixed(2)),
    pctFrom52wHigh: parseFloat((((price - high52) / high52) * 100).toFixed(2)),
    pctFrom52wLow: parseFloat((((price - low52) / low52) * 100).toFixed(2)),
    volumeRatio: vol20 > 0 ? parseFloat((bars[last].volume / vol20).toFixed(2)) : 0
  };
};

// --- Declarative criteria ---------------------------------------------------

export type MetricField = Exclude<keyof ScreenerMetrics, 'symbol'>;

export interface Criterion {
  field: MetricField;
  op: 'GT' | 'GTE' | 'LT' | 'LTE';
  value: number;
}

export const matches = (m: ScreenerMetrics, criteria: Criterion[]): boolean =>
  criteria.every(c => {
    const v = m[c.field];
    switch (c.op) {
      case 'GT': return v > c.value;
      case 'GTE': return v >= c.value;
      case 'LT': return v < c.value;
      case 'LTE': return v <= c.value;
    }
  });

// --- Screen catalog ---------------------------------------------------------

export interface ScreenDef {
  type: 'BULLISH_MOMENTUM' | 'BEARISH_MOMENTUM' | 'VOLUME_SHOCKER' | 'OVERSOLD' | 'OVERBOUGHT';
  name: string;
  criteria: Criterion[];
  tags: string[];
  // 0-100 conviction from how decisively the metrics clear the screen
  strength: (m: ScreenerMetrics) => number;
  describe: (m: ScreenerMetrics) => string;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export const SCREEN_CATALOG: ScreenDef[] = [
  {
    type: 'BULLISH_MOMENTUM',
    name: 'Bullish Momentum',
    criteria: [
      { field: 'priceVsSma20Pct', op: 'GT', value: 0 },
      { field: 'sma20VsSma50Pct', op: 'GT', value: 0 },
      { field: 'rsi14', op: 'GTE', value: 55 },
      { field: 'rsi14', op: 'LTE', value: 75 }
    ],
    tags: ['Momentum', 'Trend'],
    strength: m => clamp(50 + m.priceVsSma20Pct * 3 + (m.rsi14 - 55)),
    describe: m =>
      `Price ${m.priceVsSma20Pct.toFixed(1)}% above SMA20, SMA20 ${m.sma20VsSma50Pct.toFixed(1)}% above SMA50, RSI ${m.rsi14}.`
  },
  {
    type: 'BEARISH_MOMENTUM',
    name: 'Bearish Momentum',
    criteria: [
      { field: 'priceVsSma20Pct', op: 'LT', value: 0 },
      { field: 'sma20VsSma50Pct', op: 'LT', value: 0 },
      { field: 'rsi14', op: 'LTE', value: 45 },
      { field: 'rsi14', op: 'GTE', value: 25 }
    ],
    tags: ['Momentum', 'Risk:High'],
    strength: m => clamp(50 - m.priceVsSma20Pct * 3 + (45 - m.rsi14)),
    describe: m =>
      `Price ${Math.abs(m.priceVsSma20Pct).toFixed(1)}% below SMA20 with SMA20 under SMA50, RSI ${m.rsi14}.`
  },
  {
    type: 'OVERSOLD',
    name: 'Oversold',
    criteria: [{ field: 'rsi14', op: 'LT', value: 30 }],
    tags: ['Mean Reversion'],
    strength: m => clamp(60 + (30 - m.rsi14) * 3),
    describe: m => `RSI ${m.rsi14} below 30; ${m.pctFrom52wLow.toFixed(1)}% off the 52-week low.`
  },
  {
    type: 'OVERBOUGHT',
    name: 'Overbought',
    criteria: [{ field: 'rsi14', op: 'GT', value: 70 }],
    tags: ['Mean Reversion', 'Risk:High'],
    strength: m => clamp(60 + (m.rsi14 - 70) * 3),
    describe: m => `RSI ${m.rsi14} above 70; ${Math.abs(m.pctFrom52wHigh).toFixed(1)}% below the 52-week high.`
  },
  {
    type: 'VOLUME_SHOCKER',
    name: 'Volume Shocker',
    criteria: [{ field: 'volumeRatio', op: 'GTE', value: 2 }],
    tags: ['Volume'],
    strength: m => clamp(50 + m.volumeRatio * 10),
    describe: m => `Volume ${m.volumeRatio.toFixed(1)}x the 20-day average on a ${m.changePercent >= 0 ? '+' : ''}${m.changePercent}% day.`
  }
];

export interface ScreenHit {
  screen: ScreenDef;
  metrics: ScreenerMetrics;
  strength: number;
  description: string;
}

/** Run every catalog screen over the metric rows; strongest hits first. */
export const runScreens = (rows: ScreenerMetrics[]): ScreenHit[] => {
  const hits: ScreenHit[] = [];
  for (const screen of SCREEN_CATALOG) {
    for (const m of rows) {
      if (!matches(m, screen.criteria)) continue;
      hits.push({ screen, metrics: m, strength: screen.strength(m), description: screen.describe(m) });
    }
  }
  return hits.sort((a, b) => b.strength - a.strength);
};
