
import { describe, it, expect } from 'vitest';
import { evaluateBands, cashFlowRebalance, AllocationClass } from './bandRebalance.engine';

// 100k portfolio: equity 70 (target 60), debt 25 (target 30), gold 5 (target 10)
const classes = (equity = 70000, debt = 25000, gold = 5000): AllocationClass[] => [
  { key: 'equity', currentValue: equity, targetPct: 60 },
  { key: 'debt', currentValue: debt, targetPct: 30 },
  { key: 'gold', currentValue: gold, targetPct: 10 }
];

describe('evaluateBands (5/25 rule)', () => {
  it('triggers on absolute drift beyond 5pp', () => {
    const evaluation = evaluateBands(classes());
    const equity = evaluation.rows.find(r => r.key === 'equity')!;
    expect(equity.driftPp).toBeCloseTo(10, 1);
    expect(equity.absTriggered).toBe(true);
    expect(evaluation.shouldRebalance).toBe(true);
  });

  it('the relative band catches small allocations the absolute band misses', () => {
    // gold: 6.5% current vs 5% target -> only +1.5pp but +30% relative
    const evaluation = evaluateBands([
      { key: 'equity', currentValue: 93500, targetPct: 95 },
      { key: 'gold', currentValue: 6500, targetPct: 5 }
    ]);
    const gold = evaluation.rows.find(r => r.key === 'gold')!;
    expect(gold.absTriggered).toBe(false);
    expect(gold.relTriggered).toBe(true);
    expect(gold.relDriftPct).toBeCloseTo(30, 0);
  });

  it('stays quiet inside both bands', () => {
    // 61.5/29/9.5 vs 60/30/10 — small drifts everywhere
    const evaluation = evaluateBands(classes(61500, 29000, 9500));
    expect(evaluation.shouldRebalance).toBe(false);
  });
});

describe('cashFlowRebalance', () => {
  it('never sells: every allocation is non-negative and sums to the contribution', () => {
    const plan = cashFlowRebalance(classes(), 20000)!;
    expect(plan.allocations.every(a => a.amount >= 0)).toBe(true);
    const sum = plan.allocations.reduce((s, a) => s + a.amount, 0);
    expect(sum).toBeCloseTo(20000, 1);
  });

  it('waterfalls to the worst deficit first when cash cannot close every gap', () => {
    // On a 110k post total: gold deficit 6k, debt deficit 8k, equity 0.
    const plan = cashFlowRebalance(classes(), 10000)!;
    const byKey = Object.fromEntries(plan.allocations.map(a => [a.key, a.amount]));
    expect(byKey['equity']).toBe(0); // overweight gets nothing
    expect(byKey['debt']).toBeCloseTo(8000, 0); // worst gap filled first
    expect(byKey['gold']).toBeCloseTo(2000, 0); // remainder
  });

  it('lands exactly on target when the contribution can close all gaps', () => {
    // 50k in: post total 150k -> targets 90/45/15k; deficits 20k+10k=30k < 50k
    const plan = cashFlowRebalance(classes(), 50000)!;
    for (const a of plan.allocations) {
      expect(a.afterPct).toBeCloseTo(a.targetPct, 0);
    }
  });

  it('provably reduces mean drift', () => {
    const plan = cashFlowRebalance(classes(), 20000)!;
    expect(plan.driftAfterPp).toBeLessThan(plan.driftBeforePp);
  });

  it('rejects a non-positive contribution', () => {
    expect(cashFlowRebalance(classes(), 0)).toBeNull();
  });
});
