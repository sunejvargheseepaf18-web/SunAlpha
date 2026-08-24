
// KGS++ day-plan engine (pure domain logic).
//
// The confluence of the app's three deterministic reads, in the open
// CPR-strategy tradition (the NRCPR "narrow range = trend day" rule and
// two-day-relationship bias that CPR screeners like
// DineshMv/CPR-based-Stock-Screener encode, per Ochoa's Pivot Boss):
//   1. CPR (by KGS): day-type from width, bias from the two-day value
//      relationship and where price sits vs the range, levels from the
//      pivots.
//   2. OI: confirmation — PCR positioning, fresh writing, and whether the
//      exchange's OI walls agree with the pivot levels.
//   3. MARKET regime: the gate — a plan against a strong regime is
//      downgraded, never upgraded (same asymmetry as the risk gate).
// Output is a fully-specified plan: bias, day type, entry zone, stop,
// targets — every confluence and every CONFLICT listed with its numbers.
// Advisory only: plans never execute anything.

import { TrendRegime, VolatilityRegime, CPRWidth, CPRRelationship } from '../../types';
import { OiSummary } from '../derivatives/oiAnalytics.engine';

export interface KgsPlusCpr {
  pivot: number;
  tc: number;
  bc: number;
  width: CPRWidth;
  relationship?: CPRRelationship;
  r1?: number;
  r2?: number;
  s1?: number;
  s2?: number;
}

export interface KgsPlusInput {
  spot: number;
  cpr: KgsPlusCpr;
  regime: { trend: TrendRegime; volatility: VolatilityRegime };
  oi?: OiSummary | null; // indices only — absent for stocks
}

export type DayType = 'TREND_DAY_LIKELY' | 'RANGE_DAY_LIKELY' | 'UNDECIDED';
export type PlanBias = 'LONG' | 'SHORT' | 'NEUTRAL';

export interface KgsPlusPlan {
  bias: PlanBias;
  dayType: DayType;
  confidence: number; // 0-100, from confluence minus conflict
  entryZone: { low: number; high: number } | null; // null when NEUTRAL
  stop: number | null;
  targets: number[]; // nearest first
  confluences: string[]; // every agreeing factor, with its numbers
  conflicts: string[]; // every disagreeing factor — shown, never hidden
}

const r2f = (v: number): number => parseFloat(v.toFixed(2));

