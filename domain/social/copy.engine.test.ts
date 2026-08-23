
import { describe, it, expect } from 'vitest';
import {
  equityCurveVolPct,
  computeRiskScore,
  rankLeaders,
  mapCopyTrade,
  evaluateCopyStopLoss,
  LeaderTrackRecord,
  EquityPoint
} from './copy.engine';

// Deterministic equity curve: drift + sinusoid, like the regime tests
const curve = (days: number, driftPct: number, wavePct: number): EquityPoint[] => {
  const points: EquityPoint[] = [];
  let value = 100000;
  for (let i = 0; i < days; i++) {
    value *= 1 + driftPct / 100;
    points.push({
      date: `d${i}`,
      value: value * (1 + (wavePct / 100) * Math.sin(0.9 * i))
    });
  }
  return points;
};

const record = (
  id: string,
  overrides: Partial<LeaderTrackRecord['stats']> = {},
  equityCurve: EquityPoint[] = curve(120, 0.1, 0.3)
): LeaderTrackRecord => ({
  id,
  name: id,
  description: `${id} strategy`,
  symbol: 'RELIANCE',
  equityCurve,
  stats: {
    totalReturnPct: 12,
    maxDrawdownPct: -8,
    winRatePct: 60,
    profitFactor: 1.8,
    tradesCount: 10,
    exposurePct: 70,
    ...overrides
  }
});

describe('equityCurveVolPct / computeRiskScore', () => {
  it('a smooth curve scores low risk, a wild one high risk', () => {
    const smooth = curve(120, 0.05, 0.05);
    const wild = curve(120, 0.05, 3);
    expect(equityCurveVolPct(smooth)!).toBeLessThan(equityCurveVolPct(wild)!);
    expect(computeRiskScore(smooth, -3)).toBeLessThanOrEqual(3);
    expect(computeRiskScore(wild, -35)).toBeGreaterThanOrEqual(7);
  });

  it('risk score stays inside 1-10', () => {
    expect(computeRiskScore(curve(120, 0, 0), 0)).toBeGreaterThanOrEqual(1);
    expect(computeRiskScore(curve(120, 0, 8), -80)).toBeLessThanOrEqual(10);
  });

  it('vol needs at least 15 points', () => {
    expect(equityCurveVolPct(curve(10, 0.1, 1))).toBeNull();
  });
});

describe('rankLeaders', () => {
  it('a high-return low-drawdown leader outranks a deep-drawdown one', () => {
    const board = rankLeaders([
      record('steady', { totalReturnPct: 18, maxDrawdownPct: -6 }),
      record('volatile', { totalReturnPct: 18, maxDrawdownPct: -30 })
    ]);
    expect(board[0].id).toBe('steady');
    expect(board[0].score).toBeGreaterThan(board[1].score);
  });

  it('thin track records are flagged and shrunk toward neutral', () => {
    const lucky = record('lucky', { totalReturnPct: 35, tradesCount: 1 });
    const proven = record('proven', { totalReturnPct: 30, tradesCount: 25 });
    const board = rankLeaders([lucky, proven]);
    expect(board.find(e => e.id === 'lucky')!.lowConfidence).toBe(true);
    expect(board[0].id).toBe('proven'); // shrinkage stops one lucky trade topping the board
  });

  it('scores are clamped to 0-100 and sorted descending', () => {
    const board = rankLeaders([
      record('moon', { totalReturnPct: 300, maxDrawdownPct: -2, profitFactor: 9 }),
      record('rekt', { totalReturnPct: -60, maxDrawdownPct: -70, winRatePct: 10, profitFactor: 0.2 })
    ]);
    expect(board[0].score).toBeLessThanOrEqual(100);
    expect(board[1].score).toBeGreaterThanOrEqual(0);
    expect(board[0].score).toBeGreaterThanOrEqual(board[1].score);
  });
});

