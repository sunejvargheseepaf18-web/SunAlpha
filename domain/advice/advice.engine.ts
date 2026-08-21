
// Holding-advice engine (pure domain logic — no React, no network, no storage).
//
// Combines a holding's portfolio context (weight vs. concentration cap) with
// its market signal to produce ONE fully-specified recommendation: the action,
// and exactly how many shares/units to trade, at what rate, for what amount.
//
// Precedence per holding:
//   1. Signal SELL/AVOID        -> EXIT the full position
//   2. Weight above the cap     -> TRIM down to the cap
//   3. Signal REDUCE            -> TRIM a fixed fraction of the position
//   4. Signal BUY-family        -> ADD (sized, with resulting weight)
//   5. Otherwise                -> HOLD
//
// Rule 1 outranks rule 2 deliberately: a holding "within allocation" but with
// a SELL signal must show SELL everywhere — this is what keeps the Universe
// view and the Holdings view consistent for the same symbol.

import {
  AdviceOptions,
  AdvicePosition,
  HoldingAdvice,
  MarketSignal,
  TradePlan
} from './advice.types';

const DEFAULT_CAP_PCT = 18;
const DEFAULT_REDUCE_FRACTION = 0.25;
const MIN_ADD_AMOUNT = 5000; // floor for a meaningful ADD suggestion

const inr = (n: number): string => `₹${Math.round(n).toLocaleString('en-IN')}`;

const fmtRate = (n: number): string =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Stocks trade in whole shares; MF redemptions/purchases in units to 2dp.
const roundQty = (qty: number, assetType: AdvicePosition['assetType'], mode: 'ceil' | 'floor'): number => {
  if (assetType === 'MF') {
    const scaled = qty * 100;
    return (mode === 'ceil' ? Math.ceil(scaled) : Math.floor(scaled)) / 100;
  }
  return mode === 'ceil' ? Math.ceil(qty) : Math.floor(qty);
};

const fmtQty = (qty: number, assetType: AdvicePosition['assetType']): string =>
  assetType === 'MF' ? qty.toFixed(2) : String(qty);

const unitWord = (assetType: AdvicePosition['assetType']): string =>
  assetType === 'MF' ? 'units' : 'shares';

