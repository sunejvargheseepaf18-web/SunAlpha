
// Copy trading engine (pure domain logic).
//
// The mechanics every serious copy-trading system converges on (eToro's
// CopyTrader, and open engines like copy-my-trade and polycopier):
//   1. PROPORTIONAL MIRRORING — the follower's trade scales by
//      allocation / leader-equity, so the follower copies the leader's
//      portfolio strategy, not just trade directions.
//   2. POSITION-AWARE EXIT CAPPING — a copied SELL can never exceed what
//      the follower actually holds; overfills that would flip a follower
//      into an unintended short are structurally impossible.
//   3. COPY STOP-LOSS — one loss threshold on the whole copy relationship;
//      when unrealized loss reaches it, everything closes and copying stops.
//   4. RISK SCORE — a 1-10 rating from the leader's own equity-curve
//      volatility and drawdown, so followers shortlist by risk, not hype.
//
// SunAlpha has no social network of humans, so "leaders" are the app's
// algorithmic strategies with REAL backtested track records — no invented
// star traders. Advisory-only: this engine emits exact order suggestions,
// never executes them.

export interface EquityPoint {
  date: string;
  value: number;
}

export interface LeaderTrackRecord {
  id: string;
  name: string;
  description: string;
  symbol: string; // the instrument this leader trades
  equityCurve: EquityPoint[];
  stats: {
    totalReturnPct: number;
    maxDrawdownPct: number; // <= 0
    winRatePct: number;
    profitFactor: number | null;
    tradesCount: number;
    exposurePct: number;
  };
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  description: string;
  symbol: string;
  score: number; // 0-100 composite rank score
  riskScore: number; // 1-10, higher = riskier
  returnPct: number;
  maxDrawdownPct: number;
  winRatePct: number;
  profitFactor: number | null;
  tradesCount: number;
  lowConfidence: boolean; // too few closed trades to trust the stats
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Annualized volatility (%) of an equity curve's daily returns. */
export const equityCurveVolPct = (curve: EquityPoint[]): number | null => {
  if (curve.length < 15) return null;
  const returns: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    if (curve[i - 1].value > 0) returns.push(curve[i].value / curve[i - 1].value - 1);
  }
  if (returns.length < 2) return null;
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) * (r - mean), 0) / (returns.length - 1);
  return parseFloat((Math.sqrt(variance) * Math.sqrt(252) * 100).toFixed(2));
};

/**
 * eToro-style 1-10 risk score from the leader's own equity curve:
 * half from annualized volatility, half from max drawdown depth.
 * 1-3 conservative, 4-6 moderate, 7-10 aggressive.
 */
export const computeRiskScore = (curve: EquityPoint[], maxDrawdownPct: number): number => {
  const vol = equityCurveVolPct(curve) ?? 20; // unknown history reads as moderate
  const volComponent = clamp(vol / 8, 0, 5); // 40%+ annualized vol maxes out
  const ddComponent = clamp(Math.abs(maxDrawdownPct) / 8, 0, 5); // 40%+ drawdown maxes out
  return clamp(Math.round(volComponent + ddComponent), 1, 10);
};

const MIN_TRADES_FOR_CONFIDENCE = 3;

/**
 * Rank leaders by a transparent composite: reward return and win rate,
 * punish drawdown, credit profit factor. Thin track records (< 3 closed
 * trades) get flagged and pulled toward neutral rather than topping the
 * board on one lucky trade.
 */
export const rankLeaders = (leaders: LeaderTrackRecord[]): LeaderboardEntry[] => {
  const entries = leaders.map(leader => {
    const s = leader.stats;
    let score =
      50 +
      clamp(s.totalReturnPct, -40, 40) * 1.2 -
      Math.abs(s.maxDrawdownPct) * 1.5 +
      (s.winRatePct - 50) * 0.2 +
      (s.profitFactor !== null ? clamp(s.profitFactor, 0, 3) * 4 : 0);

    const lowConfidence = s.tradesCount < MIN_TRADES_FOR_CONFIDENCE;
    if (lowConfidence) score = 50 + (score - 50) * 0.6; // shrink toward neutral

    return {
      id: leader.id,
      name: leader.name,
      description: leader.description,
      symbol: leader.symbol,
      score: parseFloat(clamp(score, 0, 100).toFixed(1)),
      riskScore: computeRiskScore(leader.equityCurve, s.maxDrawdownPct),
      returnPct: s.totalReturnPct,
      maxDrawdownPct: s.maxDrawdownPct,
      winRatePct: s.winRatePct,
      profitFactor: s.profitFactor,
      tradesCount: s.tradesCount,
      lowConfidence
    };
  });
  return entries.sort((a, b) => b.score - a.score);
};

