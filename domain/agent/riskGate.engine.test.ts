
import { describe, it, expect } from 'vitest';
import { assessRisk, applyRiskGate } from './riskGate.engine';
import { DebateVerdict } from '../advice/advice.types';

const verdict = (signal: DebateVerdict['signal'], confidence = 80): DebateVerdict => ({
  signal,
  confidence,
  bullPoints: ['b'],
  bearPoints: ['r'],
  reasoning: 'judge synthesis'
});

describe('assessRisk', () => {
  it('benign regime with no flags reads NONE', () => {
    const a = assessRisk({ trend: 'WEAK_BULL', volatility: 'NORMAL' });
    expect(a.severity).toBe('NONE');
    expect(a.reasons).toEqual([]);
  });

  it('circuit breaker or bear+expansion is CRITICAL', () => {
    expect(
      assessRisk({ trend: 'SIDEWAYS', volatility: 'NORMAL', circuitBreakerActive: true }).severity
    ).toBe('CRITICAL');
    expect(assessRisk({ trend: 'STRONG_BEAR', volatility: 'HIGH_EXPANSION' }).severity).toBe('CRITICAL');
  });

  it('bear trend, high vol, or concentration breach are CAUTION', () => {
    expect(assessRisk({ trend: 'WEAK_BEAR', volatility: 'NORMAL' }).severity).toBe('CAUTION');
    expect(assessRisk({ trend: 'SIDEWAYS', volatility: 'HIGH_EXPANSION' }).severity).toBe('CAUTION');
    const heavy = assessRisk({ trend: 'WEAK_BULL', volatility: 'NORMAL', weightPct: 22 });
    expect(heavy.severity).toBe('CAUTION');
    expect(heavy.reasons[0]).toContain('22.0%');
  });

  it('multiple caution flags accumulate reasons without inventing CRITICAL', () => {
    const a = assessRisk({ trend: 'WEAK_BEAR', volatility: 'NORMAL', weightPct: 25 });
    expect(a.severity).toBe('CAUTION');
    expect(a.reasons).toHaveLength(2);
  });
});

describe('applyRiskGate', () => {
  it('NONE passes the verdict through untouched', () => {
    const v = verdict('STRONG BUY');
    expect(applyRiskGate(v, { severity: 'NONE', reasons: [] })).toBe(v);
  });

  it('CAUTION steps buy-side one notch toward HOLD and caps confidence at 65', () => {
    const gated = applyRiskGate(verdict('STRONG BUY', 90), { severity: 'CAUTION', reasons: ['bear regime'] });
    expect(gated.signal).toBe('BUY');
    expect(gated.confidence).toBe(65);
    expect(gated.riskNote).toContain('CAUTION');
    expect(gated.riskNote).toContain('reduced from STRONG BUY');

    expect(applyRiskGate(verdict('ACCUMULATE'), { severity: 'CAUTION', reasons: ['x'] }).signal).toBe('HOLD');
  });

  it('CRITICAL collapses any buy-side signal to HOLD with confidence <= 50', () => {
    const gated = applyRiskGate(verdict('STRONG BUY', 95), { severity: 'CRITICAL', reasons: ['halt'] });
    expect(gated.signal).toBe('HOLD');
    expect(gated.confidence).toBe(50);
  });

  it('never upgrades: HOLD stays HOLD, sell-side passes through', () => {
    expect(applyRiskGate(verdict('HOLD'), { severity: 'CAUTION', reasons: ['x'] }).signal).toBe('HOLD');
    // Exits reduce risk — the gate must not soften them.
    expect(applyRiskGate(verdict('SELL'), { severity: 'CRITICAL', reasons: ['x'] }).signal).toBe('SELL');
    expect(applyRiskGate(verdict('REDUCE'), { severity: 'CAUTION', reasons: ['x'] }).signal).toBe('REDUCE');
    expect(applyRiskGate(verdict('AVOID'), { severity: 'CRITICAL', reasons: ['x'] }).signal).toBe('AVOID');
  });

  it('a lower judge confidence is never raised by the gate caps', () => {
    expect(applyRiskGate(verdict('BUY', 40), { severity: 'CAUTION', reasons: ['x'] }).confidence).toBe(40);
  });
});
