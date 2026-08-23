
import { describe, it, expect } from 'vitest';
import { pickOverlays } from './autoOverlay.engine';

describe('pickOverlays (regime-gated indicator selection)', () => {
  it('strong trends get the MA ribbon and drop static levels', () => {
    const pick = pickOverlays({ trend: 'STRONG_BULL', volatility: 'NORMAL' });
    expect(pick.ema20).toBe(true);
    expect(pick.sma50).toBe(true);
    expect(pick.cpr).toBe(false);
    expect(pick.bollinger).toBe(false);
    expect(pick.reasons[0]).toContain('Strong trend');

    const bear = pickOverlays({ trend: 'STRONG_BEAR', volatility: 'NORMAL' });
    expect(bear.ema20).toBe(true);
    expect(bear.cpr).toBe(false);
  });

  it('ranges get levels and bands, not moving averages', () => {
    const pick = pickOverlays({ trend: 'SIDEWAYS', volatility: 'NORMAL' });
    expect(pick.cpr).toBe(true);
    expect(pick.bollinger).toBe(true);
    expect(pick.ema20).toBe(false);
    expect(pick.sma50).toBe(false);
    expect(pick.reasons[0]).toContain('Range-bound');
  });

  it('weak trends get both direction and levels', () => {
    const pick = pickOverlays({ trend: 'WEAK_BULL', volatility: 'NORMAL' });
    expect(pick.ema20).toBe(true);
    expect(pick.cpr).toBe(true);
    expect(pick.sma50).toBe(false);
  });

  it('a squeeze forces Bollinger on in any regime, with a reason', () => {
    const trending = pickOverlays({ trend: 'STRONG_BULL', volatility: 'LOW_COMPRESSION' });
    expect(trending.bollinger).toBe(true);
    expect(trending.reasons.some(r => r.includes('squeeze'))).toBe(true);

    const narrowCpr = pickOverlays({ trend: 'WEAK_BEAR', volatility: 'NORMAL', cprWidth: 'NARROW' });
    expect(narrowCpr.bollinger).toBe(true);
  });

  it('volume is always on; expansion adds a sizing caution', () => {
    for (const trend of ['STRONG_BULL', 'SIDEWAYS', 'WEAK_BEAR'] as const) {
      expect(pickOverlays({ trend, volatility: 'NORMAL' }).volume).toBe(true);
    }
    const expanding = pickOverlays({ trend: 'SIDEWAYS', volatility: 'HIGH_EXPANSION' });
    expect(expanding.reasons.some(r => r.includes('expanding'))).toBe(true);
  });

  it('every ON overlay is justified by a reason line', () => {
    const pick = pickOverlays({ trend: 'SIDEWAYS', volatility: 'LOW_COMPRESSION', cprWidth: 'NARROW' });
    expect(pick.reasons.length).toBeGreaterThanOrEqual(2);
  });
});
