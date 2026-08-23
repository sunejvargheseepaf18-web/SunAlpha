
import { describe, it, expect } from 'vitest';
import { runBacktest, BtBar, Strategy } from './backtest.engine';
import { buyAndHold, rsi, sma, rsiMeanReversion, smaCrossover } from './strategies';

const bar = (date: string, open: number, close: number): BtBar => ({
  date,
  open,
  high: Math.max(open, close) * 1.005,
  low: Math.min(open, close) * 0.995,
  close,
  volume: 100000
});

// Simple rising series: opens = previous close
const risingBars = (): BtBar[] => {
  const bars: BtBar[] = [];
  let price = 100;
  for (let i = 0; i < 10; i++) {
    const close = price * 1.02;
    bars.push(bar(`2026-07-${String(i + 1).padStart(2, '0')}`, price, close));
    price = close;
  }
  return bars;
};

describe('runBacktest — execution correctness', () => {
  it('executes at the NEXT bar open, never the signal bar close (no lookahead)', () => {
    // Strategy goes LONG from index 2 onward
    const strategy: Strategy = (_bars, index) => (index >= 2 ? 'LONG' : 'FLAT');
    const bars = risingBars();
    const result = runBacktest(bars, strategy, { slippagePct: 0, commissionPct: 0 })!;
    // Signal fires on bar index 2 -> execution at bar index 3's open
    expect(result.trades[0].entryDate).toBe(bars[3].date);
    expect(result.trades[0].entryPrice).toBeCloseTo(bars[3].open, 2);
  });

  it('costs reduce returns: zero-cost run beats costed run', () => {
    const bars = risingBars();
    const free = runBacktest(bars, buyAndHold(), { commissionPct: 0, slippagePct: 0 })!;
    const costed = runBacktest(bars, buyAndHold(), { commissionPct: 0.1, slippagePct: 0.1 })!;
    expect(costed.stats.totalReturnPct).toBeLessThan(free.stats.totalReturnPct);
  });

  it('buy-and-hold strategy return equals the buy-hold benchmark', () => {
    const result = runBacktest(risingBars(), buyAndHold(), { commissionPct: 0.05, slippagePct: 0.05 })!;
    expect(result.stats.totalReturnPct).toBeCloseTo(result.stats.buyHoldReturnPct, 0);
    expect(result.stats.exposurePct).toBeGreaterThan(80);
  });

  it('HOLD keeps the existing position', () => {
    // LONG once at index 1, then HOLD forever -> single trade closed at end
    const strategy: Strategy = (_bars, index) => (index === 1 ? 'LONG' : 'HOLD');
    const result = runBacktest(risingBars(), strategy, {})!;
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].exitDate).toBe(risingBars()[9].date);
  });

  it('produces win-rate and profit factor from the trade log', () => {
    // One winning round trip, one losing round trip
    const bars = [
      bar('2026-07-01', 100, 100),
      bar('2026-07-02', 100, 110), // entry at 100
      bar('2026-07-03', 110, 110), // exit at 110 (win)
      bar('2026-07-04', 110, 110), // entry at 110
      bar('2026-07-05', 99, 99), // exit at 99 (loss)
      bar('2026-07-06', 99, 99)
    ];
    const signals: Record<number, 'LONG' | 'FLAT'> = { 0: 'LONG', 1: 'FLAT', 2: 'LONG', 3: 'FLAT', 4: 'FLAT' };
    const strategy: Strategy = (_bars, index) => signals[index] ?? 'FLAT';
    const result = runBacktest(bars, strategy, { commissionPct: 0, slippagePct: 0 })!;
    expect(result.stats.tradesCount).toBe(2);
    expect(result.stats.winRatePct).toBe(50);
    expect(result.stats.profitFactor).not.toBeNull();
    expect(result.trades[0].returnPct).toBeCloseTo(10, 1);
    expect(result.trades[1].returnPct).toBeCloseTo(-10, 1);
  });

  it('returns null for too-short series', () => {
    expect(runBacktest([bar('2026-07-01', 100, 101)], buyAndHold())).toBeNull();
  });

  it('buyHoldCurve spans every bar and ends consistent with the benchmark return', () => {
    const bars = risingBars();
    const result = runBacktest(bars, buyAndHold(), { commissionPct: 0.05, slippagePct: 0.05 })!;
    expect(result.buyHoldCurve).toHaveLength(bars.length);
    expect(result.buyHoldCurve[0].value).toBe(100000); // pre-entry: all cash
    // Final curve value (marked at close, before exit costs) must sit at or
    // just above the net buy-hold return, never below it.
    const finalPct = ((result.buyHoldCurve[bars.length - 1].value - 100000) / 100000) * 100;
    expect(finalPct).toBeGreaterThanOrEqual(result.stats.buyHoldReturnPct);
    expect(finalPct - result.stats.buyHoldReturnPct).toBeLessThan(0.5);
  });
});

describe('indicators', () => {
  it('sma averages the trailing window and needs a full period', () => {
    const bars = [100, 102, 104, 106].map((c, i) => bar(`2026-07-0${i + 1}`, c, c));
    expect(sma(bars, 2, 0)).toBeNull();
    expect(sma(bars, 2, 3)).toBeCloseTo(105, 5);
  });

  it('rsi is 100 for straight gains and ~0 for straight losses', () => {
    const up = Array.from({ length: 20 }, (_, i) => bar(`d${i}`, 100 + i, 100 + i));
    const down = Array.from({ length: 20 }, (_, i) => bar(`d${i}`, 100 - i, 100 - i));
    expect(rsi(up, 14, 19)).toBe(100);
    expect(rsi(down, 14, 19)!).toBeLessThan(1);
  });
});

describe('built-in strategies', () => {
  it('sma crossover goes long in an uptrend and stays flat before data suffices', () => {
    const strategy = smaCrossover(2, 4);
    const bars = risingBars();
    expect(strategy(bars.slice(0, 2), 1)).toBe('FLAT'); // not enough data
    expect(strategy(bars, bars.length - 1)).toBe('LONG'); // rising: fast > slow
  });

  it('rsi mean reversion holds inside the hysteresis band', () => {
    const strategy = rsiMeanReversion(2, 30, 55);
    // Craft: sharp drop -> RSI < 30 -> LONG; then mild chop -> HOLD
    const bars = [100, 90, 80, 81, 80.5].map((c, i) => bar(`2026-07-0${i + 1}`, c, c));
    expect(strategy(bars, 2)).toBe('LONG'); // deep oversold
    // Mild chop keeps RSI mid-band -> HOLD (never a forced exit)
    const mid = strategy(bars, 4);
    expect(['HOLD', 'LONG']).toContain(mid);
  });
});
