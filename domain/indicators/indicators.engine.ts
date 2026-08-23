
// Technical indicators engine (pure domain logic) — the TA-Lib/pandas-ta
// core set SunAlpha's analysis buckets need: MACD, Bollinger Bands,
// Stochastic, OBV, SuperTrend and swing support/resistance. Everything
// computed from bars up to the last index; no lookahead, no randomness.
// SMA/RSI live in backtest/strategies, ATR in risk/positionSizing — this
// module reuses them rather than reimplementing.

import { BtBar } from '../backtest/backtest.engine';
import { sma } from '../backtest/strategies';
import { atr } from '../risk/positionSizing.engine';

/** EMA of closes over the full series; last value. Null if not enough bars. */
export const ema = (bars: BtBar[], period: number): number | null => {
  if (bars.length < period) return null;
  const k = 2 / (period + 1);
  // Seed with the SMA of the first `period` closes (TA-Lib convention)
  let value = bars.slice(0, period).reduce((s, b) => s + b.close, 0) / period;
  for (let i = period; i < bars.length; i++) {
    value = bars[i].close * k + value * (1 - k);
  }
  return value;
};

export interface MacdResult {
  macd: number; // EMA12 - EMA26
  signal: number; // EMA9 of MACD line
  histogram: number; // macd - signal
}

export const macd = (bars: BtBar[], fast = 12, slow = 26, signalPeriod = 9): MacdResult | null => {
  if (bars.length < slow + signalPeriod) return null;
  // Build the MACD line series over the last stretch, then EMA it.
  const line: number[] = [];
  for (let end = slow; end <= bars.length; end++) {
    const window = bars.slice(0, end);
    const f = ema(window, fast);
    const s = ema(window, slow);
    if (f !== null && s !== null) line.push(f - s);
  }
  if (line.length < signalPeriod) return null;
  const k = 2 / (signalPeriod + 1);
  let sig = line.slice(0, signalPeriod).reduce((s, x) => s + x, 0) / signalPeriod;
  for (let i = signalPeriod; i < line.length; i++) sig = line[i] * k + sig * (1 - k);
  const macdValue = line[line.length - 1];
  return {
    macd: parseFloat(macdValue.toFixed(4)),
    signal: parseFloat(sig.toFixed(4)),
    histogram: parseFloat((macdValue - sig).toFixed(4))
  };
};

export interface BollingerResult {
  middle: number; // SMA20
  upper: number;
  lower: number;
  percentB: number; // 0 = at lower band, 1 = at upper
  bandwidthPct: number; // (upper-lower)/middle * 100 — squeeze detector
}

export const bollinger = (bars: BtBar[], period = 20, stdDevs = 2): BollingerResult | null => {
  const middle = sma(bars, period, bars.length - 1);
  if (middle === null) return null;
  const window = bars.slice(-period).map(b => b.close);
  const variance = window.reduce((s, c) => s + (c - middle) * (c - middle), 0) / period;
  const sd = Math.sqrt(variance);
  const upper = middle + stdDevs * sd;
  const lower = middle - stdDevs * sd;
  const close = bars[bars.length - 1].close;
  return {
    middle: parseFloat(middle.toFixed(2)),
    upper: parseFloat(upper.toFixed(2)),
    lower: parseFloat(lower.toFixed(2)),
    percentB: upper > lower ? parseFloat(((close - lower) / (upper - lower)).toFixed(3)) : 0.5,
    bandwidthPct: middle > 0 ? parseFloat((((upper - lower) / middle) * 100).toFixed(2)) : 0
  };
};

export interface StochasticResult {
  k: number; // fast %K smoothed
  d: number; // %D (SMA3 of %K)
}