export const generateHoldingAdvices = (
  positions: AdvicePosition[],
  options: AdviceOptions = {}
): HoldingAdvice[] => {
  const capPct = options.maxSingleHoldingPct ?? DEFAULT_CAP_PCT;
  const reduceFraction = options.reduceTrimFraction ?? DEFAULT_REDUCE_FRACTION;
  const signals = options.signals ?? {};
  const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);

  return positions.map(pos => {
    const weightPct = totalValue > 0 ? (pos.currentValue / totalValue) * 100 : 0;
    const signal: MarketSignal = signals[pos.symbol] ?? 'HOLD';
    const units = unitWord(pos.assetType);

    const sellPlan = (quantity: number): TradePlan => {
      const amount = quantity * pos.currentPrice;
      return {
        side: 'SELL',
        quantity,
        rate: pos.currentPrice,
        amount,
        fromWeightPct: weightPct,
        toWeightPct: totalValue > 0 ? ((pos.currentValue - amount) / totalValue) * 100 : 0
      };
    };

    // 1. EXIT — the market signal says get out, regardless of allocation.
    if (signal === 'SELL' || signal === 'AVOID') {
      const plan = sellPlan(pos.quantity);
      return {
        symbol: pos.symbol,
        action: 'EXIT' as const,
        chip: 'SELL' as const,
        headline: `SELL ${fmtQty(plan.quantity, pos.assetType)} × ${fmtRate(plan.rate)}`,
        detail:
          `Market signal ${signal} — exit all ${fmtQty(plan.quantity, pos.assetType)} ${units} ` +
          `@ ${fmtRate(plan.rate)} (≈ ${inr(plan.amount)}). ` +
          `Frees ${weightPct.toFixed(1)}% of portfolio.`,
        weightPct,
        signal,
        plan
      };
    }

    // 2. TRIM to cap — position is too large a share of the portfolio.
    // Assumes proceeds stay in the portfolio as cash (total value unchanged).
    if (weightPct > capPct && totalValue > 0) {
      const excessValue = pos.currentValue - (capPct / 100) * totalValue;
      const quantity = Math.min(
        pos.quantity,
        roundQty(excessValue / pos.currentPrice, pos.assetType, 'ceil')
      );
      const plan = sellPlan(quantity);
      return {
        symbol: pos.symbol,
        action: 'TRIM' as const,
        chip: 'SELL' as const,
        headline: `SELL ${fmtQty(quantity, pos.assetType)} × ${fmtRate(plan.rate)}`,
        detail:
          `${pos.symbol} is ${weightPct.toFixed(1)}% of portfolio — above the ${capPct}% ` +
          `single-holding cap. Sell ${fmtQty(quantity, pos.assetType)} ${units} @ ${fmtRate(plan.rate)} ` +
          `(≈ ${inr(plan.amount)}) to bring it to ${plan.toWeightPct.toFixed(1)}%.`,
        weightPct,
        signal,
        plan
      };
    }

    // 3. TRIM on REDUCE — take a fixed fraction off the table.
    if (signal === 'REDUCE') {
      const quantity = Math.max(
        roundQty(pos.quantity * reduceFraction, pos.assetType, 'floor'),
        pos.assetType === 'MF' ? 0.01 : 1
      );
      const plan = sellPlan(Math.min(quantity, pos.quantity));
      return {
        symbol: pos.symbol,
        action: 'TRIM' as const,
        chip: 'SELL' as const,
        headline: `SELL ${fmtQty(plan.quantity, pos.assetType)} × ${fmtRate(plan.rate)}`,
        detail:
          `Market signal REDUCE — trim ${Math.round(reduceFraction * 100)}% of the position: ` +
          `sell ${fmtQty(plan.quantity, pos.assetType)} ${units} @ ${fmtRate(plan.rate)} ` +
          `(≈ ${inr(plan.amount)}), taking weight from ${weightPct.toFixed(1)}% to ${plan.toWeightPct.toFixed(1)}%.`,
        weightPct,
        signal,
        plan
      };
    }

    // 4. ADD — bullish signal on an existing holding, sized and priced.
    if (signal === 'STRONG BUY' || signal === 'BUY' || signal === 'ACCUMULATE') {
      const targetAmount = Math.max(pos.currentValue * 0.25, MIN_ADD_AMOUNT);
      const quantity = roundQty(targetAmount / pos.currentPrice, pos.assetType, 'floor');
      if (quantity > 0) {
        const amount = quantity * pos.currentPrice;
        const plan: TradePlan = {
          side: 'BUY',
          quantity,
          rate: pos.currentPrice,
          amount,
          fromWeightPct: weightPct,
          toWeightPct:
            totalValue > 0 ? ((pos.currentValue + amount) / (totalValue + amount)) * 100 : 0
        };
        return {
          symbol: pos.symbol,
          action: 'ADD' as const,
          chip: 'BUY' as const,
          headline: `BUY ${fmtQty(quantity, pos.assetType)} × ${fmtRate(plan.rate)}`,
          detail:
            `Market signal ${signal} — add ${fmtQty(quantity, pos.assetType)} ${units} ` +
            `@ ${fmtRate(plan.rate)} (≈ ${inr(amount)}), taking weight from ` +
            `${weightPct.toFixed(1)}% to ${plan.toWeightPct.toFixed(1)}%.`,
          weightPct,
          signal,
          plan
        };
      }
    }

    // 5. HOLD — within allocation, no active signal.
    return {
      symbol: pos.symbol,
      action: 'HOLD' as const,
      chip: 'HOLD' as const,
      headline: 'HOLD',
      detail: `Within allocation — no active signal. ${weightPct.toFixed(1)}% of portfolio.`,
      weightPct,
      signal,
      plan: undefined
    };
  });
};
