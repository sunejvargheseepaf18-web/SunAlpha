
import { describe, it, expect } from 'vitest';
import {
  sipFutureValue,
  lumpFutureValue,
  requiredMonthlySip,
  inflateTarget,
  assessGoal,
  allocateCorpus,
  Goal
} from './goal.engine';

const goal = (over: Partial<Goal>): Goal => ({
  id: 'g1',
  name: 'House',
  targetAmount: 5000000,
  targetYears: 10,
  monthlySip: 10000,
  expectedReturnPct: 12,
  inflationPct: 6,
  ...over
});

describe('future value math', () => {
  it('matches the textbook SIP FV: 10k/mo at 12% for 10y ~= 23.2L', () => {
    // (1.01)^120 = 3.30039; annuity-due factor = 232.34
    expect(sipFutureValue(10000, 10, 12)).toBeCloseTo(2323391, -3);
  });

  it('zero return degrades to plain accumulation', () => {
    expect(sipFutureValue(1000, 2, 0)).toBe(24000);
  });

  it('compounds a lump sum', () => {
    expect(lumpFutureValue(100000, 10, 12)).toBeCloseTo(100000 * Math.pow(1.12, 10), 2);
  });
});

describe('requiredMonthlySip', () => {
  it('round-trips with sipFutureValue', () => {
    const sip = requiredMonthlySip(2323391, 10, 12, 0);
    expect(sip).toBeCloseTo(10000, 0);
  });

  it('accounts for an existing corpus and floors at zero when already funded', () => {
    const withCorpus = requiredMonthlySip(1000000, 10, 12, 200000);
    const without = requiredMonthlySip(1000000, 10, 12, 0);
    expect(withCorpus).toBeLessThan(without);
    expect(requiredMonthlySip(100000, 10, 12, 500000)).toBe(0);
  });
});

describe('inflateTarget', () => {
  it('grows today-rupees to the goal date', () => {
    expect(inflateTarget(1000000, 12, 6)).toBeCloseTo(1000000 * Math.pow(1.06, 12), 0);
  });
});

describe('assessGoal', () => {
  it('produces ordered scenario bands and a coherent gap verdict', () => {
    const a = assessGoal(goal({}), 500000);
    expect(a.projected.pessimistic).toBeLessThan(a.projected.expected);
    expect(a.projected.expected).toBeLessThan(a.projected.optimistic);
    expect(a.inflatedTarget).toBeCloseTo(5000000 * Math.pow(1.06, 10), 0);
    // 10k SIP + 5L corpus won't reach ~89.5L in 10y at 12%
    expect(a.onTrack).toBe(false);
    expect(a.sipDelta).toBeGreaterThan(0); // needs a SIP increase
    expect(a.requiredSip).toBeCloseTo(a.goal.monthlySip + a.sipDelta, 1);
  });

  it('marks a well-funded goal on track with zero extra SIP needed', () => {
    const a = assessGoal(goal({ targetAmount: 500000, monthlySip: 20000 }), 1000000);
    expect(a.onTrack).toBe(true);
    expect(a.requiredSip).toBe(0);
    expect(a.fundedPct).toBeGreaterThan(100);
  });
});

describe('allocateCorpus', () => {
  it('splits the portfolio in proportion to inflated targets', () => {
    const g1 = goal({ id: 'a', targetAmount: 1000000 });
    const g2 = goal({ id: 'b', targetAmount: 3000000 });
    const alloc = allocateCorpus([g1, g2], 400000);
    expect(alloc.get('a')! + alloc.get('b')!).toBeCloseTo(400000, 1);
    expect(alloc.get('b')! / alloc.get('a')!).toBeCloseTo(3, 1);
  });

  it('explicit corpus is kept and excluded from the shared pool', () => {
    const g1 = goal({ id: 'a', currentCorpus: 100000 });
    const g2 = goal({ id: 'b' });
    const alloc = allocateCorpus([g1, g2], 400000);
    expect(alloc.get('a')).toBe(100000);
    expect(alloc.get('b')).toBeCloseTo(300000, 1);
  });
});
