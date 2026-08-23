
// Options strategy engine (pure domain logic) — the opstrat/OptionStratLib
// core: compose legs, compute the expiry payoff curve, find breakevens by
// interpolation, classify max profit/loss (detecting unlimited tails from
// the payoff slope), aggregate greeks, and estimate probability of profit
// under a lognormal terminal distribution. Educational analysis only — all
// execution rules of AGENT_RULES apply unchanged.

import { Greeks } from '../../types';

export interface OptionLeg {
  type: 'CE' | 'PE';
  side: 'BUY' | 'SELL';
  strike: number;
  premium: number; // per share
  lots: number;
  greeks?: Greeks; // per share, from the chain
}

export interface StrategyAnalysis {
  payoffCurve: { spot: number; pnl: number }[]; // per lot-adjusted position
  breakevens: number[];
  maxProfit: number | 'UNLIMITED';
  maxLoss: number | 'UNLIMITED';
  netPremium: number; // > 0 = credit received, < 0 = debit paid
  greeks: Greeks; // aggregated, sign-adjusted
  popPct: number | null; // probability of profit; null without IV/expiry
}

/** Expiry P&L of the whole position at a terminal spot (premium included). */
export const payoffAtExpiry = (legs: OptionLeg[], spot: number, lotSize: number): number => {
  let pnl = 0;
  for (const leg of legs) {
    const intrinsic = leg.type === 'CE' ? Math.max(0, spot - leg.strike) : Math.max(0, leg.strike - spot);
    const perShare = leg.side === 'BUY' ? intrinsic - leg.premium : leg.premium - intrinsic;
    pnl += perShare * leg.lots * lotSize;
  }
  return parseFloat(pnl.toFixed(2));
};

const phi = (x: number): number => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
const normCdf = (x: number): number => {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const poly =
    t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const nd = 1 - phi(Math.abs(x)) * poly;
  return x >= 0 ? nd : 1 - nd;
};

export interface AnalyzeOptions {
  spot: number;
  lotSize: number;
  ivPct?: number; // ATM IV for the PoP estimate
  daysToExpiry?: number;
  rangePct?: number; // payoff curve span around spot, default ±15%
  steps?: number; // curve resolution, default 120
}

export const analyzeStrategy = (legs: OptionLeg[], options: AnalyzeOptions): StrategyAnalysis | null => {
  if (legs.length === 0 || options.spot <= 0 || options.lotSize <= 0) return null;
  const { spot, lotSize } = options;
  const rangePct = options.rangePct ?? 15;
  const steps = options.steps ?? 120;

  const low = spot * (1 - rangePct / 100);
  const high = spot * (1 + rangePct / 100);
  const payoffCurve: { spot: number; pnl: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const s = low + ((high - low) * i) / steps;
    payoffCurve.push({ spot: parseFloat(s.toFixed(2)), pnl: payoffAtExpiry(legs, s, lotSize) });
  }

  // Breakevens: sign changes between samples, linearly interpolated.
  const breakevens: number[] = [];
  for (let i = 1; i < payoffCurve.length; i++) {
    const a = payoffCurve[i - 1];
    const b = payoffCurve[i];
    if ((a.pnl <= 0 && b.pnl > 0) || (a.pnl >= 0 && b.pnl < 0)) {
      const t = Math.abs(a.pnl) / (Math.abs(a.pnl) + Math.abs(b.pnl) || 1);
      breakevens.push(parseFloat((a.spot + t * (b.spot - a.spot)).toFixed(2)));
    }
  }

  // Unlimited tails: net long calls -> unlimited upside; net short calls ->
  // unlimited loss upside. Puts bound at zero, so downside stays finite.
  const netCalls = legs.reduce(
    (s, l) => s + (l.type === 'CE' ? (l.side === 'BUY' ? l.lots : -l.lots) : 0),
    0
  );
  const curveMax = Math.max(...payoffCurve.map(p => p.pnl));
  const curveMin = Math.min(...payoffCurve.map(p => p.pnl));
  // Evaluate payoff at 0 and far above range so put-side extremes are exact.
  const atZero = payoffAtExpiry(legs, 0, lotSize);
  const maxProfit: number | 'UNLIMITED' =
    netCalls > 0 ? 'UNLIMITED' : parseFloat(Math.max(curveMax, atZero).toFixed(2));
  const maxLoss: number | 'UNLIMITED' =
    netCalls < 0 ? 'UNLIMITED' : parseFloat(Math.min(curveMin, atZero).toFixed(2));

  const netPremium = parseFloat(
    legs
      .reduce((s, l) => s + (l.side === 'SELL' ? 1 : -1) * l.premium * l.lots * lotSize, 0)
      .toFixed(2)
  );

  const greeks: Greeks = { delta: 0, gamma: 0, theta: 0, vega: 0 };
  for (const leg of legs) {
    if (!leg.greeks) continue;
    const sign = leg.side === 'BUY' ? 1 : -1;
    const mult = sign * leg.lots * lotSize;
    greeks.delta += leg.greeks.delta * mult;
    greeks.gamma += leg.greeks.gamma * mult;
    greeks.theta += leg.greeks.theta * mult;
    greeks.vega += leg.greeks.vega * mult;
  }
  (Object.keys(greeks) as (keyof Greeks)[]).forEach(k => {
    greeks[k] = parseFloat(greeks[k].toFixed(2));
  });

  // PoP: lognormal terminal distribution (zero drift), probability mass over
  // the profitable samples of the curve.
  let popPct: number | null = null;
  if (options.ivPct && options.ivPct > 0 && options.daysToExpiry && options.daysToExpiry > 0) {
    const sigma = (options.ivPct / 100) * Math.sqrt(options.daysToExpiry / 365);
    const cdf = (x: number): number =>
      x <= 0 ? 0 : normCdf((Math.log(x / spot) + 0.5 * sigma * sigma) / sigma);
    let pop = 0;
    for (let i = 1; i < payoffCurve.length; i++) {
      const midPnl = (payoffCurve[i - 1].pnl + payoffCurve[i].pnl) / 2;
      if (midPnl > 0) pop += cdf(payoffCurve[i].spot) - cdf(payoffCurve[i - 1].spot);
    }
    // Tails beyond the sampled range
    if (payoffCurve[0].pnl > 0) pop += cdf(payoffCurve[0].spot);
    if (payoffCurve[payoffCurve.length - 1].pnl > 0) pop += 1 - cdf(payoffCurve[payoffCurve.length - 1].spot);
    popPct = parseFloat((pop * 100).toFixed(1));
  }

  return { payoffCurve, breakevens, maxProfit, maxLoss, netPremium, greeks, popPct };
};

