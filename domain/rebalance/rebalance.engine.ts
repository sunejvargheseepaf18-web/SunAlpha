
import { RebalanceInput, RebalanceAction } from "./rebalance.types";

/**
 * PURE DOMAIN FUNCTION
 * Calculates required Buy/Sell actions to match target allocations.
 * Contains NO side effects, NO IO, NO external dependencies.
 */
export function rebalancePortfolio(input: RebalanceInput): RebalanceAction[] {
  const actions: RebalanceAction[] = [];

  for (const target of input.targetAllocations) {
    const holding = input.holdings.find(h => h.symbol === target.symbol);

    const currentValue = holding?.value ?? 0;
    const desiredValue = input.totalValue * target.targetWeight;
    const delta = desiredValue - currentValue;

    // Ignore negligible dust (< ₹1) to avoid spam
    if (Math.abs(delta) < 1) continue;

    actions.push(
      delta > 0
        ? { type: "BUY", symbol: target.symbol, amount: delta }
        : { type: "SELL", symbol: target.symbol, amount: Math.abs(delta) }
    );
  }

  return actions;
}
