
import { describe, it, expect } from 'vitest';
import {
  classifyBuildup,
  computeMaxPain,
  computeOiSummary,
  oiScanHits,
  formatOi,
  OiSummary
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

  it("NSE's official totals override computed totals so PCR matches the exchange", () => {
    const s = computeOiSummary(chain, { ceOi: 10000000, peOi: 12000000 })!;
    expect(s.totalCallOi).toBe(10000000);
    expect(s.totalPutOi).toBe(12000000);
    expect(s.pcr).toBeCloseTo(1.2, 2);
    // Walls still come from the rows, not the totals
    expect(s.supportStrike).toBe(24400);
    expect(s.resistanceStrike).toBe(24600);
  });
});

describe('oiScanHits', () => {
  const base: OiSummary = {
    totalCallOi: 5000000,
    totalPutOi: 5000000,
    pcr: 1.0,
    pcrReading: 'NEUTRAL',
    supportStrike: 24400,
    supportOi: 2000000,
    resistanceStrike: 24600,
    resistanceOi: 2000000,
    maxPainStrike: 24500,
    callOiChangeSum: 0,
    putOiChangeSum: 0,
    changeReading: 'NEUTRAL'
  };

  it('a balanced book near max pain yields no OI signals', () => {
    expect(oiScanHits(base, 24500)).toEqual([]);
  });

  it('fires PCR extremes on both sides with the right sentiment', () => {
    const putHeavy = oiScanHits({ ...base, pcr: 1.4 }, 24500);
    expect(putHeavy).toHaveLength(1);
    expect(putHeavy[0].type).toBe('OI_PCR_EXTREME');
    expect(putHeavy[0].sentiment).toBe('BULLISH');

    const callHeavy = oiScanHits({ ...base, pcr: 0.5 }, 24500);
    expect(callHeavy[0].sentiment).toBe('BEARISH');
    // In-band PCR stays silent
    expect(oiScanHits({ ...base, pcr: 1.1 }, 24500)).toEqual([]);
  });

  it('fresh writing needs a meaningful share of the book', () => {
    // 200k net put writing on a 5M book = 4% -> fires bullish
    const busy = oiScanHits({ ...base, putOiChangeSum: 250000, callOiChangeSum: 50000 }, 24500);
    expect(busy).toHaveLength(1);
    expect(busy[0].type).toBe('OI_FRESH_WRITING');
    expect(busy[0].sentiment).toBe('BULLISH');
    expect(busy[0].description).toContain('Put writers');
    // 1% of book -> below the 3% materiality gate, silent
    expect(oiScanHits({ ...base, putOiChangeSum: 50000 }, 24500)).toEqual([]);
  });

  it('max-pain magnet fires beyond a 1% gap, pointing toward max pain', () => {
    const below = oiScanHits(base, 24000); // spot 2.1% below max pain
    expect(below).toHaveLength(1);
    expect(below[0].type).toBe('OI_MAX_PAIN_MAGNET');
    expect(below[0].sentiment).toBe('BULLISH'); // gravity points up

    const above = oiScanHits(base, 25000);
    expect(above[0].sentiment).toBe('BEARISH');
    // Within 1% -> silent (already covered by the balanced-book test)
  });

  it('strengths stay within 0-100', () => {
    const extreme = oiScanHits(
      { ...base, pcr: 3, putOiChangeSum: 5000000, maxPainStrike: 30000 },
      24500
    );
    for (const hit of extreme) {
      expect(hit.strength).toBeGreaterThanOrEqual(0);
      expect(hit.strength).toBeLessThanOrEqual(100);
    }
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
