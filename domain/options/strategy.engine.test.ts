
import { describe, it, expect } from 'vitest';
import {
  payoffAtExpiry,
  analyzeStrategy,
  buildStrategy,
  OptionLeg,
  ChainStrike
} from './strategy.engine';

const LOT = 75;

describe('payoffAtExpiry', () => {
  it('long call: loses premium below strike, gains above', () => {
    const legs: OptionLeg[] = [{ type: 'CE', side: 'BUY', strike: 24500, premium: 100, lots: 1 }];
    expect(payoffAtExpiry(legs, 24000, LOT)).toBeCloseTo(-100 * LOT, 2);
    expect(payoffAtExpiry(legs, 24700, LOT)).toBeCloseTo((200 - 100) * LOT, 2);
  });

  it('short put mirrors: keeps premium above strike, bleeds below', () => {
    const legs: OptionLeg[] = [{ type: 'PE', side: 'SELL', strike: 24500, premium: 120, lots: 1 }];
    expect(payoffAtExpiry(legs, 25000, LOT)).toBeCloseTo(120 * LOT, 2);
    expect(payoffAtExpiry(legs, 24000, LOT)).toBeCloseTo((120 - 500) * LOT, 2);
  });
});

describe('analyzeStrategy', () => {
  const opts = { spot: 24500, lotSize: LOT };

  it('long call: breakeven at strike+premium, max loss = premium, unlimited profit', () => {
    const a = analyzeStrategy([{ type: 'CE', side: 'BUY', strike: 24500, premium: 100, lots: 1 }], opts)!;
    expect(a.maxProfit).toBe('UNLIMITED');
    expect(a.maxLoss).toBeCloseTo(-100 * LOT, 0);
    expect(a.breakevens).toHaveLength(1);
    expect(a.breakevens[0]).toBeCloseTo(24600, 0);
    expect(a.netPremium).toBeCloseTo(-100 * LOT, 2); // debit
  });

  it('bull call spread: max profit = width - debit, both sides capped', () => {
    const a = analyzeStrategy(
      [
        { type: 'CE', side: 'BUY', strike: 24500, premium: 150, lots: 1 },
        { type: 'CE', side: 'SELL', strike: 24700, premium: 60, lots: 1 }
      ],
      opts
    )!;
    expect(a.maxProfit).toBeCloseTo((200 - 90) * LOT, 0);
    expect(a.maxLoss).toBeCloseTo(-90 * LOT, 0);
    expect(a.breakevens[0]).toBeCloseTo(24590, 0);
  });

  it('long straddle has two breakevens; short straddle has unlimited loss', () => {
    const long = analyzeStrategy(
      [
        { type: 'CE', side: 'BUY', strike: 24500, premium: 150, lots: 1 },
        { type: 'PE', side: 'BUY', strike: 24500, premium: 140, lots: 1 }
      ],
      opts
    )!;
    expect(long.breakevens).toHaveLength(2);
    expect(long.breakevens[0]).toBeCloseTo(24210, 0);
    expect(long.breakevens[1]).toBeCloseTo(24790, 0);

    const short = analyzeStrategy(
      [
        { type: 'CE', side: 'SELL', strike: 24500, premium: 150, lots: 1 },
        { type: 'PE', side: 'SELL', strike: 24500, premium: 140, lots: 1 }
      ],
      opts
    )!;
    expect(short.maxLoss).toBe('UNLIMITED');
    expect(short.maxProfit).toBeCloseTo(290 * LOT, 0);
    expect(short.netPremium).toBeCloseTo(290 * LOT, 2); // credit
  });

  it('aggregates greeks with side sign', () => {
    const g = { delta: 0.5, gamma: 0.001, theta: -5, vega: 10 };
    const a = analyzeStrategy(
      [
        { type: 'CE', side: 'BUY', strike: 24500, premium: 100, lots: 1, greeks: g },
        { type: 'CE', side: 'SELL', strike: 24700, premium: 50, lots: 1, greeks: { ...g, delta: 0.3 } }
      ],
      opts
    )!;
    expect(a.greeks.delta).toBeCloseTo((0.5 - 0.3) * LOT, 1);
    expect(a.greeks.theta).toBeCloseTo(0, 1); // long and short theta cancel here
  });

  it('PoP: a deep-ITM-forever structure approaches 100, and needs IV+days', () => {
    const noIv = analyzeStrategy([{ type: 'CE', side: 'BUY', strike: 24500, premium: 100, lots: 1 }], opts)!;
    expect(noIv.popPct).toBeNull();
    // Short put far below spot: profitable almost everywhere
    const a = analyzeStrategy(
      [{ type: 'PE', side: 'SELL', strike: 20000, premium: 30, lots: 1 }],
      { ...opts, ivPct: 14, daysToExpiry: 7 }
    )!;
    expect(a.popPct).toBeGreaterThan(95);
  });
});

describe('buildStrategy', () => {
  const strikes: ChainStrike[] = [24100, 24200, 24300, 24400, 24500, 24600, 24700, 24800, 24900].map(k => ({
    strike: k,
    cePremium: Math.max(20, 24500 - k + 160),
    pePremium: Math.max(20, k - 24500 + 150)
  }));

  it('builds an iron condor with four legs around ATM', () => {
    const legs = buildStrategy('IRON_CONDOR', strikes, 24510)!;
    expect(legs).toHaveLength(4);
    const strikesUsed = legs.map(l => l.strike).sort((a, b) => a - b);
    expect(strikesUsed).toEqual([24100, 24300, 24700, 24900]);
    expect(legs.filter(l => l.side === 'SELL')).toHaveLength(2);
  });

  it('picks the ATM strike for straddles and returns null on thin chains', () => {
    const legs = buildStrategy('LONG_STRADDLE', strikes, 24510)!;
    expect(legs.every(l => l.strike === 24500)).toBe(true);
    expect(buildStrategy('IRON_CONDOR', strikes.slice(0, 3), 24510)).toBeNull();
  });
});
