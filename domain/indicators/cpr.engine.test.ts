
import { describe, it, expect } from 'vitest';
import {
  computeCprCore,
  computeFloorPivots,
  classifyCprWidth,
  determineCprRelationship,
  computeCprFromBars,
  CprBar
} from './cpr.engine';

describe('computeCprCore (KGS formulas)', () => {
  it('matches the textbook construction: P=(H+L+C)/3, BC=(H+L)/2, TC=2P-BC', () => {
    // H=110, L=90, C=105 -> P=101.667, BC=100, TC=103.333
    const cpr = computeCprCore(110, 90, 105);
    expect(cpr.pivot).toBeCloseTo(101.6667, 3);
    expect(cpr.bc).toBeCloseTo(100, 6);
    expect(cpr.tc).toBeCloseTo(103.3333, 3);
  });

  it('swaps TC/BC when the close is below the midpoint (TC always on top)', () => {
    // H=110, L=90, C=94 -> P=98, raw TC=2*98-100=96 < BC=100 -> swapped
    const cpr = computeCprCore(110, 90, 94);
    expect(cpr.tc).toBeCloseTo(100, 6);
    expect(cpr.bc).toBeCloseTo(96, 6);
    expect(cpr.tc).toBeGreaterThanOrEqual(cpr.bc);
  });
});

describe('computeFloorPivots', () => {
  it('matches classic floor-trader formulas', () => {
    // H=110, L=90, C=105 -> P=101.667
    const p = computeFloorPivots(110, 90, 105);
    expect(p.r1).toBeCloseTo(113.3333, 3); // 2P - L
    expect(p.s1).toBeCloseTo(93.3333, 3); // 2P - H
    expect(p.r2).toBeCloseTo(121.6667, 3); // P + (H-L)
    expect(p.s2).toBeCloseTo(81.6667, 3); // P - (H-L)
    expect(p.r3).toBeCloseTo(133.3333, 3); // H + 2(P-L)
    expect(p.s3).toBeCloseTo(73.3333, 3); // L - 2(H-P)
    // Ordering sanity: S3 < S2 < S1 < P < R1 < R2 < R3
    expect(p.s3).toBeLessThan(p.s2);
    expect(p.s2).toBeLessThan(p.s1);
    expect(p.r1).toBeLessThan(p.r2);
    expect(p.r2).toBeLessThan(p.r3);
  });
});

describe('classifyCprWidth (pivot-width convention)', () => {
  it('narrow < 0.5%, wide > 0.75%, average between', () => {
    // Width% = (TC-BC)/P*100; TC-BC = |P - BC| -> engineer via close distance
    const narrow = computeCprCore(100.5, 99.5, 100.1); // tight day
    expect(classifyCprWidth(narrow).width).toBe('NARROW');

    const wide = computeCprCore(106, 94, 103.5); // big range, skewed close
    expect(classifyCprWidth(wide).width).toBe('WIDE');

    const avg = computeCprCore(102, 98, 101); // ~0.66%
    expect(classifyCprWidth(avg).width).toBe('AVERAGE');
  });
});

describe('determineCprRelationship', () => {
  const mk = (bc: number, tc: number) => ({ pivot: (bc + tc) / 2, bc, tc });

  it('classifies the seven two-day relationships', () => {
    const prev = mk(100, 102);
    expect(determineCprRelationship(mk(103, 105), prev)).toBe('HIGHER_VALUE');
    expect(determineCprRelationship(mk(96, 98), prev)).toBe('LOWER_VALUE');
    expect(determineCprRelationship(mk(100.5, 101.5), prev)).toBe('INSIDE_VALUE');
    expect(determineCprRelationship(mk(99, 103), prev)).toBe('OUTSIDE_VALUE');
    expect(determineCprRelationship(mk(101, 104), prev)).toBe('OVERLAPPING_HIGHER');
    expect(determineCprRelationship(mk(98, 101), prev)).toBe('OVERLAPPING_LOWER');
    expect(determineCprRelationship(mk(100, 102), prev)).toBe('UNCHANGED');
  });
});

describe('computeCprFromBars (day selection — the KGS-correct part)', () => {
  const bar = (date: string, high: number, low: number, close: number): CprBar => ({
    date, high, low, close
  });
  const history = [
    bar('2026-08-19', 104, 100, 103),
    bar('2026-08-20', 106, 102, 105),
    bar('2026-08-21', 108, 104, 107) // latest completed session (Friday)
  ];

  it('DURING a live session: today CPR from yesterday, no tomorrow levels', () => {
    const withToday = [...history, bar('2026-08-24', 109, 106, 108.5)]; // forming
    const cpr = computeCprFromBars(withToday, '2026-08-24')!;
    // Source must be 21-Aug (the completed session before today's forming bar)
    expect(cpr.sourceDate).toBe('2026-08-21');
    const expected = computeCprCore(108, 104, 107);
    expect(cpr.pivot).toBeCloseTo(expected.pivot, 6);
    expect(cpr.tomorrow).toBeUndefined(); // forming H/L/C are not final
  });

  it('AFTER the close: next-session CPR from the LATEST completed bar', () => {
    const cpr = computeCprFromBars(history, '2026-08-23')!; // weekend
    // The old bug: len-2 would source 20-Aug. Correct: 21-Aug.
    expect(cpr.sourceDate).toBe('2026-08-21');
    const expected = computeCprCore(108, 104, 107);
    expect(cpr.pivot).toBeCloseTo(expected.pivot, 6);
    expect(cpr.tomorrow).toBeDefined();
    expect(cpr.tomorrow!.pivot).toBeCloseTo(expected.pivot, 6);
  });

  it('carries floor pivots, width and relationship; null under 3 bars', () => {
    const cpr = computeCprFromBars(history, '2026-08-23')!;
    expect(cpr.r1).toBeCloseTo(2 * cpr.pivot - 104, 6);
    expect(cpr.s1).toBeCloseTo(2 * cpr.pivot - 108, 6);
    expect(['NARROW', 'AVERAGE', 'WIDE']).toContain(cpr.width);
    expect(cpr.relationship).toBeDefined();
    expect(computeCprFromBars(history.slice(0, 2), '2026-08-23')).toBeNull();
  });
});
