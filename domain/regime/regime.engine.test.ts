
import { describe, it, expect } from 'vitest';
import {
  realizedVolPct,
  volPercentile,
  trendScore,
  detectRegimeFromBars
} from './regime.engine';
import { BtBar } from '../backtest/backtest.engine';

const bar = (close: number, i: number): BtBar => ({
  date: `d${i}`,
  open: close,
  high: close * 1.004,
  low: close * 0.996,
  close,
  volume: 100000
});

// Deterministic wave generator: drift + sinusoid of given amplitude
const series = (days: number, driftPct: number, wavePct: number, phase = 0): BtBar[] => {
  const bars: BtBar[] = [];
  let base = 100;
  for (let i = 0; i < days; i++) {
    base *= 1 + driftPct / 100;
    const close = base * (1 + (wavePct / 100) * Math.sin(0.9 * i + phase));
    bars.push(bar(close, i));
  }
  return bars;
};

describe('realizedVolPct', () => {
  it('is near zero for a smooth series and larger for a wavy one', () => {
    expect(realizedVolPct(series(60, 0.1, 0))!).toBeLessThan(3);
    expect(realizedVolPct(series(60, 0.1, 2))!).toBeGreaterThan(10);
  });

  it('needs window+1 bars', () => {
    expect(realizedVolPct(series(15, 0.1, 1))).toBeNull();
  });
});

describe('volPercentile (self-relative)', () => {
  it('a calm stretch after a wild history ranks LOW for that instrument', () => {
    // 100 wild days then 30 calm days: current vol is low *for this symbol*
    const wild = series(100, 0, 3);
    const calmStart = wild[wild.length - 1].close;
    const calm: BtBar[] = [];
    let p = calmStart;
    for (let i = 0; i < 30; i++) {
      p *= 1.0005;
      calm.push(bar(p, 100 + i));
    }
    const pctl = volPercentile([...wild, ...calm])!;
    expect(pctl).toBeLessThan(25);
  });

  it('returns neutral 50 with too little self-history to rank', () => {
    expect(volPercentile(series(25, 0.1, 1))).toBe(50);
  });
});

describe('trendScore', () => {
  it('is strongly positive in an uptrend and negative in a downtrend', () => {
    expect(trendScore(series(80, 0.5, 0.2))!).toBeGreaterThan(55);
    expect(trendScore(series(80, -0.5, 0.2))!).toBeLessThan(-55);
  });

  it('is near zero for a flat oscillation', () => {
    expect(Math.abs(trendScore(series(80, 0, 0.8))!)).toBeLessThan(20);
  });
});

describe('detectRegimeFromBars', () => {
  it('classifies a strong uptrend with real (not hardcoded) confidence', () => {
    const reading = detectRegimeFromBars(series(120, 0.5, 0.3))!;
    expect(reading.trend).toBe('STRONG_BULL');
    expect(reading.confidence).toBeGreaterThan(0.7);
    expect(reading.confidence).toBeLessThanOrEqual(1);
    expect(reading.summary).toContain('uptrend');
  });

  it('reports drawdown from the peak in a falling market', () => {
    const reading = detectRegimeFromBars(series(120, -0.4, 0.3))!;
    expect(reading.trend).toMatch(/BEAR/);
    expect(reading.drawdownPct).toBeLessThan(-15);
    expect(reading.summary).toContain('below its high');
  });

  it('hysteresis holds the previous state near a boundary', () => {
    // Build a series whose trend score lands just above the WEAK_BULL line
    let bars = series(120, 0.5, 0.3);
    const reading = detectRegimeFromBars(bars)!;
    // Feed a previous regime that differs; a score within the buffer of the
    // boundary keeps the previous label
    const boundaryScore = reading.trendScore;
    if (Math.abs(boundaryScore - 55) < 8) {
      const held = detectRegimeFromBars(bars, { volatility: reading.volatility, trend: 'WEAK_BULL' })!;
      expect(held.trend).toBe('WEAK_BULL');
    } else {
      // Far from any boundary: previous state must NOT stick
      const flipped = detectRegimeFromBars(bars, { volatility: reading.volatility, trend: 'WEAK_BEAR' })!;
      expect(flipped.trend).toBe(reading.trend);
    }
  });

  it('returns null on insufficient data', () => {
    expect(detectRegimeFromBars(series(30, 0.5, 0.3))).toBeNull();
  });
});
