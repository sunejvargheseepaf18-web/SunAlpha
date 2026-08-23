
import { RebalanceAction } from "../rebalance/rebalance.types";

export type RiskConstraints = {
  maxSingleTradePct: number; // e.g. 0.05 for 5%
  maxTotalTurnoverPct: number; // e.g. 0.20 for 20%
  allowedSymbols?: string[];
  minSafetyScore?: number; // e.g. 0-100
  // Circuit breaker (kill-switch pattern): when the portfolio is already
  // bleeding past these thresholds, risk-increasing (BUY) actions are
  // refused; de-risking (SELL) actions remain allowed.
  haltBuysOnDrawdownPct?: number; // e.g. 15 -> halt buys at -15% from peak
  haltBuysOnDailyLossPct?: number; // e.g. 3 -> halt buys after a -3% day
};

// Live portfolio state the circuit breaker judges against. Optional — omit
// and the breaker checks are skipped (backward compatible).
export type PortfolioRiskState = {
  drawdownFromPeakPct?: number; // <= 0, e.g. -12.5
  dailyPnlPct?: number; // today's move, e.g. -3.2
};

export type RiskValidationInput = {
  actions: RebalanceAction[];
  constraints: RiskConstraints;
  portfolioValue: number;
  portfolioState?: PortfolioRiskState;
};

export type RiskValidationResult = {
  approved: boolean;
  reason?: string;
};
