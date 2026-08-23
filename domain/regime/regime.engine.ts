
// Market regime engine (pure domain logic).
//
// A deterministic regime classifier in the vol-percentile x trend-quadrant
// tradition (the practical alternative to fitted HMMs for a browser app):
// - Volatility state is SELF-RELATIVE: today's 20-day realized vol ranked
//   against the symbol's own rolling history — a jumpy smallcap and a calm
//   index each get judged against themselves, not a static threshold.
// - Trend state comes from a composite score (price vs SMA50, SMA20/50
//   alignment, SMA20 slope, 60-day return) mapped to five states.
// - Confidence is computed from signal agreement, never hardcoded.
// - Hysteresis: a previous regime flips only when the new evidence clears
//   the boundary by a buffer — regimes describe weather, not raindrops.

import { BtBar } from '../backtest/backtest.engine';
import { sma } from '../backtest/strategies';
import { TrendRegime, VolatilityRegime } from '../../types';

export interface RegimeReading {
  volatility: VolatilityRegime;
  trend: TrendRegime;
  confidence: number; // 0-1, from signal agreement
  volPercentile: number; // 0-100, self-relative
  trendScore: number; // -100..100 composite
  drawdownPct: number; // from the lookback high, <= 0
  summary: string;
}

const VOL_WINDOW = 20;
const LOW_PCTL = 25;
const HIGH_PCTL = 75;
const HYSTERESIS_PCTL = 8;
const HYSTERESIS_SCORE = 8;

/** Annualized realized volatility (%) of log returns over the last `window` bars ending at `end`. */
export const realizedVolPct = (bars: BtBar[], window = VOL_WINDOW, end = bars.length): number | null => {
  if (end < window + 1) return null;
  const returns: number[] = [];
  for (let i = end - window; i < end; i++) {
    if (bars[i - 1].close > 0) returns.push(Math.log(bars[i].close / bars[i - 1].close));
  }
  if (returns.length < 2) return null;
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) * (r - mean), 0) / (returns.length - 1);
  return parseFloat((Math.sqrt(variance) * Math.sqrt(252) * 100).toFixed(2));
};

/** Percentile (0-100) of the latest realized vol within its own rolling history. */
export const volPercentile = (bars: BtBar[], window = VOL_WINDOW): number | null => {
  const current = realizedVolPct(bars, window);
  if (current === null) return null;
  const history: number[] = [];
  for (let end = window + 1; end <= bars.length; end++) {
    const v = realizedVolPct(bars, window, end);
    if (v !== null) history.push(v);
  }
  if (history.length < 10) return 50; // too little self-history to rank — neutral
  const below = history.filter(v => v <= current).length;
  return parseFloat(((below / history.length) * 100).toFixed(1));
};

/** Composite trend score: -100 (deep bear) .. +100 (strong bull). */
export const trendScore = (bars: BtBar[]): number | null => {
  const last = bars.length - 1;
  const close = bars[last]?.close;
  const sma20 = sma(bars, 20, last);
  const sma50 = sma(bars, 50, last);
  if (!close || sma20 === null || sma50 === null) return null;

  let score = 0;
  score += close > sma50 ? 25 : -25;
  score += sma20 > sma50 ? 25 : -25;

  const sma20Prev = sma(bars, 20, last - 10);
  if (sma20Prev !== null && sma20Prev > 0) {
    const slopePct = ((sma20 - sma20Prev) / sma20Prev) * 100;
    score += Math.max(-25, Math.min(25, slopePct * 12));
  }

  const lookback = Math.min(60, last);
  const past = bars[last - lookback]?.close;
  if (past && past > 0) {
    const returnPct = ((close - past) / past) * 100;
    score += Math.max(-25, Math.min(25, returnPct * 1.5));
  }

  return parseFloat(Math.max(-100, Math.min(100, score)).toFixed(1));
};