// --- Proportional trade mirroring --------------------------------------------

export interface LeaderTrade {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
}

export interface CopyConstraints {
  /** Orders below this notional are dust — skip them. Default ₹500. */
  minOrderValue?: number;
  /** Cap one position at this % of the follower's allocation. Default 100. */
  maxPositionPct?: number;
  /** 1 = whole shares (default); 10000 = 4dp for crypto-style units. */
  quantityPrecision?: number;
}

export interface CopyOrder {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  rate: number;
  amount: number;
  reason: string;
}

/**
 * Mirror ONE leader trade into an exact follower order.
 * Returns null when the scaled order is dust, capped to nothing, or an
 * exit with nothing held (already out).
 */
export const mapCopyTrade = (
  trade: LeaderTrade,
  leaderEquity: number,
  followerAllocation: number,
  followerHoldings: Record<string, number>,
  constraints: CopyConstraints = {}
): CopyOrder | null => {
  if (leaderEquity <= 0 || followerAllocation <= 0 || trade.quantity <= 0 || trade.price <= 0) {
    return null;
  }
  const minOrderValue = constraints.minOrderValue ?? 500;
  const maxPositionPct = constraints.maxPositionPct ?? 100;
  const precision = constraints.quantityPrecision ?? 1;

  const ratio = followerAllocation / leaderEquity;
  const held = followerHoldings[trade.symbol] ?? 0;

  let quantity: number;
  if (trade.side === 'BUY') {
    let qty = trade.quantity * ratio;
    // Position cap: held + bought may not exceed maxPositionPct of allocation
    const capValue = (maxPositionPct / 100) * followerAllocation;
    const headroom = capValue - held * trade.price;
    if (headroom <= 0) return null;
    qty = Math.min(qty, headroom / trade.price);
    quantity = Math.floor(qty * precision) / precision;
  } else {
    // Position-aware exit capping: never sell more than the follower holds.
    if (held <= 0) return null;
    const qty = Math.min(trade.quantity * ratio, held);
    quantity = Math.floor(qty * precision) / precision;
    // A full exit by the leader should not strand dust with the follower:
    // if what remains after rounding is negligible, sell everything held.
    if (trade.quantity * ratio >= held) quantity = held;
  }

  if (quantity <= 0) return null;
  const amount = parseFloat((quantity * trade.price).toFixed(2));
  if (trade.side === 'BUY' && amount < minOrderValue) return null;

  return {
    symbol: trade.symbol,
    side: trade.side,
    quantity,
    rate: trade.price,
    amount,
    reason: `Mirrors leader ${trade.side} at ${(ratio * 100).toFixed(1)}% scale (allocation vs leader equity).`
  };
};

// --- Copy stop-loss -----------------------------------------------------------

export interface CopyStopLossReading {
  triggered: boolean;
  pnlPct: number; // current P&L of the copy relationship, signed
  action: 'CONTINUE' | 'CLOSE_ALL_AND_STOP';
  message: string;
}

/**
 * One stop-loss on the WHOLE copy relationship: when the copied capital's
 * loss reaches `stopLossPct`, close all copied positions and stop copying.
 */
export const evaluateCopyStopLoss = (
  allocatedAmount: number,
  currentValue: number,
  stopLossPct: number
): CopyStopLossReading => {
  if (allocatedAmount <= 0) {
    return { triggered: false, pnlPct: 0, action: 'CONTINUE', message: 'No capital allocated.' };
  }
  const pnlPct = parseFloat((((currentValue - allocatedAmount) / allocatedAmount) * 100).toFixed(2));
  const triggered = pnlPct <= -Math.abs(stopLossPct);
  return {
    triggered,
    pnlPct,
    action: triggered ? 'CLOSE_ALL_AND_STOP' : 'CONTINUE',
    message: triggered
      ? `Copy stop-loss hit: down ${Math.abs(pnlPct).toFixed(1)}% vs the ${Math.abs(stopLossPct)}% limit. Close all copied positions and stop copying.`
      : `Copy P&L ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}% — within the ${Math.abs(stopLossPct)}% stop.`
  };
};