describe('mapCopyTrade — proportional mirroring', () => {
  const trade = { symbol: 'RELIANCE', side: 'BUY' as const, quantity: 40, price: 1300 };

  it('scales a leader BUY by allocation / leader equity', () => {
    // 10% scale: leader equity 10L, follower allocated 1L -> 4 shares
    const order = mapCopyTrade(trade, 1000000, 100000, {})!;
    expect(order.side).toBe('BUY');
    expect(order.quantity).toBe(4);
    expect(order.rate).toBe(1300);
    expect(order.amount).toBe(5200);
    expect(order.reason).toContain('10.0%');
  });

  it('rounds down to whole shares and respects crypto precision', () => {
    const stock = mapCopyTrade({ ...trade, quantity: 37 }, 1000000, 100000, {})!;
    expect(stock.quantity).toBe(3); // 3.7 floors to 3

    const coin = mapCopyTrade(
      { symbol: 'BTC', side: 'BUY', quantity: 0.1, price: 7800000 },
      1000000,
      100000,
      {},
      { quantityPrecision: 10000 }
    )!;
    expect(coin.quantity).toBeCloseTo(0.01, 4); // ₹78,000 fits the ₹1L allocation

    // A trade too big for the allocation gets capped to what the money buys
    const capped = mapCopyTrade(
      { symbol: 'BTC', side: 'BUY', quantity: 0.5, price: 7800000 },
      1000000,
      100000,
      {},
      { quantityPrecision: 10000 }
    )!;
    expect(capped.amount).toBeLessThanOrEqual(100000);
  });

  it('caps a SELL at what the follower actually holds (no overfill flips)', () => {
    const exit = { symbol: 'RELIANCE', side: 'SELL' as const, quantity: 400, price: 1300 };
    const order = mapCopyTrade(exit, 1000000, 100000, { RELIANCE: 4 })!;
    expect(order.quantity).toBe(4); // proportional would be 40; held is 4
  });

  it('a SELL with nothing held returns null instead of shorting', () => {
    const exit = { symbol: 'RELIANCE', side: 'SELL' as const, quantity: 400, price: 1300 };
    expect(mapCopyTrade(exit, 1000000, 100000, {})).toBeNull();
  });

  it('a leader full exit sells the follower flat, leaving no dust', () => {
    const exit = { symbol: 'RELIANCE', side: 'SELL' as const, quantity: 40, price: 1300 };
    // Proportional 4; follower holds 3.5 units — full-exit rule sells all 3.5
    const order = mapCopyTrade(exit, 1000000, 100000, { RELIANCE: 3.5 })!;
    expect(order.quantity).toBe(3.5);
  });

  it('skips dust buys below the minimum order value', () => {
    const dust = mapCopyTrade({ ...trade, quantity: 1 }, 10000000, 100000, {});
    expect(dust).toBeNull(); // 1 share x 1% = 0.01 -> floors to 0
    const small = mapCopyTrade(
      { symbol: 'X', side: 'BUY', quantity: 100, price: 4 },
      1000000,
      100000,
      {},
      { minOrderValue: 500 }
    );
    expect(small).toBeNull(); // 10 units x ₹4 = ₹40 < ₹500
  });

  it('position cap limits BUY headroom against existing holdings', () => {
    // Cap 20% of ₹1L = ₹20,000; already holding 10 @1300 = ₹13,000 -> ₹7,000 headroom
    const big = { ...trade, quantity: 400 }; // proportional 40 — cap must bind
    const order = mapCopyTrade(big, 1000000, 100000, { RELIANCE: 10 }, { maxPositionPct: 20 })!;
    expect(order.quantity).toBe(5); // 7000/1300 = 5.38 floors to 5
    // No headroom at all -> null
    expect(
      mapCopyTrade(trade, 1000000, 100000, { RELIANCE: 20 }, { maxPositionPct: 20 })
    ).toBeNull();
  });

  it('rejects nonsense inputs', () => {
    expect(mapCopyTrade(trade, 0, 100000, {})).toBeNull();
    expect(mapCopyTrade(trade, 1000000, 0, {})).toBeNull();
    expect(mapCopyTrade({ ...trade, price: 0 }, 1000000, 100000, {})).toBeNull();
  });
});

describe('evaluateCopyStopLoss', () => {
  it('continues within the stop and triggers at the threshold', () => {
    const ok = evaluateCopyStopLoss(100000, 92000, 15);
    expect(ok.triggered).toBe(false);
    expect(ok.pnlPct).toBe(-8);
    expect(ok.action).toBe('CONTINUE');

    const hit = evaluateCopyStopLoss(100000, 85000, 15);
    expect(hit.triggered).toBe(true);
    expect(hit.action).toBe('CLOSE_ALL_AND_STOP');
    expect(hit.message).toContain('stop-loss hit');
  });

  it('profits never trigger, and zero allocation is a no-op', () => {
    expect(evaluateCopyStopLoss(100000, 120000, 15).triggered).toBe(false);
    expect(evaluateCopyStopLoss(0, 0, 15).triggered).toBe(false);
  });
});
