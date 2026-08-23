
import { describe, it, expect } from 'vitest';
import {
  computeDailyReturns,
  computeMaxDrawdownPct,
  computePerformance
} from './performance.engine';

describe('computeDailyReturns', () => {
  it('computes simple daily returns and skips zero bases', () => {
    const returns = computeDailyReturns([100, 110, 99]);
    expect(returns).toHaveLength(2);
    expect(returns[0]).toBeCloseTo(0.1, 10);
    expect(returns[1]).toBeCloseTo(-0.1, 10);
    expect(computeDailyReturns([0, 100])).toEqual([]);
  });
});

describe('computeMaxDrawdownPct', () => {
  it('finds the deepest peak-to-trough fall', () => {
    // Peak 120 -> trough 90 = -25%
    expect(computeMaxDrawdownPct([100, 120, 90, 110])).toBeCloseTo(-25, 2);
  });

  it('is zero for a monotonically rising series', () => {
    expect(computeMaxDrawdownPct([100, 101, 105, 110])).toBe(0);
  });
});

describe('computePerformance', () => {
  it('computes total return, CAGR and zero drawdown on steady growth', () => {
    // +1% per day over 60 calendar days (41 observations)
    const values = Array.from({ length: 41 }, (_, i) => 100 * Math.pow(1.01, i));
    const m = computePerformance(values, { calendarDays: 60 })!;
    expect(m.totalReturnPct).toBeCloseTo((Math.pow(1.01, 40) - 1) * 100, 1);
    expect(m.cagrPct).not.toBeNull();
    expect(m.cagrPct!).toBeGreaterThan(m.totalReturnPct); // annualized over <1y
    expect(m.maxDrawdownPct).toBe(0);
    // Constant returns -> ~zero volatility -> sharpe guarded, not Infinity
    expect(isFinite(m.sharpe)).toBe(true);
  });

  it('refuses to annualize very short spans (cagr null) but still reports the rest', () => {
    const m = computePerformance([100, 102, 101, 104], { calendarDays: 4 })!;
    expect(m.cagrPct).toBeNull();
    expect(m.totalReturnPct).toBeCloseTo(4, 1);
  });

  it('beta of a series against itself is 1', () => {
    const values = [100, 103, 99, 104, 102, 108, 105];
    const m = computePerformance(values, { benchmarkValues: values, calendarDays: 30 })!;
    expect(m.beta).toBeCloseTo(1, 2);
  });

  it('beta is null without a usable benchmark', () => {
    const m = computePerformance([100, 101, 102], { calendarDays: 30 })!;
    expect(m.beta).toBeNull();
  });

  it('VaR(95) is a non-positive daily return near the worst tail', () => {
    const values = [100, 101, 102, 100, 103, 104, 98, 99, 101, 103, 104];
    const m = computePerformance(values, { calendarDays: 30 })!;
    expect(m.dailyVar95Pct).toBeLessThanOrEqual(0);
    expect(m.dailyVar95Pct).toBeGreaterThanOrEqual(-6); // sane bound for this series
  });

  it('sortino exceeds sharpe when losses are rare but volatility is high on the upside', () => {
    // Mostly strong up days, one small down day
    const values = [100, 104, 108, 113, 112.9, 118, 123];
    const m = computePerformance(values, { calendarDays: 30 })!;
    expect(m.sortino).toBeGreaterThan(m.sharpe);
  });

  it('returns null for degenerate input', () => {
    expect(computePerformance([], {})).toBeNull();
    expect(computePerformance([100], {})).toBeNull();
    expect(computePerformance([0, 100], {})).toBeNull();
  });
});
