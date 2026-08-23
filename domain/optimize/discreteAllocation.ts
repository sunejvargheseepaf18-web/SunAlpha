
// Discrete allocation (pure): turn target weights into executable whole-unit
// orders — PyPortfolioOpt's DiscreteAllocation, long-only. Stocks buy whole
// shares; MFs buy units to 2dp. Greedy remainder pass spends leftover cash
// on whichever asset is furthest below its target weight.

export interface AllocatableAsset {
  symbol: string;
  price: number;
  isMf?: boolean;
}

export interface DiscreteAllocationResult {
  quantities: Record<string, number>;
  spent: number;
  leftoverCash: number;
  achievedWeights: Record<string, number>;
}

const roundQty = (qty: number, isMf: boolean | undefined, mode: 'floor'): number =>
  isMf ? Math.floor(qty * 100) / 100 : Math.floor(qty);

export const discreteAllocation = (
  assets: AllocatableAsset[],
  weights: number[],
  totalValue: number
): DiscreteAllocationResult | null => {
  if (assets.length !== weights.length || totalValue <= 0) return null;
  if (assets.some(a => a.price <= 0)) return null;

  const quantities: Record<string, number> = {};
  let cash = totalValue;

  // Pass 1: floor allocation to each target
  assets.forEach((asset, i) => {
    const target = weights[i] * totalValue;
    const qty = roundQty(target / asset.price, asset.isMf, 'floor');
    quantities[asset.symbol] = qty;
    cash -= qty * asset.price;
  });

  // Pass 2: greedy remainder — buy one more unit of whichever asset is
  // furthest below target and still affordable. Bounded iterations.
  for (let iter = 0; iter < 1000; iter++) {
    let bestIdx = -1;
    let bestDeficit = 0;
    assets.forEach((asset, i) => {
      const unit = asset.isMf ? 0.01 : 1;
      const unitCost = unit * asset.price;
      if (unitCost > cash) return;
      const current = quantities[asset.symbol] * asset.price;
      const deficit = weights[i] * totalValue - current;
      if (deficit > bestDeficit) {
        bestDeficit = deficit;
        bestIdx = i;
      }
    });
    if (bestIdx === -1) break;
    const asset = assets[bestIdx];
    const unit = asset.isMf ? 0.01 : 1;
    quantities[asset.symbol] = parseFloat((quantities[asset.symbol] + unit).toFixed(2));
    cash -= unit * asset.price;
  }

  const spent = totalValue - cash;
  const achievedWeights: Record<string, number> = {};
  assets.forEach(asset => {
    achievedWeights[asset.symbol] = parseFloat(
      ((quantities[asset.symbol] * asset.price) / totalValue).toFixed(4)
    );
  });

  return {
    quantities,
    spent: parseFloat(spent.toFixed(2)),
    leftoverCash: parseFloat(cash.toFixed(2)),
    achievedWeights
  };
};
