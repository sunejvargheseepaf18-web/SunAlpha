
// Risk gate engine (pure domain logic).
//
// TradingAgents' missing lane in this app: the risk-management team that
// reviews the trader's verdict BEFORE the portfolio manager acts. Adapted
// to AGENT_RULES (AI is advisory, decisions are deterministic):
// - The ASSESSMENT is deterministic — computed from the regime and
//   portfolio facts, never from model output.
// - The GATE is asymmetric by construction: it can only make a verdict
//   more conservative (downgrade buy-side signals toward HOLD, cap
//   confidence). It can never upgrade — a risk officer who talks the desk
//   INTO risk isn't one. Sell-side signals pass through untouched: exits
//   reduce risk.

import { DebateVerdict, MarketSignal } from '../advice/advice.types';
import { TrendRegime, VolatilityRegime } from '../../types';

export type RiskSeverity = 'NONE' | 'CAUTION' | 'CRITICAL';

export interface RiskAssessment {
  severity: RiskSeverity;
  reasons: string[]; // deterministic, evidence-backed
}

export interface RiskContext {
  trend: TrendRegime;
  volatility: VolatilityRegime;
  /** True when the portfolio circuit breaker has halted new buys. */
  circuitBreakerActive?: boolean;
  /** This holding's current portfolio weight vs the concentration cap. */
  weightPct?: number;
  maxSingleHoldingPct?: number;
}

/** Deterministic risk read: same facts, same severity. */
export const assessRisk = (ctx: RiskContext): RiskAssessment => {
  const reasons: string[] = [];
  let severity: RiskSeverity = 'NONE';

  const escalate = (to: RiskSeverity, reason: string) => {
    reasons.push(reason);
    if (to === 'CRITICAL' || severity === 'CRITICAL') severity = 'CRITICAL';
    else severity = 'CAUTION';
  };

  if (ctx.circuitBreakerActive) {
    escalate('CRITICAL', 'Portfolio circuit breaker is active — new buys are halted.');
  }
  if (ctx.trend === 'STRONG_BEAR' && ctx.volatility === 'HIGH_EXPANSION') {
    escalate('CRITICAL', 'Strong downtrend with expanding volatility — adverse regime for new risk.');
  } else if (ctx.trend === 'STRONG_BEAR' || ctx.trend === 'WEAK_BEAR') {
    escalate('CAUTION', `Bearish regime (${ctx.trend.replace('_', ' ').toLowerCase()}).`);
  } else if (ctx.volatility === 'HIGH_EXPANSION') {
    escalate('CAUTION', 'Volatility in high expansion — position sizing risk is elevated.');
  }
  const cap = ctx.maxSingleHoldingPct ?? 18;
  if (ctx.weightPct !== undefined && ctx.weightPct > cap) {
    escalate('CAUTION', `Holding already at ${ctx.weightPct.toFixed(1)}% of the portfolio (cap ${cap}%).`);
  }

  return { severity, reasons };
};

// Buy-side ladder, most aggressive first. HOLD is the gate's floor — it
// never converts a buy into a sell.
const BUY_LADDER: MarketSignal[] = ['STRONG BUY', 'BUY', 'ACCUMULATE', 'HOLD'];

const downgrade = (signal: MarketSignal, steps: number): MarketSignal => {
  const idx = BUY_LADDER.indexOf(signal);
  if (idx === -1) return signal; // sell-side — untouched
  return BUY_LADDER[Math.min(BUY_LADDER.length - 1, idx + steps)];
};

/**
 * Apply the risk assessment to a debate verdict. Pure, asymmetric:
 * - NONE: verdict passes through unchanged.
 * - CAUTION: buy-side signals step one notch toward HOLD; confidence <= 65.
 * - CRITICAL: buy-side signals collapse to HOLD; confidence <= 50.
 * The risk reasons are attached as riskNote either way (when present).
 */
export const applyRiskGate = (verdict: DebateVerdict, assessment: RiskAssessment): DebateVerdict => {
  if (assessment.severity === 'NONE') return verdict;

  const gated: DebateVerdict = { ...verdict };
  if (assessment.severity === 'CAUTION') {
    gated.signal = downgrade(verdict.signal, 1);
    gated.confidence = Math.min(verdict.confidence, 65);
  } else {
    gated.signal = downgrade(verdict.signal, BUY_LADDER.length); // floor: HOLD
    gated.confidence = Math.min(verdict.confidence, 50);
  }
  gated.riskNote = `Risk gate (${assessment.severity}): ${assessment.reasons.join(' ')}${
    gated.signal !== verdict.signal ? ` Signal reduced from ${verdict.signal}.` : ''
  }`;
  return gated;
};
