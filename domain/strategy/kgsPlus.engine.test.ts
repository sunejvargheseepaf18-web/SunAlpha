
import { describe, it, expect } from 'vitest';
import { buildKgsPlusPlan, KgsPlusInput } from './kgsPlus.engine';
import { OiSummary } from '../derivatives/oiAnalytics.engine';

const cpr = {
  pivot: 24500,
  tc: 24540,
  bc: 24460,
  width: 'NARROW' as const,
  relationship: 'HIGHER_VALUE' as const,
  r1: 24650,
  r2: 24800,
  s1: 24350,
  s2: 24200
};

const bullishOi: OiSummary = {
  totalCallOi: 10000000,
  totalPutOi: 13000000,
  pcr: 1.3,
  pcrReading: 'BULLISH',
  supportStrike: 24350,
  supportOi: 3000000,
  resistanceStrike: 24800,
  resistanceOi: 2800000,
  maxPainStrike: 24600,
  callOiChangeSum: 50000,
  putOiChangeSum: 400000,
  changeReading: 'BULLISH'
};

const base: KgsPlusInput = {
  spot: 24560,
  cpr,
  regime: { trend: 'WEAK_BULL', volatility: 'NORMAL' },
  oi: bullishOi
};

describe('buildKgsPlusPlan (KGS++ confluence)', () => {
  it('full bullish confluence yields a LONG plan with exact levels', () => {
    const plan = buildKgsPlusPlan(base);
    expect(plan.bias).toBe('LONG');
    expect(plan.dayType).toBe('TREND_DAY_LIKELY'); // narrow CPR = NRCPR rule
    expect(plan.entryZone).toEqual({ low: 24500, high: 24540 }); // pivot..TC pullback
    expect(plan.stop).toBeLessThan(cpr.bc); // below BC with buffer
    expect(plan.targets[0]).toBe(24650); // R1 first
    expect(plan.targets).toContain(24800); // R2 / OI call wall
    expect(plan.confidence).toBeGreaterThan(70);
    expect(plan.confluences.join(' ')).toContain('Narrow CPR');
    expect(plan.confluences.join(' ')).toContain('PCR 1.3');
    expect(plan.conflicts).toEqual([]);
  });

  it('bearish mirror: SHORT plan targets S1 then the put wall below', () => {
    const plan = buildKgsPlusPlan({
      spot: 24420,
      cpr: { ...cpr, relationship: 'LOWER_VALUE' },
      regime: { trend: 'WEAK_BEAR', volatility: 'NORMAL' },
      oi: {
        ...bullishOi,
        pcr: 0.6,
        pcrReading: 'BEARISH',
        changeReading: 'BEARISH',
        supportStrike: 24200
      }
    });
    expect(plan.bias).toBe('SHORT');
    expect(plan.entryZone).toEqual({ low: 24460, high: 24500 }); // BC..pivot
    expect(plan.stop).toBeGreaterThan(cpr.tc);
    expect(plan.targets[0]).toBe(24350); // S1 first (nearest below)
    expect(plan.targets).toContain(24200); // S2 / OI put wall
  });

  it('split votes stay NEUTRAL with the split disclosed, no levels invented', () => {
    const plan = buildKgsPlusPlan({
      spot: 24500, // inside the range — no location vote
      cpr: { ...cpr, width: 'AVERAGE', relationship: 'HIGHER_VALUE' },
      regime: { trend: 'WEAK_BEAR', volatility: 'NORMAL' }, // opposing vote
      oi: null
    });
    expect(plan.bias).toBe('NEUTRAL');
    expect(plan.entryZone).toBeNull();
    expect(plan.stop).toBeNull();
    expect(plan.targets).toEqual([]);
    expect(plan.conflicts.join(' ')).toContain('Votes split');
    expect(plan.confidence).toBeLessThanOrEqual(45);
  });

  it('regime gate overrules a long against a strong bear — never upgrades', () => {
    const plan = buildKgsPlusPlan({
      ...base,
      regime: { trend: 'STRONG_BEAR', volatility: 'NORMAL' }
    });
    // Bull votes still outnumber (CPR structure + location + OI) but the
    // gate turns the plan NEUTRAL and says why.
    expect(plan.bias).toBe('NEUTRAL');
    expect(plan.conflicts.join(' ')).toContain('strong bear regime');
  });

  it('works without OI (stocks) — CPR + regime alone can still confluence', () => {
    const plan = buildKgsPlusPlan({ ...base, oi: null });
    expect(plan.bias).toBe('LONG'); // structure + location + regime = 3 bull votes
    expect(plan.confluences.join(' ')).not.toContain('PCR');
  });

  it('expanding volatility cuts confidence and warns about sizing', () => {
    const calm = buildKgsPlusPlan(base);
    const wild = buildKgsPlusPlan({ ...base, regime: { trend: 'WEAK_BULL', volatility: 'HIGH_EXPANSION' } });
    expect(wild.confidence).toBeLessThan(calm.confidence);
    expect(wild.conflicts.join(' ')).toContain('size smaller');
  });

  it('OI wall on a pivot level is called out as twice-defended', () => {
    const plan = buildKgsPlusPlan(base); // supportStrike 24350 == s1 24350
    expect(plan.confluences.join(' ')).toContain('twice-defended');
  });
});
