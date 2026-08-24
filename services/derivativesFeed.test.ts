
import { describe, it, expect } from 'vitest';
import {
  normCdf,
  computeGreeks,
  parseNseOptionChain,
  NseOptionChainResponse
} from './derivativesFeed';

describe('normCdf', () => {
  it('matches known standard normal values', () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 4);
    expect(normCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normCdf(-1.96)).toBeCloseTo(0.025, 3);
  });
});

describe('computeGreeks (Black-Scholes)', () => {
  // Textbook case: S=100, K=100, sigma=20%, r=5%, T=0.25y (91.25 days)
  // d1 = 0.175 -> call delta = N(0.175) ~= 0.5695
  it('matches a known textbook call delta', () => {
    const g = computeGreeks(100, 100, 20, 91.25, 'CE', 0.05);
    expect(g.delta).toBeCloseTo(0.5695, 2);
    expect(g.gamma).toBeGreaterThan(0);
    expect(g.theta).toBeLessThan(0); // long options decay
    expect(g.vega).toBeGreaterThan(0);
  });

  it('satisfies put-call delta parity: deltaCE - deltaPE = 1', () => {
    const ce = computeGreeks(24500, 24500, 14, 7, 'CE');
    const pe = computeGreeks(24500, 24500, 14, 7, 'PE');
    expect(ce.delta - pe.delta).toBeCloseTo(1, 3);
    // Gamma and vega are identical for calls and puts at the same strike
    expect(ce.gamma).toBeCloseTo(pe.gamma, 6);
    expect(ce.vega).toBeCloseTo(pe.vega, 2);
  });

  it('deep ITM call delta approaches 1, deep OTM approaches 0', () => {
    expect(computeGreeks(24500, 20000, 14, 7, 'CE').delta).toBeGreaterThan(0.97);
    expect(computeGreeks(24500, 29000, 14, 7, 'CE').delta).toBeLessThan(0.03);
  });

  it('returns zeroed greeks for degenerate inputs instead of NaN', () => {
    const g = computeGreeks(0, 100, 20, 7, 'CE');
    expect(g).toEqual({ delta: 0, gamma: 0, theta: 0, vega: 0 });
  });
});

const nseResponse = (): NseOptionChainResponse => ({
  records: {
    expiryDates: ['28-Aug-2026', '04-Sep-2026'],
    underlyingValue: 24512.4,
    data: [
      // wrong expiry — must be ignored
      { strikePrice: 24500, expiryDate: '04-Sep-2026', CE: { lastPrice: 300 }, PE: { lastPrice: 280 } },
      ...[24300, 24350, 24400, 24450, 24500, 24550, 24600, 24650, 24700].map(strike => ({
        strikePrice: strike,
        expiryDate: '28-Aug-2026',
        CE: {
          lastPrice: Math.max(5, 24512.4 - strike + 60),
          change: 1.5,
          openInterest: 100000 + strike,
          changeinOpenInterest: 5000,
          totalTradedVolume: 250000,
          impliedVolatility: 13.5
        },
        PE: {
          lastPrice: Math.max(5, strike - 24512.4 + 60),
          change: -2.1,
          openInterest: 90000 + strike,
          changeinOpenInterest: -3000,
          totalTradedVolume: 210000,
          impliedVolatility: 14.2
        }
      })),
      // missing PE side — must be skipped
      { strikePrice: 25000, expiryDate: '28-Aug-2026', CE: { lastPrice: 10 } }
    ]
  }
});

describe('parseNseOptionChain', () => {
  const now = new Date('2026-08-23T10:00:00Z');

  it('keeps only the nearest expiry, centers on ATM, and maps real OI/IV', () => {
    const parsed = parseNseOptionChain(nseResponse(), 2, now)!;
    expect(parsed.spot).toBeCloseTo(24512.4, 1);
    expect(parsed.expiry).toBe('28-Aug-2026');
    expect(parsed.rows).toHaveLength(5); // 2 each side of ATM
    // ATM strike for spot 24512.4 is 24500
    expect(parsed.rows.map(r => r.strike)).toEqual([24400, 24450, 24500, 24550, 24600]);
    const atm = parsed.rows.find(r => r.strike === 24500)!;
    expect(atm.ce.oi).toBe(100000 + 24500);
    expect(atm.pe.iv).toBeCloseTo(14.2, 1);
    // Greeks computed from NSE IV: ATM call delta near 0.5, put near -0.5
    expect(atm.ce.greeks.delta).toBeGreaterThan(0.4);
    expect(atm.ce.greeks.delta).toBeLessThan(0.65);
    expect(atm.pe.greeks.delta).toBeLessThan(-0.35);
  });

  it('returns null for malformed payloads', () => {
    expect(parseNseOptionChain({}, 5, now)).toBeNull();
    expect(parseNseOptionChain({ records: { underlyingValue: 0 } }, 5, now)).toBeNull();
  });

  it('fullRows keeps every strike of the expiry, one-sided ones zero-filled', () => {
    const parsed = parseNseOptionChain(nseResponse(), 2, now)!;
    // 9 two-sided strikes + the CE-only 25000 row; wrong-expiry row excluded
    expect(parsed.fullRows).toHaveLength(10);
    const oneSided = parsed.fullRows.find(r => r.strike === 25000)!;
    expect(oneSided.ce.price).toBe(10);
    expect(oneSided.pe.oi).toBe(0); // missing side counts as zero OI, not dropped
    // The display window still excludes the one-sided strike
    expect(parsed.rows.some(r => r.strike === 25000)).toBe(false);
    // Analytics on fullRows see OI the display window can't
    const fullCallOi = parsed.fullRows.reduce((s, r) => s + r.ce.oi, 0);
    const windowCallOi = parsed.rows.reduce((s, r) => s + r.ce.oi, 0);
    expect(fullCallOi).toBeGreaterThan(windowCallOi);
  });

  it("carries NSE's official filtered totals when the payload has them", () => {
    const withTotals = nseResponse();
    withTotals.filtered = { CE: { totOI: 9876543 }, PE: { totOI: 8765432 } };
    const parsed = parseNseOptionChain(withTotals, 2, now)!;
    expect(parsed.officialTotals).toEqual({ ceOi: 9876543, peOi: 8765432 });
    // Absent or empty totals -> undefined, consumers fall back to summation
    expect(parseNseOptionChain(nseResponse(), 2, now)!.officialTotals).toBeUndefined();
  });

  it("surfaces NSE's own data timestamp as asOf, falling back to now", () => {
    const withStamp = nseResponse();
    withStamp.records!.timestamp = '22-Aug-2026 15:30:00';
    const parsed = parseNseOptionChain(withStamp, 2, now)!;
    expect(parsed.asOf).toBe(new Date('22-Aug-2026 15:30:00').toISOString());

    const withoutStamp = parseNseOptionChain(nseResponse(), 2, now)!;
    expect(withoutStamp.asOf).toBe(now.toISOString());

    const badStamp = nseResponse();
    badStamp.records!.timestamp = 'not a date';
    expect(parseNseOptionChain(badStamp, 2, now)!.asOf).toBe(now.toISOString());
  });
});
