
import { describe, it, expect } from 'vitest';
import {
  detectBreakout,
  detectConsolidation,
  detectVolumeDryUp,
  detectNr7,
  detectInsideBar,
  detectNear52wHigh,
  runPatternScans
} from './patternScan.engine';
import { BtBar } from '../backtest/backtest.engine';

const bar = (
  i: number,
  close: number,
  opts: Partial<Pick<BtBar, 'high' | 'low' | 'volume' | 'open'>> = {}
): BtBar => ({
  date: `d${i}`,
  open: opts.open ?? close,
  high: opts.high ?? close * 1.01,
  low: opts.low ?? close * 0.99,
  close,
  volume: opts.volume ?? 100000
});

// Flat tape at `price` for `days` bars
const flat = (days: number, price = 100, volume = 100000): BtBar[] =>
  Array.from({ length: days }, (_, i) => bar(i, price, { volume }));

describe('detectBreakout', () => {
  it('fires when the close clears the prior 20-day high, volume-confirmed', () => {
    const bars = [...flat(30), bar(30, 104, { high: 104.5, volume: 250000 })];
    const hit = detectBreakout(bars)!;
    expect(hit.type).toBe('BREAKOUT');
    expect(hit.description).toContain('20-day high');
    expect(hit.description).toContain('2.5x average volume');
    expect(hit.tags).toContain('Volume Confirmed');
  });

  it('marks a breakout without volume as unconfirmed', () => {
    const bars = [...flat(30), bar(30, 104, { volume: 100000 })];
    const hit = detectBreakout(bars)!;
    expect(hit.description).toContain('unconfirmed');
  });

  it('does not fire inside the range, nor when over-extended', () => {
    expect(detectBreakout([...flat(30), bar(30, 100.5)])).toBeNull(); // high 101 not cleared
    expect(detectBreakout([...flat(30), bar(30, 120)])).toBeNull(); // +18.8% = chase
  });
});

describe('detectConsolidation', () => {
  it('fires for a tight band and reports the possible breakout value', () => {
    const hit = detectConsolidation(flat(20, 100))!; // band 99–101 = ~2%
    expect(hit.type).toBe('CONSOLIDATION');
    expect(hit.description).toContain('Possible breakout above');
    expect(hit.strength).toBeGreaterThan(60);
  });

  it('does not fire on a trending window', () => {
    const trending = Array.from({ length: 20 }, (_, i) => bar(i, 100 + i));
    expect(detectConsolidation(trending)).toBeNull(); // ~19% range
  });
});

describe('detectVolumeDryUp', () => {
  it('fires when today has the lowest volume of the window inside a range', () => {
    const bars = [...flat(15, 100, 120000), bar(15, 100, { volume: 40000 })];
    const hit = detectVolumeDryUp(bars)!;
    expect(hit.type).toBe('VOLUME_DRYUP');
    expect(hit.description).toContain('Lowest volume in 10 days');
  });

  it('does not fire when volume is not the minimum or the range is wide', () => {
    const notMin = [...flat(15, 100, 30000), bar(15, 100, { volume: 40000 })];
    expect(detectVolumeDryUp(notMin)).toBeNull();
    const wide = Array.from({ length: 15 }, (_, i) => bar(i, 100 + i * 2, { volume: 120000 }));
    expect(detectVolumeDryUp([...wide, bar(15, 130, { volume: 40000 })])).toBeNull();
  });
});

describe('detectNr7', () => {
  it('fires when today has the narrowest true range of 7', () => {
    const bars = [...flat(10, 100), bar(10, 100, { high: 100.2, low: 99.8 })];
    const hit = detectNr7(bars)!;
    expect(hit.type).toBe('NR7');
    expect(hit.tags).toContain('Volatility Squeeze');
  });

  it('does not fire when an earlier bar was narrower', () => {
    const bars = [
      ...flat(9, 100),
      bar(9, 100, { high: 100.1, low: 99.9 }), // narrower bar yesterday
      bar(10, 100, { high: 100.5, low: 99.5 })
    ];
    expect(detectNr7(bars)).toBeNull();
  });
});

describe('detectInsideBar', () => {
  it('fires when today is fully inside yesterday', () => {
    const bars = [
      ...flat(5, 100),
      bar(5, 100, { high: 103, low: 97 }),
      bar(6, 100, { high: 101, low: 99 })
    ];
    const hit = detectInsideBar(bars)!;
    expect(hit.type).toBe('INSIDE_BAR');
    expect(hit.description).toContain('Inside bar');
  });

  it('does not fire when today pokes outside', () => {
    const bars = [
      ...flat(5, 100),
      bar(5, 100, { high: 103, low: 97 }),
      bar(6, 100, { high: 103.5, low: 99 })
    ];
    expect(detectInsideBar(bars)).toBeNull();
  });
});

describe('detectNear52wHigh', () => {
  it('fires within 5% of the yearly high but not at/above it', () => {
    const bars = [...flat(80, 100), ...flat(10, 97).map((b, i) => ({ ...b, date: `e${i}` }))];
    // yearly high = 101; close 97 → 3.96% below
    const hit = detectNear52wHigh(bars)!;
    expect(hit.type).toBe('NEAR_52W_HIGH');
    expect(hit.description).toContain('below the 52-week high');
  });

  it('does not fire deep below the high', () => {
    const bars = [...flat(80, 100), ...flat(10, 80).map((b, i) => ({ ...b, date: `e${i}` }))];
    expect(detectNear52wHigh(bars)).toBeNull();
  });
});

describe('runPatternScans', () => {
  it('a flat consolidating tape yields consolidation-family hits only', () => {
    const hits = runPatternScans(flat(80, 100));
    const types = hits.map(h => h.type);
    expect(types).toContain('CONSOLIDATION');
    expect(types).not.toContain('BREAKOUT');
    for (const hit of hits) {
      expect(hit.strength).toBeGreaterThanOrEqual(0);
      expect(hit.strength).toBeLessThanOrEqual(100);
    }
  });

  it('returns empty on too-little history', () => {
    expect(runPatternScans(flat(3, 100))).toEqual([]);
  });
});