export const buildKgsPlusPlan = (input: KgsPlusInput): KgsPlusPlan => {
  const { spot, cpr, regime, oi } = input;
  const confluences: string[] = [];
  const conflicts: string[] = [];

  // --- 1. Day type from CPR width (the NRCPR rule) ---------------------------
  const dayType: DayType =
    cpr.width === 'NARROW' ? 'TREND_DAY_LIKELY' : cpr.width === 'WIDE' ? 'RANGE_DAY_LIKELY' : 'UNDECIDED';
  if (dayType === 'TREND_DAY_LIKELY') confluences.push('Narrow CPR — trending day likely (NRCPR rule).');
  if (dayType === 'RANGE_DAY_LIKELY') confluences.push('Wide CPR — range-bound day likely; fade the extremes.');

  // --- 2. Directional votes --------------------------------------------------
  let bull = 0;
  let bear = 0;
  const vote = (dir: 'BULL' | 'BEAR', note: string) => {
    if (dir === 'BULL') bull++;
    else bear++;
    confluences.push(note);
  };

  if (cpr.relationship === 'HIGHER_VALUE') vote('BULL', 'CPR higher value vs yesterday — two-day structure bullish.');
  else if (cpr.relationship === 'OVERLAPPING_HIGHER') vote('BULL', 'CPR overlapping higher — mildly bullish structure.');
  else if (cpr.relationship === 'LOWER_VALUE') vote('BEAR', 'CPR lower value vs yesterday — two-day structure bearish.');
  else if (cpr.relationship === 'OVERLAPPING_LOWER') vote('BEAR', 'CPR overlapping lower — mildly bearish structure.');

  if (spot > cpr.tc) vote('BULL', `Price ${r2f(spot)} above TC ${r2f(cpr.tc)} — buyers control the range.`);
  else if (spot < cpr.bc) vote('BEAR', `Price ${r2f(spot)} below BC ${r2f(cpr.bc)} — sellers control the range.`);

  if (regime.trend === 'STRONG_BULL' || regime.trend === 'WEAK_BULL') vote('BULL', `Market regime ${regime.trend.replace('_', ' ').toLowerCase()}.`);
  else if (regime.trend === 'STRONG_BEAR' || regime.trend === 'WEAK_BEAR') vote('BEAR', `Market regime ${regime.trend.replace('_', ' ').toLowerCase()}.`);

  if (oi) {
    if (oi.pcrReading === 'BULLISH') vote('BULL', `PCR ${oi.pcr} — put-heavy positioning (support below).`);
    else if (oi.pcrReading === 'BEARISH') vote('BEAR', `PCR ${oi.pcr} — call-heavy positioning (supply above).`);
    if (oi.changeReading === 'BULLISH') vote('BULL', 'Fresh put writing today — writers defending lower levels.');
    else if (oi.changeReading === 'BEARISH') vote('BEAR', 'Fresh call writing today — writers capping upside.');
  }

  let bias: PlanBias = bull - bear >= 2 ? 'LONG' : bear - bull >= 2 ? 'SHORT' : 'NEUTRAL';
  if (bias === 'NEUTRAL' && (bull > 0 || bear > 0)) {
    conflicts.push(`Votes split ${bull} bull / ${bear} bear — no edge without a ${Math.max(bull, bear) === bull ? 'bullish' : 'bearish'} margin of 2.`);
  }

  // --- 3. Regime gate (asymmetric — never upgrades) --------------------------
  if (bias === 'LONG' && regime.trend === 'STRONG_BEAR') {
    bias = 'NEUTRAL';
    conflicts.push('Long confluence overruled: strong bear regime — no fresh longs against it.');
  } else if (bias === 'SHORT' && regime.trend === 'STRONG_BULL') {
    bias = 'NEUTRAL';
    conflicts.push('Short confluence overruled: strong bull regime — no fresh shorts against it.');
  }

  // --- 4. OI wall agreement with pivot levels --------------------------------
  if (oi && cpr.s1 !== undefined && bias === 'LONG') {
    const wallNearSupport = Math.abs(oi.supportStrike - cpr.s1) / spot < 0.005 || Math.abs(oi.supportStrike - cpr.bc) / spot < 0.005;
    if (wallNearSupport) confluences.push(`OI put wall ${oi.supportStrike} sits on the pivot support — level twice-defended.`);
  }
  if (oi && cpr.r1 !== undefined && bias === 'SHORT') {
    const wallNearResistance = Math.abs(oi.resistanceStrike - cpr.r1) / spot < 0.005 || Math.abs(oi.resistanceStrike - cpr.tc) / spot < 0.005;
    if (wallNearResistance) confluences.push(`OI call wall ${oi.resistanceStrike} sits on the pivot resistance — level twice-capped.`);
  }

  // --- 5. Levels -------------------------------------------------------------
  const buffer = Math.max((cpr.tc - cpr.bc) * 0.25, spot * 0.001); // quarter-range or 0.1%
  let entryZone: KgsPlusPlan['entryZone'] = null;
  let stop: number | null = null;
  let targets: number[] = [];

  if (bias === 'LONG') {
    entryZone = { low: r2f(cpr.pivot), high: r2f(cpr.tc) }; // pullback into the range top
    stop = r2f(cpr.bc - buffer);
    targets = [cpr.r1, cpr.r2, oi && oi.resistanceStrike > spot ? oi.resistanceStrike : undefined]
      .filter((t): t is number => typeof t === 'number' && t > spot)
      .sort((a, b) => a - b)
      .map(r2f);
  } else if (bias === 'SHORT') {
    entryZone = { low: r2f(cpr.bc), high: r2f(cpr.pivot) }; // pullback into the range bottom
    stop = r2f(cpr.tc + buffer);
    targets = [cpr.s1, cpr.s2, oi && oi.supportStrike < spot ? oi.supportStrike : undefined]
      .filter((t): t is number => typeof t === 'number' && t < spot)
      .sort((a, b) => b - a)
      .map(r2f);
  }

  // --- 6. Confidence from confluence vs conflict -----------------------------
  let confidence = 40 + 10 * Math.abs(bull - bear) + 5 * (dayType !== 'UNDECIDED' ? 1 : 0) - 10 * conflicts.length;
  if (regime.volatility === 'HIGH_EXPANSION') {
    confidence -= 10;
    conflicts.push('Volatility expanding — size smaller, expect stop noise.');
  }
  confidence = Math.max(0, Math.min(100, Math.round(bias === 'NEUTRAL' ? Math.min(confidence, 45) : confidence)));

  return { bias, dayType, confidence, entryZone, stop, targets, confluences, conflicts };
};
