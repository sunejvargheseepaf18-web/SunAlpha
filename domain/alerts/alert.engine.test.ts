
import { describe, it, expect } from 'vitest';
import { evaluateAlerts, EvaluableAlert } from './alert.engine';

const NOW = '2026-08-23T10:00:00.000Z';

const alert = (over: Partial<EvaluableAlert>): EvaluableAlert => ({
  id: 'a1',
  symbol: 'RELIANCE',
  condition: 'ABOVE',
  targetPrice: 1300,
  ...over
});

describe('evaluateAlerts — level alerts', () => {
  it('fires ABOVE when price exceeds the target and stamps the cooldown', () => {
    const result = evaluateAlerts([alert({})], { RELIANCE: { price: 1318 } }, NOW);
    expect(result.triggered).toHaveLength(1);
    expect(result.triggered[0].message).toContain('above your ₹1,300');
    expect(result.nextAlerts[0].lastTriggeredAt).toBe(NOW);
  });

  it('fires BELOW only under the target', () => {
    const below = alert({ condition: 'BELOW', targetPrice: 1300 });
    expect(evaluateAlerts([below], { RELIANCE: { price: 1290 } }, NOW).triggered).toHaveLength(1);
    expect(evaluateAlerts([below], { RELIANCE: { price: 1310 } }, NOW).triggered).toHaveLength(0);
  });

  it('cooldown suppresses immediate re-fires but expires', () => {
    const recent = alert({ lastTriggeredAt: '2026-08-23T09:30:00.000Z', cooldownMinutes: 60 });
    expect(evaluateAlerts([recent], { RELIANCE: { price: 1318 } }, NOW).triggered).toHaveLength(0);
    const stale = alert({ lastTriggeredAt: '2026-08-23T08:00:00.000Z', cooldownMinutes: 60 });
    expect(evaluateAlerts([stale], { RELIANCE: { price: 1318 } }, NOW).triggered).toHaveLength(1);
  });
});

describe('evaluateAlerts — crossing alerts', () => {
  it('CROSS_ABOVE fires only on the transition through the level', () => {
    const cross = alert({ condition: 'CROSS_ABOVE', targetPrice: 1300 });
    // prev below, now above -> fires
    expect(
      evaluateAlerts([cross], { RELIANCE: { price: 1310, prevPrice: 1295 } }, NOW).triggered
    ).toHaveLength(1);
    // already above before -> no cross
    expect(
      evaluateAlerts([cross], { RELIANCE: { price: 1310, prevPrice: 1305 } }, NOW).triggered
    ).toHaveLength(0);
    // no previous price -> cannot detect a cross
    expect(evaluateAlerts([cross], { RELIANCE: { price: 1310 } }, NOW).triggered).toHaveLength(0);
  });

  it('CROSS_BELOW mirrors the semantics downward', () => {
    const cross = alert({ condition: 'CROSS_BELOW', targetPrice: 1300 });
    expect(
      evaluateAlerts([cross], { RELIANCE: { price: 1290, prevPrice: 1305 } }, NOW).triggered
    ).toHaveLength(1);
    expect(
      evaluateAlerts([cross], { RELIANCE: { price: 1290, prevPrice: 1295 } }, NOW).triggered
    ).toHaveLength(0);
  });
});

describe('evaluateAlerts — % move and lifecycle', () => {
  it('PCT_MOVE fires in either direction beyond the threshold', () => {
    const move = alert({ condition: 'PCT_MOVE', targetPrice: undefined, pctThreshold: 3 });
    expect(
      evaluateAlerts([move], { RELIANCE: { price: 1250, changePercent: -3.4 } }, NOW).triggered[0].message
    ).toContain('-3.4%');
    expect(
      evaluateAlerts([move], { RELIANCE: { price: 1310, changePercent: 1.2 } }, NOW).triggered
    ).toHaveLength(0);
  });

  it('triggerOnce retires the alert after firing', () => {
    const once = alert({ triggerOnce: true });
    const result = evaluateAlerts([once], { RELIANCE: { price: 1318 } }, NOW);
    expect(result.triggered).toHaveLength(1);
    expect(result.nextAlerts).toHaveLength(0);
  });

  it('keeps alerts untouched when the symbol has no quote', () => {
    const result = evaluateAlerts([alert({})], {}, NOW);
    expect(result.triggered).toHaveLength(0);
    expect(result.nextAlerts).toHaveLength(1);
  });
});
