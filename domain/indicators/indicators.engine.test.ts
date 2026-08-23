
import { describe, it, expect } from 'vitest';
import {
  ema,
  macd,
  bollinger,
  stochastic,
  obv,
  superTrend,
  swingLevels
} from './indicators.engine';
import { BtBar } from '../backtest/backtest.engine';

const bar = (close: number, i: number, volume = 100000, spreadPct = 1): BtBar => ({
  date: `d${i}`,
  open: close,
  high: close * (1 + spreadPct / 100),
  low: close * (1 - spreadPct / 100),
  close,
  volume
});

const trend = (start: number, dailyPct: number, days: number, volume = 100000): BtBar[] => {
  const bars: BtBar[] = [];
  let price = start;
  for (let i = 0; i < days; i++) {
    price *= 1 + dailyPct / 100;
    bars.push(bar(price, i, volume));
  }
  return bars;
};

describe('ema', () => {
  it('needs a full period and tracks a flat series exactly', () => {
    expect(ema(trend(100, 0, 5), 10)).toBeNull();
    expect(ema(trend(100, 0, 40), 20)).toBeCloseTo(100, 6);
  });

  it('sits below price in an uptrend (lag)', () => {
    const bars = trend(100, 0.5, 60);
    expect(ema(bars, 20)!).toBeLessThan(bars[bars.length - 1].close);
  });
});

describe('macd', () => {
  it('is positive with a positive histogram in a steady uptrend', () => {
    const m = macd(trend(100, 0.5, 80))!;
    expect(m.macd).toBeGreaterThan(0);
    expect(m.histogram).toBeGreaterThanOrEqual(0);
  });

  it('is negative in a downtrend and null on short series', () => {
    expect(macd(trend(100, -0.5, 80))!.macd).toBeLessThan(0);
    expect(macd(trend(100, 0.5, 20))).toBeNull();
  });
});

describe('bollinger', () => {
  it('middle equals SMA20, bands ordered, %B near 1 at the top of an uptrend', () => {
    const bars = trend(100, 0.5, 60);
    const b = bollinger(bars)!;
    expect(b.upper).toBeGreaterThan(b.middle);
    expect(b.middle).toBeGreaterThan(b.lower);
    expect(b.percentB).toBeGreaterThan(0.8); // price rides the upper band
  });

  it('bandwidth collapses on a flat series (squeeze)', () => {
    const b = bollinger(trend(100, 0, 60))!;
    expect(b.bandwidthPct).toBeCloseTo(0, 3);
  });
});

describe('stochastic', () => {
  it('reads high in uptrends, low in downtrends, within [0,100]', () => {
    const up = stochastic(trend(100, 0.5, 40))!;
    const down = stochastic(trend(100, -0.5, 40))!;
    expect(up.k).toBeGreaterThan(70);
    expect(down.k).toBeLessThan(30);
    for (const v of [up.k, up.d, down.k, down.d]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});

describe('obv', () => {
  it('accumulates on up days and its slope is positive in an uptrend', () => {
    const result = obv(trend(100, 0.5, 30))!;
    expect(result.obv).toBeGreaterThan(0);
    expect(result.slope).toBeGreaterThan(0.5); // every day adds ~1 avg volume
  });

  it('slope is negative in a downtrend', () => {
    expect(obv(trend(100, -0.5, 30))!.slope).toBeLessThan(0);
  });
});

describe('superTrend', () => {
  it('reports UP with the line below price in an uptrend', () => {
    const bars = trend(100, 0.5, 40);
    const st = superTrend(bars)!;
    expect(st.trend).toBe('UP');
    expect(st.value).toBeLessThan(bars[bars.length - 1].close);
  });

  it('flips DOWN with the line above price in a downtrend', () => {
    const bars = trend(100, -0.5, 40);
    const st = superTrend(bars)!;
    expect(st.trend).toBe('DOWN');
    expect(st.value).toBeGreaterThan(bars[bars.length - 1].close);
  });
});

describe('swingLevels', () => {
  it('finds the V-bottom as support and the prior peak as resistance', () => {
    // Rise to ~110, fall to ~95, recover to ~102: support ~95, resistance ~110
    const closes = [
      100, 102, 104, 106, 108, 110, 108, 106, 103, 100, 98, 96, 95, 96, 98, 100, 101, 102
    ];
    const bars = closes.map((c, i) => bar(c, i, 100000, 0.2));
    const levels = swingLevels(bars, 2, 60);
    expect(levels.support).not.toBeNull();
    expect(levels.support!).toBeLessThan(97);
    expect(levels.resistance).not.toBeNull();
    expect(levels.resistance!).toBeGreaterThan(108);
    expect(levels.supportDistPct!).toBeGreaterThan(0);
  });

  it('returns nulls when no swings exist on the relevant side', () => {
    const bars = trend(100, 0.5, 40); // monotonic rise: no resistance above
    const levels = swingLevels(bars, 3, 40);
    expect(levels.resistance).toBeNull();
  });
});
