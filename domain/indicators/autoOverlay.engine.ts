
// Auto indicator selection (pure domain logic).
//
// The regime-gated indicator pattern from the adaptive-indicator family
// (TradingView's "Adaptive Market Suite" / "Regime Trend Rider" style
// scripts, HMM regime-detection repos): the RIGHT overlays depend on what
// the market is doing —
//   TRENDING  -> moving averages earn their place; static levels lose pull
//   RANGING   -> pivots/CPR and Bollinger band edges dominate; MAs whipsaw
//   SQUEEZE   -> Bollinger bands show the compression that resolves next
// SunAlpha already computes the regime deterministically, so the picker is
// a pure mapping with a reason per choice — the chart explains itself.

import { TrendRegime, VolatilityRegime, CPRWidth } from '../../types';

export interface OverlayContext {
  trend: TrendRegime;
  volatility: VolatilityRegime;
  cprWidth?: CPRWidth;
}

export interface OverlayPick {
  ema20: boolean;
  sma50: boolean;
  bollinger: boolean;
  cpr: boolean;
  volume: boolean;
  reasons: string[]; // one line per ON overlay — why it earned its place
}

export const pickOverlays = (ctx: OverlayContext): OverlayPick => {
  const strongTrend = ctx.trend === 'STRONG_BULL' || ctx.trend === 'STRONG_BEAR';
  const weakTrend = ctx.trend === 'WEAK_BULL' || ctx.trend === 'WEAK_BEAR';
  const squeeze = ctx.volatility === 'LOW_COMPRESSION' || ctx.cprWidth === 'NARROW';

  const pick: OverlayPick = {
    ema20: false,
    sma50: false,
    bollinger: false,
    cpr: false,
    volume: true, // participation always contextualizes price
    reasons: []
  };

  if (strongTrend) {
    pick.ema20 = true;
    pick.sma50 = true;
    pick.reasons.push('Strong trend — EMA20/SMA50 ribbon tracks it; pullbacks to the averages are the entries.');
    // Static levels lose pull in a runaway trend — CPR stays off.
  } else if (weakTrend) {
    pick.ema20 = true;
    pick.cpr = true;
    pick.reasons.push('Mild trend — EMA20 for direction, CPR/pivots still respected on pauses.');
  } else {
    pick.cpr = true;
    pick.bollinger = true;
    pick.reasons.push('Range-bound — trade the levels: CPR/pivots and Bollinger band edges mark the fade zones.');
  }

  if (squeeze && !pick.bollinger) {
    pick.bollinger = true;
    pick.reasons.push('Volatility squeeze — Bollinger bands show the compression; a band break sets direction.');
  } else if (squeeze) {
    pick.reasons.push('Squeeze on top of the range — a break of the bands or CPR is the trigger.');
  }

  if (ctx.volatility === 'HIGH_EXPANSION') {
    pick.reasons.push('Volatility expanding — watch volume for confirmation; size positions smaller.');
  }

  return pick;
};