const trendFromScore = (score: number): TrendRegime =>
  score >= 55 ? 'STRONG_BULL'
  : score >= 20 ? 'WEAK_BULL'
  : score <= -55 ? 'STRONG_BEAR'
  : score <= -20 ? 'WEAK_BEAR'
  : 'SIDEWAYS';

const volFromPercentile = (pctl: number): VolatilityRegime =>
  pctl <= LOW_PCTL ? 'LOW_COMPRESSION' : pctl >= HIGH_PCTL ? 'HIGH_EXPANSION' : 'NORMAL';

export const detectRegimeFromBars = (
  bars: BtBar[],
  previous?: Pick<RegimeReading, 'volatility' | 'trend'>
): RegimeReading | null => {
  const pctl = volPercentile(bars);
  const score = trendScore(bars);
  if (pctl === null || score === null) return null;

  let volatility = volFromPercentile(pctl);
  let trend = trendFromScore(score);

  // Hysteresis: hold the previous state unless the evidence clears the
  // boundary by a buffer.
  if (previous) {
    if (previous.volatility !== volatility) {
      const insideBuffer =
        (volatility === 'LOW_COMPRESSION' && pctl > LOW_PCTL - HYSTERESIS_PCTL) ||
        (volatility === 'HIGH_EXPANSION' && pctl < HIGH_PCTL + HYSTERESIS_PCTL) ||
        (volatility === 'NORMAL' &&
          ((previous.volatility === 'LOW_COMPRESSION' && pctl < LOW_PCTL + HYSTERESIS_PCTL) ||
            (previous.volatility === 'HIGH_EXPANSION' && pctl > HIGH_PCTL - HYSTERESIS_PCTL)));
      if (insideBuffer) volatility = previous.volatility;
    }
    if (previous.trend !== trend) {
      const boundaries: Record<TrendRegime, number> = {
        STRONG_BULL: 55, WEAK_BULL: 20, SIDEWAYS: 0, WEAK_BEAR: -20, STRONG_BEAR: -55
      };
      const target = boundaries[trend];
      if (Math.abs(score - target) < HYSTERESIS_SCORE && trend !== 'SIDEWAYS') {
        trend = previous.trend;
      }
    }
  }

  // Drawdown from the lookback high
  const closes = bars.map(b => b.close);
  const peak = Math.max(...closes);
  const drawdownPct = parseFloat((((closes[closes.length - 1] - peak) / peak) * 100).toFixed(2));

  // Confidence from agreement: strong trend evidence + vol far from its
  // boundaries reads as high conviction; everything near a boundary is murky.
  const trendStrength = Math.min(1, Math.abs(score) / 80);
  const volClarity = Math.min(1, Math.abs(pctl - 50) / 40);
  const confidence = parseFloat((0.4 + 0.4 * trendStrength + 0.2 * volClarity).toFixed(2));

  const volText =
    volatility === 'LOW_COMPRESSION'
      ? `Volatility in its ${pctl.toFixed(0)}th percentile — squeeze conditions, expect expansion.`
      : volatility === 'HIGH_EXPANSION'
        ? `Volatility elevated (${pctl.toFixed(0)}th percentile of its own history).`
        : `Volatility normal for this instrument.`;
  const trendText =
    trend === 'STRONG_BULL' ? 'Dominant uptrend.'
    : trend === 'WEAK_BULL' ? 'Mild uptrend.'
    : trend === 'STRONG_BEAR' ? 'Dominant downtrend.'
    : trend === 'WEAK_BEAR' ? 'Mild downtrend.'
    : 'Range-bound.';
  const ddText = drawdownPct <= -15 ? ` ${Math.abs(drawdownPct).toFixed(0)}% below its high.` : '';

  return {
    volatility,
    trend,
    confidence,
    volPercentile: pctl,
    trendScore: score,
    drawdownPct,
    summary: `${trendText} ${volText}${ddText}`
  };
};
