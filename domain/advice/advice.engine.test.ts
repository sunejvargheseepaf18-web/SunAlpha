
import { describe, it, expect } from 'vitest';
import { generateHoldingAdvices } from './advice.engine';
import { AdvicePosition } from './advice.types';

// Portfolio snapshot from the 21-08-2026 holdings screen.
const portfolio: AdvicePosition[] = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', assetType: 'STOCK', quantity: 46, currentPrice: 1318.39, currentValue: 60646 },
  { symbol: 'M&M', name: 'Mahindra & Mahindra', assetType: 'STOCK', quantity: 125, currentPrice: 3420.32, currentValue: 427540 },
  { symbol: 'QUANT-ELSS', name: 'Quant ELSS Tax Saver', assetType: 'MF', quantity: 164.83, currentPrice: 407.69, currentValue: 67199 },
  { symbol: 'MIRAE-ELSS', name: 'Mirae Asset ELSS Tax Saver', assetType: 'MF', quantity: 802.41, currentPrice: 55.85, currentValue: 44814 },
  { symbol: 'AXIS-ELSS', name: 'Axis ELSS Tax Saver', assetType: 'MF', quantity: 484.93, currentPrice: 109.29, currentValue: 52998 },
  { symbol: 'SBI-CONTRA', name: 'SBI Contra Fund Regular', assetType: 'MF', quantity: 11.84, currentPrice: 380.18, currentValue: 4500 },
  { symbol: 'NIPPON-ELSS', name: 'Nippon India ELSS', assetType: 'MF', quantity: 33.03, currentPrice: 144.26, currentValue: 4764 },
  { symbol: 'NIPPON-MULTI', name: 'Nippon India Multi Cap', assetType: 'MF', quantity: 39.26, currentPrice: 305.66, currentValue: 11999 }
];

const totalValue = portfolio.reduce((s, p) => s + p.currentValue, 0);

describe('generateHoldingAdvices — concentration trim', () => {
  it('trims M&M (63% of portfolio) to the 18% cap with exact quantity, rate and amount', () => {
    const advices = generateHoldingAdvices(portfolio, { maxSingleHoldingPct: 18 });
    const mm = advices.find(a => a.symbol === 'M&M')!;

    expect(mm.action).toBe('TRIM');
    expect(mm.chip).toBe('SELL');
    expect(mm.plan).toBeDefined();

    // Sell value needed: 427540 - 18% of 674460 ≈ ₹3,06,137 -> 89.5 shares -> ceil 90
    expect(mm.plan!.quantity).toBe(90);
    expect(mm.plan!.rate).toBeCloseTo(3420.32, 2);
    expect(mm.plan!.amount).toBeCloseTo(90 * 3420.32, 2);

    // After the trim, weight must be at or just under the cap (never above)
    expect(mm.plan!.toWeightPct).toBeLessThanOrEqual(18);
    expect(mm.plan!.toWeightPct).toBeGreaterThan(17);

    // The detail string must spell out quantity, rate and amount
    expect(mm.detail).toContain('90 shares');
    expect(mm.detail).toContain('₹3,420.32');
    expect(mm.detail).toContain('₹3,07,829');
  });

  it('quantifies MF trims in units (2dp), never whole shares', () => {
    // Make Quant ELSS massively overweight in a small portfolio
    const small: AdvicePosition[] = [
      portfolio.find(p => p.symbol === 'QUANT-ELSS')!,
      { symbol: 'CASHFUND', name: 'Liquid Fund', assetType: 'MF', quantity: 100, currentPrice: 100, currentValue: 10000 }
    ];
    const advices = generateHoldingAdvices(small, { maxSingleHoldingPct: 50 });
    const quant = advices.find(a => a.symbol === 'QUANT-ELSS')!;

    expect(quant.action).toBe('TRIM');
    // Units, not integers: quantity has at most 2dp and is not artificially rounded up to a whole number
    expect(quant.plan!.quantity).toBeCloseTo(quant.plan!.quantity, 2);
    expect(Number.isInteger(quant.plan!.quantity)).toBe(false);
    expect(quant.detail).toContain('units');
    expect(quant.plan!.toWeightPct).toBeLessThanOrEqual(50);
  });

  it('never advises selling more than the position holds', () => {
    const tiny: AdvicePosition[] = [
      { symbol: 'BIG', name: 'Big Stock', assetType: 'STOCK', quantity: 1, currentPrice: 99000, currentValue: 99000 },
      { symbol: 'SMALL', name: 'Small Stock', assetType: 'STOCK', quantity: 10, currentPrice: 100, currentValue: 1000 }
    ];
    const advices = generateHoldingAdvices(tiny, { maxSingleHoldingPct: 18 });
    const big = advices.find(a => a.symbol === 'BIG')!;
    expect(big.plan!.quantity).toBeLessThanOrEqual(1);
  });
});

