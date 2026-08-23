
import { describe, it, expect } from 'vitest';
import {
  classifyBuildup,
  computeMaxPain,
  computeOiSummary,
  formatOi
} from './oiAnalytics.engine';
import { OptionChainRow, OptionContract } from '../../types';

const contract = (
  type: 'CE' | 'PE',
  strike: number,
  oi: number,
  oiChange = 0
): OptionContract => ({
  strike,
  type,
  price: 100,
  change: 0,
  oi,
  oiChange,
  volume: 1000,
  iv: 14,
  greeks: { delta: 0.5, gamma: 0.001, theta: -2, vega: 5 }
});

const row = (strike: number, ceOi: number, peOi: number, ceChg = 0, peChg = 0): OptionChainRow => ({
  strike,
  ce: contract('CE', strike, ceOi, ceChg),
  pe: contract('PE', strike, peOi, peChg)
});

describe('classifyBuildup', () => {
  it('maps the four price x OI quadrants', () => {
    expect(classifyBuildup(10, 5000)).toBe('LONG_BUILDUP');
    expect(classifyBuildup(-10, 5000)).toBe('SHORT_BUILDUP');
    expect(classifyBuildup(10, -5000)).toBe('SHORT_COVERING');
    expect(classifyBuildup(-10, -5000)).toBe('LONG_UNWINDING');
    expect(classifyBuildup(0, 5000)).toBe('NEUTRAL');
  });
});

describe('computeMaxPain', () => {
  it('finds the strike minimizing option-buyer payoff', () => {
    // Heavy OI at 24500 both sides pins pain there: at 24500 neither the
    // 24500 calls nor 24500 puts pay out.
    const rows = [
      row(24400, 100000, 100000),
      row(24500, 1000000, 1000000),
      row(24600, 100000, 100000)
    ];
    expect(computeMaxPain(rows)).toBe(24500);
  });

  it('skews toward heavy put OI (puts expiring worthless above their strike)', () => {
    const rows = [
      row(24400, 50000, 2000000), // massive put wall at 24400
      row(24500, 50000, 50000),
      row(24600, 50000, 50000)
    ];
    // Settling BELOW 24400 would pay the huge put block — pain minimizes at
    // or above it.
    expect(computeMaxPain(rows)).toBeGreaterThanOrEqual(24400);
  });

  it('returns 0 for an empty chain', () => {
    expect(computeMaxPain([])).toBe(0);
  });
});

describe('computeOiSummary', () => {
  const chain = [
    row(24400, 800000, 2500000, 10000, 120000), // put wall -> support
    row(24500, 1200000, 1400000, 5000, 30000),
    row(24600, 2600000, 600000, 40000, 2000) // call wall -> resistance
  ];

  it('derives PCR, support/resistance walls and totals from the chain', () => {
    const s = computeOiSummary(chain)!;
    expect(s.totalCallOi).toBe(4600000);
    expect(s.totalPutOi).toBe(4500000);
    expect(s.pcr).toBeCloseTo(0.98, 2);
    expect(s.pcrReading).toBe('NEUTRAL');
    expect(s.supportStrike).toBe(24400);
    expect(s.supportOi).toBe(2500000);
    expect(s.resistanceStrike).toBe(24600);
    expect(s.resistanceOi).toBe(2600000);
    expect(s.maxPainStrike).toBeGreaterThanOrEqual(24400);
    expect(s.maxPainStrike).toBeLessThanOrEqual(24600);
  });

  it('reads heavy fresh put writing as bullish positioning', () => {
    const s = computeOiSummary(chain)!;
    // putOiChangeSum 152000 vs callOiChangeSum 55000, net ~97k > 1% of book
    expect(s.putOiChangeSum).toBe(152000);
    expect(s.callOiChangeSum).toBe(55000);
    expect(s.changeReading).toBe('BULLISH');
  });

  it('put-heavy books read bullish, call-heavy books bearish (PCR bands)', () => {
    const putHeavy = computeOiSummary([row(24500, 1000000, 1600000)])!;
    expect(putHeavy.pcrReading).toBe('BULLISH');
    const callHeavy = computeOiSummary([row(24500, 1600000, 900000)])!;
    expect(callHeavy.pcrReading).toBe('BEARISH');
  });

  it('null on empty or zero-OI chains — no invented readings', () => {
    expect(computeOiSummary([])).toBeNull();
    expect(computeOiSummary([row(24500, 0, 0)])).toBeNull();
  });
});

describe('formatOi', () => {
  it('formats Indian-style magnitudes', () => {
    expect(formatOi(500)).toBe('500');
    expect(formatOi(45000)).toBe('45.0K');
    expect(formatOi(2500000)).toBe('25.0L');
    expect(formatOi(30000000)).toBe('3.0Cr');
  });
});
