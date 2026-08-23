
import { describe, it, expect } from 'vitest';
import { gradeAdviceJournal, AdviceJournalEntry } from './journal.engine';

const entry = (over: Partial<AdviceJournalEntry>): AdviceJournalEntry => ({
  id: 'e1',
  date: '2026-08-21',
  symbol: 'M&M',
  chip: 'SELL',
  action: 'TRIM',
  priceAtAdvice: 3420.32,
  ...over
});

describe('gradeAdviceJournal', () => {
  it('marks a SELL correct when price fell afterwards', () => {
    const card = gradeAdviceJournal([entry({})], { 'M&M': 3200 });
    expect(card.graded).toBe(1);
    expect(card.entries[0].correct).toBe(true);
    expect(card.entries[0].returnPct).toBeCloseTo(((3200 - 3420.32) / 3420.32) * 100, 1);
  });

  it('marks a SELL wrong when price rose afterwards', () => {
    const card = gradeAdviceJournal([entry({})], { 'M&M': 3600 });
    expect(card.entries[0].correct).toBe(false);
    expect(card.hitRatePct).toBe(0);
  });

  it('marks a BUY correct on a rise and a HOLD correct inside the ±5% band', () => {
    const card = gradeAdviceJournal(
      [
        entry({ id: 'b', symbol: 'RELIANCE', chip: 'BUY', action: 'ADD', priceAtAdvice: 1310 }),
        entry({ id: 'h', symbol: 'AXIS-ELSS', chip: 'HOLD', action: 'HOLD', priceAtAdvice: 109.29 })
      ],
      { RELIANCE: 1360, 'AXIS-ELSS': 111 } // +3.8% and +1.6%
    );
    expect(card.correct).toBe(2);
    expect(card.hitRatePct).toBe(100);
  });

  it('marks a HOLD wrong when the price moved beyond the band', () => {
    const card = gradeAdviceJournal(
      [entry({ chip: 'HOLD', action: 'HOLD', priceAtAdvice: 100 })],
      { 'M&M': 112 } // +12% missed
    );
    expect(card.entries[0].correct).toBe(false);
  });

  it('skips entries with no current price and reports totals honestly', () => {
    const card = gradeAdviceJournal(
      [entry({}), entry({ id: 'e2', symbol: 'UNKNOWN' })],
      { 'M&M': 3300 }
    );
    expect(card.total).toBe(2);
    expect(card.graded).toBe(1);
  });

  it('handles an empty journal without dividing by zero', () => {
    const card = gradeAdviceJournal([], {});
    expect(card.hitRatePct).toBe(0);
    expect(card.avgReturnPct).toBe(0);
    expect(card.entries).toHaveLength(0);
  });
});
