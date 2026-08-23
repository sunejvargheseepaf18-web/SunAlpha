
import { describe, it, expect } from 'vitest';
import { computeScreenerMetrics, matches, runScreens, patchLastBarWithQuote, ScreenerMetrics } from './screener.engine';
import { BtBar } from '../backtest/backtest.engine';

const bar = (close: number, i: number, volume = 100000): BtBar => ({
  date: `d${i}`,
  open: close,
  high: close * 1.01,
  low: close * 0.99,
  close,
  volume
});

const trendBars = (start: number, dailyPct: number, days = 80, lastVolume?: number): BtBar[] => {
  const bars: BtBar[] = [];
  let price = start;
  for (let i = 0; i < days; i++) {
    price *= 1 + dailyPct / 100;
    bars.push(bar(price, i, i === days - 1 && lastVolume ? lastVolume : 100000));
  }
  return bars;
};

describe('computeScreenerMetrics', () => {
  it('computes a coherent row for an uptrend', () => {
    const m = computeScreenerMetrics('UP', trendBars(100, 0.5))!;
    expect(m.priceVsSma20Pct).toBeGreaterThan(0); // price above SMA20 in an uptrend
    expect(m.sma20VsSma50Pct).toBeGreaterThan(0); // golden alignment
    expect(m.rsi14).toBeGreaterThan(70); // relentless gains
    expect(m.pctFrom52wHigh).toBeLessThanOrEqual(0);
    expect(m.pctFrom52wLow).toBeGreaterThan(0);
    expect(m.volumeRatio).toBeCloseTo(1, 1);
  });

  it('flags a volume spike via the 20-day ratio', () => {
    const m = computeScreenerMetrics('VOL', trendBars(100, 0.1, 80, 300000))!;
    expect(m.volumeRatio).toBeCloseTo(3, 1);
  });

  it('returns null with insufficient history', () => {
    expect(computeScreenerMetrics('X', trendBars(100, 0.5, 30))).toBeNull();
  });
});

describe('patchLastBarWithQuote', () => {
  it('replaces the forming close with the live price and widens high/low', () => {
    const bars = trendBars(100, 0.2, 70);
    const staleClose = bars[bars.length - 1].close;
    const live = staleClose * 1.03; // live price above the stale bar's high
    const patched = patchLastBarWithQuote(bars, live);
    const last = patched[patched.length - 1];
    expect(last.close).toBe(live);
    expect(last.high).toBe(live); // extended to contain the live print
    expect(patched).toHaveLength(bars.length);
    // The stale array is untouched (pure)
    expect(bars[bars.length - 1].close).toBe(staleClose);
    // And the metrics actually SEE the live price
    const m = computeScreenerMetrics('X', patched)!;
    expect(m.price).toBe(live);
  });

  it('is a no-op for equal price, empty bars or garbage price', () => {
    const bars = trendBars(100, 0.2, 70);
    expect(patchLastBarWithQuote(bars, bars[bars.length - 1].close)).toBe(bars);
    expect(patchLastBarWithQuote([], 100)).toEqual([]);
    expect(patchLastBarWithQuote(bars, 0)).toBe(bars);
  });
});

describe('matches', () => {
  const m = { rsi14: 28, volumeRatio: 2.5 } as ScreenerMetrics;
  it('applies declarative operators', () => {
    expect(matches(m, [{ field: 'rsi14', op: 'LT', value: 30 }])).toBe(true);
    expect(matches(m, [{ field: 'rsi14', op: 'GTE', value: 30 }])).toBe(false);
    expect(
      matches(m, [
        { field: 'rsi14', op: 'LT', value: 30 },
        { field: 'volumeRatio', op: 'GTE', value: 2 }
      ])
    ).toBe(true);
  });
});

describe('runScreens', () => {
  it('an uptrend hits OVERBOUGHT (not OVERSOLD) with a numeric description', () => {
    const rows = [computeScreenerMetrics('UP', trendBars(100, 0.5))!];
    const hits = runScreens(rows);
    const types = hits.map(h => h.screen.type);
    expect(types).toContain('OVERBOUGHT');
    expect(types).not.toContain('OVERSOLD');
    const ob = hits.find(h => h.screen.type === 'OVERBOUGHT')!;
    expect(ob.description).toContain(`RSI ${rows[0].rsi14}`);
    expect(ob.strength).toBeGreaterThan(60);
  });

  it('a downtrend hits OVERSOLD and results sort strongest first', () => {
    const rows = [
      computeScreenerMetrics('DOWN', trendBars(100, -0.5))!,
      computeScreenerMetrics('SPIKE', trendBars(100, 0.1, 80, 500000))!
    ];
    const hits = runScreens(rows);
    expect(hits.some(h => h.screen.type === 'OVERSOLD' && h.metrics.symbol === 'DOWN')).toBe(true);
    expect(hits.some(h => h.screen.type === 'VOLUME_SHOCKER' && h.metrics.symbol === 'SPIKE')).toBe(true);
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i - 1].strength).toBeGreaterThanOrEqual(hits[i].strength);
    }
  });
});
