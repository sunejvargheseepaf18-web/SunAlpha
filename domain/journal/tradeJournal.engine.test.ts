
import { describe, it, expect } from 'vitest';
import { computeJournalStats, enrichTrade, JournalTrade } from './tradeJournal.engine';

const trade = (over: Partial<JournalTrade>): JournalTrade => ({
  id: Math.random().toString(36).slice(2),
  symbol: 'RELIANCE',
  side: 'LONG',
  quantity: 100,
  entryDate: '2026-08-01',
  entryPrice: 100,
  exitDate: '2026-08-05',
  exitPrice: 110,
  ...over
});

describe('enrichTrade', () => {
  it('computes net pnl, return, holding days and R-multiple', () => {
    const e = enrichTrade(
      trade({ fees: 50, plannedRiskAmount: 200 }) // gross +1000, net +950
    );
    expect(e.pnl).toBe(950);
    expect(e.returnPct).toBeCloseTo(9.5, 1);
    expect(e.holdingDays).toBe(4);
    expect(e.rMultiple).toBeCloseTo(4.75, 2);
  });

  it('leaves R null when no risk was defined', () => {
    expect(enrichTrade(trade({})).rMultiple).toBeNull();
  });
});

describe('computeJournalStats', () => {
  const trades: JournalTrade[] = [
    trade({ id: 't1', exitDate: '2026-08-05', exitPrice: 110, setup: 'SMA-CROSS' }), // +1000
    trade({ id: 't2', exitDate: '2026-08-06', exitPrice: 120, setup: 'SMA-CROSS' }), // +2000
    trade({ id: 't3', exitDate: '2026-08-07', exitPrice: 95, setup: 'DIP-BUY', mistakes: ['CHASED'] }), // -500
    trade({ id: 't4', exitDate: '2026-08-08', exitPrice: 90, symbol: 'M&M', setup: 'DIP-BUY' }) // -1000
  ];

  it('computes the core scorecard: win rate, profit factor, expectancy, payoff', () => {
    const s = computeJournalStats(trades);
    expect(s.trades).toBe(4);
    expect(s.winRatePct).toBe(50);
    expect(s.netPnl).toBe(1500);
    expect(s.profitFactor).toBeCloseTo(3000 / 1500, 2);
    expect(s.expectancy).toBeCloseTo(375, 2); // 1500 / 4
    expect(s.avgWin).toBeCloseTo(1500, 2);
    expect(s.avgLoss).toBeCloseTo(750, 2);
    expect(s.payoffRatio).toBeCloseTo(2, 2);
  });

  it('tracks streaks in exit order (2 wins then 2 losses)', () => {
    const s = computeJournalStats(trades);
    expect(s.maxWinStreak).toBe(2);
    expect(s.maxLossStreak).toBe(2);
    expect(s.currentStreak).toBe(-2);
  });

  it('breaks down by setup and symbol with per-group win rates', () => {
    const s = computeJournalStats(trades);
    expect(s.bySetup['SMA-CROSS'].winRatePct).toBe(100);
    expect(s.bySetup['SMA-CROSS'].netPnl).toBe(3000);
    expect(s.bySetup['DIP-BUY'].winRatePct).toBe(0);
    expect(s.bySymbol['M&M'].netPnl).toBe(-1000);
  });

  it('quantifies the cost of tagged mistakes', () => {
    const s = computeJournalStats(trades);
    expect(s.mistakePnl).toBe(-500); // only t3 carries a mistake tag
  });

  it('aggregates daily pnl by exit date', () => {
    const sameDay = [
      trade({ id: 'a', exitDate: '2026-08-05', exitPrice: 110 }), // +1000
      trade({ id: 'b', exitDate: '2026-08-05', exitPrice: 95 }) // -500
    ];
    const s = computeJournalStats(sameDay);
    expect(s.dailyPnl).toEqual([{ date: '2026-08-05', pnl: 500 }]);
  });

  it('expectancyR averages only risk-defined trades', () => {
    const s = computeJournalStats([
      trade({ id: 'r1', plannedRiskAmount: 500, exitPrice: 110 }), // +1000 -> 2R
      trade({ id: 'r2', plannedRiskAmount: 500, exitPrice: 95 }), // -500 -> -1R
      trade({ id: 'r3', exitPrice: 120 }) // no R
    ]);
    expect(s.expectancyR).toBeCloseTo(0.5, 2);
  });

  it('handles an empty journal without NaN', () => {
    const s = computeJournalStats([]);
    expect(s.trades).toBe(0);
    expect(s.winRatePct).toBe(0);
    expect(s.profitFactor).toBeNull();
    expect(s.expectancy).toBe(0);
  });
});
