
import { describe, it, expect } from 'vitest';
import {
  classifyHolding,
  fifoRealize,
  applyLossOffsets,
  computeEquityTax,
  findLossHarvests,
  findGainHarvests,
  HarvestHolding
} from './harvest.engine';

const AS_OF = '2026-08-23';

describe('classifyHolding', () => {
  it('marks > 12 months as LTCG and counts days to LTCG for young lots', () => {
    expect(classifyHolding('2025-01-10', AS_OF).term).toBe('LTCG');
    const young = classifyHolding('2026-03-01', AS_OF);
    expect(young.term).toBe('STCG');
    expect(young.daysToLtcg).toBeGreaterThan(0);
  });

  it('exactly 365 days is still STCG (needs strictly more than 12 months)', () => {
    expect(classifyHolding('2025-08-23', AS_OF).term).toBe('STCG'); // 365 days
    expect(classifyHolding('2025-08-22', AS_OF).term).toBe('LTCG'); // 366 days
  });
});

describe('fifoRealize', () => {
  const lots = [
    { quantity: 50, buyPrice: 100, buyDate: '2024-06-01' }, // old, cheap
    { quantity: 50, buyPrice: 150, buyDate: '2026-05-01' } // recent, pricey
  ];

  it('consumes oldest lots first and splits terms per lot', () => {
    const result = fifoRealize(lots, 80, 160, AS_OF)!;
    // 50 from the 2024 lot (LTCG, +60/unit) + 30 from the 2026 lot (STCG, +10/unit)
    expect(result.pieces).toHaveLength(2);
    expect(result.pieces[0].term).toBe('LTCG');
    expect(result.ltcgGain).toBeCloseTo(50 * 60, 2);
    expect(result.stcgGain).toBeCloseTo(30 * 10, 2);
    expect(result.remainingLots).toHaveLength(1);
    expect(result.remainingLots[0].quantity).toBe(20);
  });

  it('rejects overselling', () => {
    expect(fifoRealize(lots, 101, 160, AS_OF)).toBeNull();
  });
});

describe('applyLossOffsets', () => {
  it('STCL offsets STCG first, then LTCG', () => {
    // STCG -50k (loss), LTCG +80k
    const result = applyLossOffsets(-50000, 80000);
    expect(result.netSTCG).toBe(0);
    expect(result.netLTCG).toBe(30000);
    expect(result.carryForward.stcl).toBe(0);
  });

  it('LTCL never offsets STCG', () => {
    const result = applyLossOffsets(40000, -60000);
    expect(result.netSTCG).toBe(40000); // untouched
    expect(result.netLTCG).toBe(0);
    expect(result.carryForward.ltcl).toBe(60000);
  });
});

describe('computeEquityTax', () => {
  it('applies 20% STCG and 12.5% LTCG above the 1.25L exemption', () => {
    const tax = computeEquityTax(100000, 200000);
    expect(tax.stcgTax).toBe(20000);
    expect(tax.taxableLTCG).toBe(75000); // 2L - 1.25L
    expect(tax.ltcgTax).toBe(9375);
    expect(tax.totalTax).toBe(29375);
  });

  it('LTCG fully inside the exemption is tax-free', () => {
    const tax = computeEquityTax(0, 100000);
    expect(tax.ltcgTax).toBe(0);
  });
});

const holdings: HarvestHolding[] = [
  // Long-term winner: +100/unit over 100 units
  { symbol: 'WINNER-LT', assetType: 'STOCK', quantity: 100, avgPrice: 400, currentPrice: 500, buyDate: '2024-05-01' },
  // Short-term loser: -50/unit over 200 units = 10,000 loss
  { symbol: 'LOSER-ST', assetType: 'STOCK', quantity: 200, avgPrice: 250, currentPrice: 200, buyDate: '2026-04-01' },
  // Long-term loser (MF): -10/unit over 300.5 units
  { symbol: 'LOSER-LT', assetType: 'MF', quantity: 300.5, avgPrice: 60, currentPrice: 50, buyDate: '2023-02-01' }
];

describe('findLossHarvests', () => {
  it('quantifies losses, offsets by term rules, and reports carry-forward', () => {
    const result = findLossHarvests(holdings, { stcg: 4000, ltcg: 2000 }, AS_OF);
    const st = result.find(r => r.symbol === 'LOSER-ST')!;
    // STCL 10,000: 4,000 vs STCG @20% = 800; 2,000 vs LTCG @12.5% = 250; 4,000 carries fwd
    expect(st.term).toBe('STCG');
    expect(st.taxSaved).toBeCloseTo(800 + 250, 2);
    expect(st.carryForwardLoss).toBeCloseTo(4000, 2);
    expect(st.detail).toContain('200 LOSER-ST');
    expect(st.detail).toContain('carries forward');

    // LTCL can only hit LTCG, which the STCL already consumed -> pure carry-forward
    const lt = result.find(r => r.symbol === 'LOSER-LT')!;
    expect(lt.term).toBe('LTCG');
    expect(lt.taxSaved).toBe(0);
    expect(lt.carryForwardLoss).toBeCloseTo(300.5 * 10, 1);
  });

  it('returns nothing when no holding is under water', () => {
    expect(findLossHarvests([holdings[0]], { stcg: 0, ltcg: 0 }, AS_OF)).toHaveLength(0);
  });
});

describe('findGainHarvests', () => {
  it('sells just enough of a long-term winner to fill the exemption', () => {
    const result = findGainHarvests(holdings, 0, AS_OF);
    const w = result.find(r => r.symbol === 'WINNER-LT')!;
    // Full position gain = 100 x 100 = 10,000 < 1.25L -> harvest all 100
    expect(w.quantity).toBe(100);
    expect(w.gainRealized).toBeCloseTo(10000, 2);
    expect(w.taxSaved).toBeCloseTo(1250, 2);
    expect(w.detail).toContain('₹0 tax');
  });

  it('caps quantity to the remaining exemption', () => {
    const big: HarvestHolding[] = [
      { symbol: 'BIGWIN', assetType: 'STOCK', quantity: 10000, avgPrice: 100, currentPrice: 150, buyDate: '2024-01-01' }
    ];
    // 50/unit gain; exemption left 1.25L -> 2,500 shares exactly
    const result = findGainHarvests(big, 0, AS_OF);
    expect(result[0].quantity).toBe(2500);
    expect(result[0].gainRealized).toBeCloseTo(125000, 2);
  });

  it('returns nothing once the exemption is used up or for short-term winners', () => {
    expect(findGainHarvests(holdings, 125000, AS_OF)).toHaveLength(0);
    const young: HarvestHolding[] = [
      { symbol: 'YOUNG', assetType: 'STOCK', quantity: 10, avgPrice: 100, currentPrice: 200, buyDate: '2026-06-01' }
    ];
    expect(findGainHarvests(young, 0, AS_OF)).toHaveLength(0);
  });
});