export const stochastic = (bars: BtBar[], period = 14, smooth = 3): StochasticResult | null => {
  if (bars.length < period + smooth) return null;
  const rawK: number[] = [];
  for (let end = period; end <= bars.length; end++) {
    const window = bars.slice(end - period, end);
    const high = Math.max(...window.map(b => b.high));
    const low = Math.min(...window.map(b => b.low));
    const close = bars[end - 1].close;
    rawK.push(high > low ? ((close - low) / (high - low)) * 100 : 50);
  }
  const smoothAt = (idx: number): number => {
    const slice = rawK.slice(Math.max(0, idx - smooth + 1), idx + 1);
    return slice.reduce((s, x) => s + x, 0) / slice.length;
  };
  const k = smoothAt(rawK.length - 1);
  const dWindow = [];
  for (let i = Math.max(0, rawK.length - smooth); i < rawK.length; i++) dWindow.push(smoothAt(i));
  const d = dWindow.reduce((s, x) => s + x, 0) / dWindow.length;
  return { k: parseFloat(k.toFixed(1)), d: parseFloat(d.toFixed(1)) };
};

export interface ObvResult {
  obv: number;
  slope: number; // OBV change over the last `slopePeriod` bars, normalized
}

export const obv = (bars: BtBar[], slopePeriod = 10): ObvResult | null => {
  if (bars.length < slopePeriod + 2) return null;
  const series: number[] = [0];
  for (let i = 1; i < bars.length; i++) {
    const prev = series[series.length - 1];
    if (bars[i].close > bars[i - 1].close) series.push(prev + bars[i].volume);
    else if (bars[i].close < bars[i - 1].close) series.push(prev - bars[i].volume);
    else series.push(prev);
  }
  const last = series[series.length - 1];
  const earlier = series[series.length - 1 - slopePeriod];
  const avgVol = bars.slice(-slopePeriod).reduce((s, b) => s + b.volume, 0) / slopePeriod || 1;
  return {
    obv: last,
    slope: parseFloat(((last - earlier) / (avgVol * slopePeriod)).toFixed(3))
  };
};

export interface SuperTrendResult {
  value: number; // the trailing line
  trend: 'UP' | 'DOWN'; // price above the line = UP
}

export const superTrend = (bars: BtBar[], period = 10, multiplier = 3): SuperTrendResult | null => {
  const range = atr(bars, period);
  const baseline = sma(bars, period, bars.length - 1);
  if (range === null || baseline === null) return null;
  const last = bars[bars.length - 1];
  const mid = (last.high + last.low) / 2;
  // Trend from close vs the period baseline (stateless approximation of the
  // classic band-flip logic); the trailing line sits an ATR multiple away.
  const trend: 'UP' | 'DOWN' = last.close >= baseline ? 'UP' : 'DOWN';
  return {
    value: parseFloat((trend === 'UP' ? mid - multiplier * range : mid + multiplier * range).toFixed(2)),
    trend
  };
};

export interface SwingLevels {
  support: number | null; // nearest swing low below the close
  resistance: number | null; // nearest swing high above the close
  supportDistPct: number | null;
  resistanceDistPct: number | null;
}

/** Swing highs/lows: local extremes over a lookback window of `wing` bars each side. */
export const swingLevels = (bars: BtBar[], wing = 3, lookback = 60): SwingLevels => {
  const close = bars[bars.length - 1]?.close ?? 0;
  const window = bars.slice(-lookback);
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = wing; i < window.length - wing; i++) {
    const isHigh = window.every(
      (b, j) => j < i - wing || j > i + wing || b.high <= window[i].high
    );
    const isLow = window.every((b, j) => j < i - wing || j > i + wing || b.low >= window[i].low);
    if (isHigh) highs.push(window[i].high);
    if (isLow) lows.push(window[i].low);
  }
  const support = lows.filter(l => l < close).sort((a, b) => b - a)[0] ?? null;
  const resistance = highs.filter(h => h > close).sort((a, b) => a - b)[0] ?? null;
  return {
    support: support !== null ? parseFloat(support.toFixed(2)) : null,
    resistance: resistance !== null ? parseFloat(resistance.toFixed(2)) : null,
    supportDistPct:
      support !== null && close > 0 ? parseFloat((((close - support) / close) * 100).toFixed(2)) : null,
    resistanceDistPct:
      resistance !== null && close > 0
        ? parseFloat((((resistance - close) / close) * 100).toFixed(2))
        : null
  };
};
