
import { describe, it, expect } from 'vitest';
import { validateTradeRisk } from './risk.engine';
import { RiskConstraints } from './risk.types';
import { atr, sizePosition, sizePositionFromBars } from './positionSizing.engine';
import { BtBar } from '../backtest/backtest.engine';

const constraints: RiskConstraints = {
  maxSingleTradePct: 0.25,
  maxTotalTurnoverPct: 0.5
};

const buy = (symbol: string, amount: number) =>
  ({ symbol, type: 'BUY', amount, assetClass: 'equity' }) as any;
const sell = (symbol: string, amount: number) =>
  ({ symbol, type: 'SELL', amount, assetClass: 'equity' }) as any;

describe('validateTradeRisk — existing gates', () => {
  it('approves compliant trades', () => {
    const result = validateTradeRisk({
      actions: [buy('RELIANCE', 10000)],
      constraints,
      portfolioValue: 100000
    });
    expect(result.approved).toBe(true);
  });

  it('rejects a single trade above the size limit', () => {
    const result = validateTradeRisk({
      actions: [buy('RELIANCE', 30000)],
      constraints,
      portfolioValue: 100000
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('exceeds limit');
  });

  it('rejects symbols outside the allowed universe', () => {
    const result = validateTradeRisk({
      actions: [buy('MEMECOIN', 1000)],
      constraints: { ...constraints, allowedSymbols: ['RELIANCE'] },
      portfolioValue: 100000
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('universe');
  });

  it('rejects excessive total turnover', () => {
    const result = validateTradeRisk({
      actions: [buy('A', 20000), buy('B', 20000), buy('C', 20000)],
      constraints,
      portfolioValue: 100000
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('turnover');
  });
});

describe('validateTradeRisk — circuit breaker', () => {
  const cbConstraints: RiskConstraints = {
    ...constraints,
    haltBuysOnDrawdownPct: 15,
    haltBuysOnDailyLossPct: 3
  };

  it('halts buys when drawdown breaches the threshold', () => {
    const result = validateTradeRisk({
      actions: [buy('RELIANCE', 10000)],
      constraints: cbConstraints,
      portfolioValue: 100000,
      portfolioState: { drawdownFromPeakPct: -16.2 }
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('Circuit breaker');
  });

  it('halts buys after a daily loss beyond the threshold', () => {
    const result = validateTradeRisk({
      actions: [buy('RELIANCE', 10000)],
      constraints: cbConstraints,
      portfolioValue: 100000,
      portfolioState: { dailyPnlPct: -3.5 }
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('down -3.5%');
  });

  it('still allows de-risking SELLs while the breaker is tripped', () => {
    const result = validateTradeRisk({
      actions: [sell('M&M', 10000)],
      constraints: cbConstraints,
      portfolioValue: 100000,
      portfolioState: { drawdownFromPeakPct: -20, dailyPnlPct: -5 }
    });
    expect(result.approved).toBe(true);
  });

  it('is inert without portfolio state (backward compatible)', () => {
    const result = validateTradeRisk({
      actions: [buy('RELIANCE', 10000)],
      constraints: cbConstraints,
      portfolioValue: 100000
    });
    expect(result.approved).toBe(true);
  });
});

// --- Position sizing ---

const bar = (open: number, high: number, low: number, close: number, i: number): BtBar => ({
  date: `2026-07-${String(i + 1).padStart(2, '0')}`,
  open,
  high,
  low,
  close,
  volume: 1000
});

describe('atr', () => {
  it('equals the constant range for uniform bars', () => {
    // Every bar: high-low = 10, no gaps -> ATR = 10
    const bars = Array.from({ length: 20 }, (_, i) => bar(100, 105, 95, 100, i));
    expect(atr(bars, 14)).toBeCloseTo(10, 6);
  });

  it('needs at least period+1 bars', () => {
    const bars = Array.from({ length: 10 }, (_, i) => bar(100, 105, 95, 100, i));
    expect(atr(bars, 14)).toBeNull();
  });
});

describe('sizePosition', () => {
  it('risks exactly the budget: 1% of 10L with a 20-rupee stop -> 500 shares', () => {
    const result = sizePosition({
      capital: 1000000,
      entryPrice: 100,
      stopDistance: 20,
      riskPerTradePct: 1,
      maxPositionPct: 20
    })!;
    // riskBudget 10,000 / 20 = 500 shares; position 50,000 (5%) under the cap
    expect(result.quantity).toBe(500);
    expect(result.riskAmount).toBeCloseTo(10000, 2);
    expect(result.stopPrice).toBe(80);
    expect(result.cappedBy).toBe('RISK');
  });

  it('caps by max position exposure when the stop is tight', () => {
    const result = sizePosition({
      capital: 100000,
      entryPrice: 100,
      stopDistance: 0.5, // tight stop would allow 2,000 shares = 2x capital
      riskPerTradePct: 1,
      maxPositionPct: 20
    })!;
    expect(result.positionValue).toBeLessThanOrEqual(20000 + 100);
    expect(result.cappedBy).toBe('MAX_POSITION');
  });

  it('shrinks size when volatility widens (ATR doubles -> size halves)', () => {
    const calm = sizePosition({ capital: 100000, entryPrice: 100, stopDistance: 4, maxPositionPct: 100 })!;
    const wild = sizePosition({ capital: 100000, entryPrice: 100, stopDistance: 8, maxPositionPct: 100 })!;
    expect(wild.quantity).toBeCloseTo(calm.quantity / 2, 0);
  });

  it('returns null for degenerate inputs', () => {
    expect(sizePosition({ capital: 0, entryPrice: 100, stopDistance: 5 })).toBeNull();
    expect(sizePosition({ capital: 100000, entryPrice: 100, stopDistance: 0 })).toBeNull();
  });

  it('sizes from bars end to end with a 2x ATR stop', () => {
    const bars = Array.from({ length: 30 }, (_, i) => bar(100, 105, 95, 100, i));
    const result = sizePositionFromBars(bars, 1000000, { riskPerTradePct: 1 })!;
    // ATR 10, stop 20 -> same as the direct case above
    expect(result.quantity).toBe(500);
    expect(result.stopPrice).toBe(80);
  });
});
