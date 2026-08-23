
// Types for the holding-advice engine.
//
// One advice object per holding is the single source of truth for what the UI
// shows anywhere a holding appears (Holdings list, Universe, Rebalance) —
// surfaces must render THIS, never derive their own verdict, so a symbol can
// never show SELL on one screen and HOLD on another.

// Market view of a symbol (e.g. from the conviction engine). This is an INPUT:
// the advice engine combines it with portfolio context to produce the action.
export type MarketSignal =
  | 'STRONG BUY'
  | 'BUY'
  | 'ACCUMULATE'
  | 'HOLD'
  | 'REDUCE'
  | 'SELL'
  | 'AVOID';

export type AdviceAction = 'HOLD' | 'TRIM' | 'EXIT' | 'ADD';

// The exact trade needed to execute the advice.
export interface TradePlan {
  side: 'BUY' | 'SELL';
  quantity: number; // whole shares for stocks, units (2dp) for MFs
  rate: number; // price/NAV the plan is computed at
  amount: number; // quantity * rate
  fromWeightPct: number; // holding's weight before the trade
  toWeightPct: number; // holding's weight after the trade
}

export interface AdvicePosition {
  symbol: string;
  name: string;
  assetType: 'STOCK' | 'MF' | 'GOLD' | 'CRYPTO';
  quantity: number;
  currentPrice: number;
  currentValue: number;
}

export interface HoldingAdvice {
  symbol: string;
  action: AdviceAction;
  chip: 'HOLD' | 'SELL' | 'BUY'; // badge color/word for list rows
  headline: string; // short label, e.g. "SELL 90 × ₹3,420.32"
  detail: string; // full sentence with quantity, rate and amount
  weightPct: number; // current portfolio weight of this holding
  signal: MarketSignal; // the market signal this advice was derived from
  plan?: TradePlan; // absent for HOLD
}

// --- Bull vs Bear debate (adversarial signal generation) ---

export interface DebateCase {
  thesis: string; // one-sentence core argument
  points: string[]; // evidence-backed supporting points
}

export interface DebateVerdict {
  signal: MarketSignal;
  confidence: number; // 0-100; 50 = evenly balanced evidence
  bullPoints: string[]; // strongest surviving bull arguments
  bearPoints: string[]; // strongest surviving bear arguments
  reasoning: string; // judge's synthesis, 2-3 sentences
}

// --- Redeployment of sale proceeds ---

// A place freed cash could go. All market data (rates, lot sizes) comes in
// from the caller — the domain engine never fetches anything.
export interface RedeployCandidate {
  symbol: string;
  name: string;
  kind: 'STOCK' | 'ETF' | 'MF' | 'DERIVATIVE_HEDGE';
  // Price per share/unit; for DERIVATIVE_HEDGE, the margin required per lot.
  rate: number;
  lotSize?: number; // derivatives only, informational
  reason: string;
  // Cap on how much of the freed cash may flow to this candidate (default 100).
  maxAllocationPct?: number;
}

export interface RedeploySuggestion {
  symbol: string;
  kind: RedeployCandidate['kind'];
  side: 'BUY';
  quantity: number; // shares/units, or lots for a derivative hedge
  rate: number;
  amount: number;
  reason: string;
  detail: string; // full sentence: what to buy, how many, at what rate, amount
}

export interface RedeploymentPlan {
  freedCash: number; // total proceeds from all SELL plans
  suggestions: RedeploySuggestion[];
  residualCash: number; // what remains uninvested after the suggestions
}

export interface AdviceOptions {
  // Max weight a single holding may occupy before a trim is advised.
  maxSingleHoldingPct?: number; // default 18
  // Market signal per symbol, from ONE shared source (conviction engine).
  signals?: Record<string, MarketSignal>;
  // Fraction of the position to trim on a REDUCE signal. Default 0.25.
  reduceTrimFraction?: number;
}