// --- Strategy templates ------------------------------------------------------

export interface ChainStrike {
  strike: number;
  cePremium: number;
  pePremium: number;
  ceGreeks?: Greeks;
  peGreeks?: Greeks;
}

export interface StrategyTemplate {
  id: 'LONG_CALL' | 'LONG_PUT' | 'BULL_CALL_SPREAD' | 'BEAR_PUT_SPREAD' | 'LONG_STRADDLE' | 'SHORT_STRADDLE' | 'IRON_CONDOR';
  name: string;
  outlook: string;
}

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  { id: 'LONG_CALL', name: 'Long Call', outlook: 'Bullish — defined risk, unlimited upside' },
  { id: 'LONG_PUT', name: 'Long Put', outlook: 'Bearish — defined risk' },
  { id: 'BULL_CALL_SPREAD', name: 'Bull Call Spread', outlook: 'Moderately bullish — capped both ways' },
  { id: 'BEAR_PUT_SPREAD', name: 'Bear Put Spread', outlook: 'Moderately bearish — capped both ways' },
  { id: 'LONG_STRADDLE', name: 'Long Straddle', outlook: 'Big move either way — pays for movement' },
  { id: 'SHORT_STRADDLE', name: 'Short Straddle', outlook: 'Rangebound — collects premium, unlimited risk' },
  { id: 'IRON_CONDOR', name: 'Iron Condor', outlook: 'Rangebound — defined risk premium collection' }
];

const nearestIdx = (strikes: ChainStrike[], target: number): number => {
  let best = 0;
  for (let i = 1; i < strikes.length; i++) {
    if (Math.abs(strikes[i].strike - target) < Math.abs(strikes[best].strike - target)) best = i;
  }
  return best;
};

/** Build a template's legs from chain strikes (sorted ascending). */
export const buildStrategy = (
  templateId: StrategyTemplate['id'],
  strikes: ChainStrike[],
  spot: number,
  lots = 1
): OptionLeg[] | null => {
  if (strikes.length < 5) return null;
  const atm = nearestIdx(strikes, spot);
  const s = strikes;
  const leg = (
    idx: number,
    type: 'CE' | 'PE',
    side: 'BUY' | 'SELL'
  ): OptionLeg | null => {
    if (idx < 0 || idx >= s.length) return null;
    const row = s[idx];
    return {
      type,
      side,
      strike: row.strike,
      premium: type === 'CE' ? row.cePremium : row.pePremium,
      lots,
      greeks: type === 'CE' ? row.ceGreeks : row.peGreeks
    };
  };

  const combos: Record<StrategyTemplate['id'], (OptionLeg | null)[]> = {
    LONG_CALL: [leg(atm, 'CE', 'BUY')],
    LONG_PUT: [leg(atm, 'PE', 'BUY')],
    BULL_CALL_SPREAD: [leg(atm, 'CE', 'BUY'), leg(atm + 2, 'CE', 'SELL')],
    BEAR_PUT_SPREAD: [leg(atm, 'PE', 'BUY'), leg(atm - 2, 'PE', 'SELL')],
    LONG_STRADDLE: [leg(atm, 'CE', 'BUY'), leg(atm, 'PE', 'BUY')],
    SHORT_STRADDLE: [leg(atm, 'CE', 'SELL'), leg(atm, 'PE', 'SELL')],
    IRON_CONDOR: [
      leg(atm + 2, 'CE', 'SELL'),
      leg(atm + 4, 'CE', 'BUY'),
      leg(atm - 2, 'PE', 'SELL'),
      leg(atm - 4, 'PE', 'BUY')
    ]
  };

  const legs = combos[templateId];
  if (legs.some(l => l === null)) return null;
  return legs as OptionLeg[];
};
