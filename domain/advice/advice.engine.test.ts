
import { describe, it, expect } from 'vitest';
import { generateHoldingAdvices, generateRedeploymentPlan } from './advice.engine';
import { AdvicePosition, RedeployCandidate } from './advice.types';

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

describe('generateRedeploymentPlan — where the trim proceeds go', () => {
  const candidates: RedeployCandidate[] = [
    {
      symbol: 'MIRAE-ELSS',
      name: 'Mirae Asset ELSS Tax Saver',
      kind: 'MF',
      rate: 55.85,
      reason: 'Bullish signal on existing holding.',
      maxAllocationPct: 30
    },
    {
      symbol: 'NIFTYBEES',
      name: 'Nippon India Nifty 50 BeES ETF',
      kind: 'ETF',
      rate: 280.5,
      reason: 'Diversified index exposure instead of single-stock risk.'
    },
    {
      symbol: 'NIFTY-SHORT-HEDGE',
      name: 'NIFTY short futures hedge',
      kind: 'DERIVATIVE_HEDGE',
      rate: 38600, // margin per lot
      lotSize: 75,
      reason: 'Protects remaining equity while concentration is unwound.',
      maxAllocationPct: 25
    }
  ];

  it('allocates the M&M trim proceeds into sized buys with exact qty/rate/amount', () => {
    const advices = generateHoldingAdvices(portfolio, { maxSingleHoldingPct: 18 });
    const plan = generateRedeploymentPlan(advices, candidates);

    // Freed cash equals the M&M trim proceeds (only SELL plan in the set)
    const mm = advices.find(a => a.symbol === 'M&M')!;
    expect(plan.freedCash).toBeCloseTo(mm.plan!.amount, 2);

    // First candidate capped at 30% of freed cash
    const mirae = plan.suggestions.find(s => s.symbol === 'MIRAE-ELSS')!;
    expect(mirae.amount).toBeLessThanOrEqual(plan.freedCash * 0.3 + 55.85);
    expect(mirae.amount).toBeCloseTo(mirae.quantity * 55.85, 2);
    expect(mirae.detail).toContain('₹55.85');

    // ETF gets whole shares only
    const etf = plan.suggestions.find(s => s.symbol === 'NIFTYBEES')!;
    expect(Number.isInteger(etf.quantity)).toBe(true);
    expect(etf.detail).toContain('shares');

    // Nothing is over-spent and the residual is what's left after whole units
    const spent = plan.suggestions.reduce((s, x) => s + x.amount, 0);
    expect(spent).toBeLessThanOrEqual(plan.freedCash);
    expect(plan.residualCash).toBeCloseTo(plan.freedCash - spent, 6);
  });

  it('derivative hedge is sized in whole lots at margin-per-lot', () => {
    const advices = generateHoldingAdvices(portfolio, {
      maxSingleHoldingPct: 100,
      signals: { 'M&M': 'SELL' } // full exit frees ~4.27L
    });
    const plan = generateRedeploymentPlan(advices, [candidates[2]]);
    const hedge = plan.suggestions.find(s => s.symbol === 'NIFTY-SHORT-HEDGE')!;

    // 25% of ~4,27,540 = ~1,06,885 -> floor(1,06,885 / 38,600) = 2 lots
    expect(hedge.quantity).toBe(2);
    expect(hedge.amount).toBe(2 * 38600);
    expect(hedge.detail).toContain('lots');
    expect(hedge.detail).toContain('margin');
  });

  it('no SELL advices -> empty plan with zero freed cash', () => {
    const advices = generateHoldingAdvices(portfolio, { maxSingleHoldingPct: 100 });
    const plan = generateRedeploymentPlan(advices, candidates);
    expect(plan.freedCash).toBe(0);
    expect(plan.suggestions).toHaveLength(0);
    expect(plan.residualCash).toBe(0);
  });

  it('skips candidates the freed cash cannot afford one unit of', () => {
    const advices = generateHoldingAdvices(portfolio, { maxSingleHoldingPct: 18 });
    const expensive: RedeployCandidate[] = [
      { symbol: 'MRF', name: 'MRF Ltd', kind: 'STOCK', rate: 10_00_000, reason: 'Too pricey.' }
    ];
    const plan = generateRedeploymentPlan(advices, expensive);
    expect(plan.suggestions).toHaveLength(0);
    expect(plan.residualCash).toBeCloseTo(plan.freedCash, 6);
  });
});
