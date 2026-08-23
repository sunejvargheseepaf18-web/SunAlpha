
import { RiskValidationInput, RiskValidationResult } from "./risk.types";

/**
 * PURE DOMAIN FUNCTION
 * Validates proposed actions against strict risk constraints.
 * Acts as the final gate before execution.
 */
export function validateTradeRisk(input: RiskValidationInput): RiskValidationResult {
  const { actions, constraints, portfolioValue, portfolioState } = input;

  // 0. Circuit breaker — when the portfolio is already past its loss
  // thresholds, refuse risk-increasing (BUY) actions. De-risking is allowed.
  const hasBuys = actions.some(a => a.type === 'BUY');
  if (hasBuys && portfolioState) {
    const { drawdownFromPeakPct, dailyPnlPct } = portfolioState;
    if (
      constraints.haltBuysOnDrawdownPct !== undefined &&
      drawdownFromPeakPct !== undefined &&
      drawdownFromPeakPct <= -Math.abs(constraints.haltBuysOnDrawdownPct)
    ) {
      return {
        approved: false,
        reason: `Circuit breaker: portfolio is ${drawdownFromPeakPct.toFixed(1)}% off its peak (halt threshold ${-Math.abs(constraints.haltBuysOnDrawdownPct)}%). New buys are halted; only de-risking trades are allowed.`
      };
    }
    if (
      constraints.haltBuysOnDailyLossPct !== undefined &&
      dailyPnlPct !== undefined &&
      dailyPnlPct <= -Math.abs(constraints.haltBuysOnDailyLossPct)
    ) {
      return {
        approved: false,
        reason: `Circuit breaker: portfolio is down ${dailyPnlPct.toFixed(1)}% today (halt threshold ${-Math.abs(constraints.haltBuysOnDailyLossPct)}%). New buys are halted; only de-risking trades are allowed.`
      };
    }
  }

  let totalTurnover = 0;

  for (const action of actions) {
    const pct = action.amount / portfolioValue;
    totalTurnover += pct;

    // 1. Single Trade Limit Check
    if (pct > constraints.maxSingleTradePct) {
      return {
        approved: false,
        reason: `Risk Violation: Trade size for ${action.symbol} (${(pct * 100).toFixed(1)}%) exceeds limit (${(constraints.maxSingleTradePct * 100).toFixed(1)}%)`
      };
    }

    // 2. Allowed Universe Check
    if (constraints.allowedSymbols && !constraints.allowedSymbols.includes(action.symbol)) {
      return {
        approved: false,
        reason: `Risk Violation: Symbol ${action.symbol} is not in the allowed trading universe.`
      };
    }
  }

  // 3. Total Turnover Check (Churn Prevention)
  if (totalTurnover > constraints.maxTotalTurnoverPct) {
    return {
      approved: false,
      reason: `Risk Violation: Total turnover (${(totalTurnover * 100).toFixed(1)}%) exceeds safety limit (${(constraints.maxTotalTurnoverPct * 100).toFixed(1)}%).`
    };
  }

  return { approved: true };
}
