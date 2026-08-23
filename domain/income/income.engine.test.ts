
import { describe, it, expect } from 'vitest';
import { computeIncomeReport, IncomeHolding } from './income.engine';

const AS_OF = '2026-08-23';

const reliance: IncomeHolding = {
  symbol: 'RELIANCE',
  name: 'Reliance Industries',
  quantity: 46,
  avgPrice: 1310.1,
  currentPrice: 1318.39
};

const mm: IncomeHolding = {
  symbol: 'M&M',
  name: 'Mahindra & Mahindra',
  quantity: 125,
  avgPrice: 3420.32,
  currentPrice: 3420.32
};

describe('computeIncomeReport', () => {
  it('computes TTM per-share income, yields and totals', () => {
    const report = computeIncomeReport([reliance], {
      RELIANCE: [
        { date: '2025-11-20', amount: 5.5 },
        { date: '2026-08-01', amount: 10 },
        { date: '2024-08-01', amount: 9 } // outside the TTM window — excluded
      ]
    }, AS_OF);

    const r = report.holdings[0];
    expect(r.ttmDividendPerShare).toBeCloseTo(15.5, 3);
    expect(r.ttmIncome).toBeCloseTo(46 * 15.5, 2);
    expect(r.yieldPct).toBeCloseTo((15.5 / 1318.39) * 100, 2);
    expect(r.yieldOnCostPct).toBeCloseTo((15.5 / 1310.1) * 100, 2);
    expect(r.payoutsTtm).toBe(2);
    expect(r.lastPayout!.date).toBe('2026-08-01');
    expect(report.totalTtmIncome).toBeCloseTo(46 * 15.5, 2);
  });

  it('portfolio yield uses total current value including zero-dividend holdings', () => {
    const report = computeIncomeReport([reliance, mm], {
      RELIANCE: [{ date: '2026-08-01', amount: 10 }]
    }, AS_OF);
    const totalValue = 46 * 1318.39 + 125 * 3420.32;
    expect(report.portfolioYieldPct).toBeCloseTo((460 / totalValue) * 100, 2);
    // M&M paid nothing in the window — no row for it
    expect(report.holdings.map(h => h.symbol)).toEqual(['RELIANCE']);
  });

  it('builds a zero-filled 12-month timeline with payouts in the right buckets', () => {
    const report = computeIncomeReport([reliance], {
      RELIANCE: [{ date: '2026-08-01', amount: 10 }]
    }, AS_OF);
    expect(report.monthly).toHaveLength(12);
    expect(report.monthly[0].month).toBe('2025-09'); // oldest first
    const aug = report.monthly.find(m => m.month === '2026-08')!;
    expect(aug.income).toBeCloseTo(460, 2);
    expect(report.monthly.filter(m => m.income === 0).length).toBe(11);
  });

  it('sorts holdings by TTM income, largest first', () => {
    const report = computeIncomeReport([reliance, mm], {
      RELIANCE: [{ date: '2026-08-01', amount: 1 }], // 46
      'M&M': [{ date: '2026-06-01', amount: 20 }] // 2,500
    }, AS_OF);
    expect(report.holdings[0].symbol).toBe('M&M');
  });

  it('handles no dividends anywhere', () => {
    const report = computeIncomeReport([reliance], {}, AS_OF);
    expect(report.holdings).toHaveLength(0);
    expect(report.totalTtmIncome).toBe(0);
    expect(report.portfolioYieldPct).toBe(0);
    expect(report.monthly.every(m => m.income === 0)).toBe(true);
  });
});
