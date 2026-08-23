
import { describe, it, expect } from 'vitest';
import { resolveFill } from './fill.engine';

describe('resolveFill', () => {
  it('market orders fill at market plus directional slippage', () => {
    const buy = resolveFill({ side: 'BUY', type: 'MARKET' }, 1000, 0.1);
    expect(buy).toEqual({ status: 'FILLED', price: 1001 });
    const sell = resolveFill({ side: 'SELL', type: 'MARKET' }, 1000, 0.1);
    expect(sell).toEqual({ status: 'FILLED', price: 999 });
  });

  it('rejects everything without a market price', () => {
    expect(resolveFill({ side: 'BUY', type: 'MARKET' }, 0).status).toBe('REJECTED');
  });

  it('marketable BUY limit fills at market-or-limit, never above the limit', () => {
    // market 995, limit 1000 -> fills at slipped market (995.5), capped by limit
    const fill = resolveFill({ side: 'BUY', type: 'LIMIT', limitPrice: 1000 }, 995, 0.05);
    expect(fill.status).toBe('FILLED');
    expect((fill as any).price).toBeLessThanOrEqual(1000);
    // limit only just crosses: market 999.9, slipped 1000.4 -> capped at 1000
    const capped = resolveFill({ side: 'BUY', type: 'LIMIT', limitPrice: 1000 }, 999.9, 0.05);
    expect((capped as any).price).toBe(1000);
  });

  it('non-marketable limits are rejected with an explanation', () => {
    const buy = resolveFill({ side: 'BUY', type: 'LIMIT', limitPrice: 990 }, 1000);
    expect(buy.status).toBe('REJECTED');
    expect((buy as any).reason).toContain('not marketable');
    const sell = resolveFill({ side: 'SELL', type: 'LIMIT', limitPrice: 1010 }, 1000);
    expect(sell.status).toBe('REJECTED');
  });

  it('stop orders convert to market once triggered, reject before', () => {
    const notYet = resolveFill({ side: 'SELL', type: 'SL-M', triggerPrice: 950 }, 1000);
    expect(notYet.status).toBe('REJECTED');
    expect((notYet as any).reason).toContain('Trigger');
    const hit = resolveFill({ side: 'SELL', type: 'SL-M', triggerPrice: 950 }, 945, 0);
    expect(hit).toEqual({ status: 'FILLED', price: 945 });
  });

  it('rejects malformed limit/stop orders', () => {
    expect(resolveFill({ side: 'BUY', type: 'LIMIT' }, 1000).status).toBe('REJECTED');
    expect(resolveFill({ side: 'BUY', type: 'SL' }, 1000).status).toBe('REJECTED');
  });
});