describe('generateHoldingAdvices — signal precedence (Universe vs Holdings consistency)', () => {
  it('a SELL market signal produces SELL everywhere, even when within allocation', () => {
    const advices = generateHoldingAdvices(portfolio, {
      maxSingleHoldingPct: 18,
      signals: { RELIANCE: 'SELL' }
    });
    const rel = advices.find(a => a.symbol === 'RELIANCE')!;

    // RELIANCE is only ~9% of portfolio (within allocation) but the signal wins:
    // the same advice object feeds Universe and Holdings, so no HOLD/SELL split.
    expect(rel.action).toBe('EXIT');
    expect(rel.chip).toBe('SELL');
    expect(rel.plan!.quantity).toBe(46);
    expect(rel.plan!.rate).toBeCloseTo(1318.39, 2);
    expect(rel.plan!.amount).toBeCloseTo(46 * 1318.39, 2);
    expect(rel.detail).toContain('46 shares');
  });

  it('REDUCE trims the configured fraction with exact quantity and amount', () => {
    const advices = generateHoldingAdvices(portfolio, {
      maxSingleHoldingPct: 100, // disable cap so only the signal acts
      signals: { RELIANCE: 'REDUCE' },
      reduceTrimFraction: 0.25
    });
    const rel = advices.find(a => a.symbol === 'RELIANCE')!;
    expect(rel.action).toBe('TRIM');
    expect(rel.plan!.quantity).toBe(11); // floor(46 * 0.25)
    expect(rel.plan!.amount).toBeCloseTo(11 * 1318.39, 2);
  });

  it('BUY signals produce a sized, priced ADD with resulting weight', () => {
    const advices = generateHoldingAdvices(portfolio, {
      maxSingleHoldingPct: 100,
      signals: { 'MIRAE-ELSS': 'BUY' }
    });
    const mirae = advices.find(a => a.symbol === 'MIRAE-ELSS')!;
    expect(mirae.action).toBe('ADD');
    expect(mirae.chip).toBe('BUY');
    expect(mirae.plan!.side).toBe('BUY');
    expect(mirae.plan!.quantity).toBeGreaterThan(0);
    expect(mirae.plan!.amount).toBeCloseTo(mirae.plan!.quantity * 55.85, 2);
    expect(mirae.plan!.toWeightPct).toBeGreaterThan(mirae.weightPct);
    expect(mirae.detail).toContain('₹55.85');
  });

  it('no signal and within allocation -> HOLD with no trade plan', () => {
    const advices = generateHoldingAdvices(portfolio, { maxSingleHoldingPct: 18 });
    const rel = advices.find(a => a.symbol === 'RELIANCE')!;
    expect(rel.action).toBe('HOLD');
    expect(rel.plan).toBeUndefined();
    expect(rel.weightPct).toBeCloseTo((60646 / totalValue) * 100, 1);
  });
});

describe('generateHoldingAdvices — edge cases', () => {
  it('handles an empty/zero-value portfolio without dividing by zero', () => {
    const advices = generateHoldingAdvices([
      { symbol: 'X', name: 'X', assetType: 'STOCK', quantity: 0, currentPrice: 0, currentValue: 0 }
    ]);
    expect(advices[0].action).toBe('HOLD');
    expect(advices[0].weightPct).toBe(0);
  });

  it('capital conservation: trim proceeds equal quantity × rate exactly', () => {
    const advices = generateHoldingAdvices(portfolio, { maxSingleHoldingPct: 18 });
    for (const a of advices) {
      if (a.plan) {
        expect(a.plan.amount).toBeCloseTo(a.plan.quantity * a.plan.rate, 6);
      }
    }
  });
});
