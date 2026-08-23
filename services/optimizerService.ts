
// Optimizer service — builds an aligned daily-returns matrix for the actual
// holdings from live feed history, runs the pure optimizers, and turns the
// winning weights into an executable whole-unit rebalance plan (buys/sells
// vs current quantities). Null when the feeds can't supply enough history.
// Advisory only: all execution still routes through rebalance -> risk ->
// trade state machine per AGENT_RULES.

import { PortfolioPosition } from '../types';
import { getHoldingPriceSeries, Series } from './portfolioAnalytics';
import {
  annualizedMeanReturns,
  covarianceMatrix,
  minVolatility,
  maxSharpe,
  riskParity,
  OptimizedPortfolio
} from '../domain/optimize/optimizer.engine';
import { discreteAllocation } from '../domain/optimize/discreteAllocation';

export interface RebalanceTrade {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  rate: number;
  amount: number;
}

export interface OptimizedProposal extends OptimizedPortfolio {
  id: 'MIN_VOL' | 'MAX_SHARPE' | 'RISK_PARITY';
  name: string;
  weightBySymbol: Record<string, number>;
  targetQuantities: Record<string, number>;
  trades: RebalanceTrade[]; // deltas vs current holdings, whole units
  leftoverCash: number;
}

export interface OptimizationResult {
  symbols: string[];
  currentWeights: Record<string, number>;
  proposals: OptimizedProposal[];
  windowDays: number;
  maxWeightCap: number;
}

const MAX_WEIGHT_CAP = 0.35; // no single holding above 35% in proposals

const buildFilled = (series: Series, dates: string[]): (number | null)[] => {
  let last: number | null = null;
  return dates.map(d => {
    const v = series.get(d);
    if (v !== undefined) last = v;
    return last;
  });
};

export const optimizePortfolio = async (
  positions: PortfolioPosition[],
  days = 365
): Promise<OptimizationResult | null> => {
  const priced = positions.filter(p => p.assetType === 'STOCK' || p.assetType === 'MF' || p.assetType === 'CRYPTO');
  if (priced.length < 2) return null; // nothing to optimize with one asset

  const seriesList = await Promise.all(priced.map(p => getHoldingPriceSeries(p, days)));
  const usable = priced
    .map((pos, i) => ({ pos, series: seriesList[i] }))
    .filter((x): x is { pos: PortfolioPosition; series: Series } => x.series !== null);
  if (usable.length < 2) return null;

  // Shared date axis starting where every series has begun
  const allDates = [...new Set(usable.flatMap(u => [...u.series.keys()]))].sort();
  const startDate = usable.map(u => [...u.series.keys()].sort()[0]).sort().pop()!;
  const dates = allDates.filter(d => d >= startDate);
  if (dates.length < 60) return null; // too little overlap for a covariance

  const priceRows = usable.map(u => buildFilled(u.series, dates));
  const returns: number[][] = [];
  for (let t = 1; t < dates.length; t++) {
    const row: number[] = [];
    let ok = true;
    for (let j = 0; j < usable.length; j++) {
      const prev = priceRows[j][t - 1];
      const cur = priceRows[j][t];
      if (prev === null || cur === null || prev <= 0) {
        ok = false;
        break;
      }
      row.push(cur / prev - 1);
    }
    if (ok) returns.push(row);
  }
  if (returns.length < 60) return null;

  const means = annualizedMeanReturns(returns);
  const cov = covarianceMatrix(returns);
  const symbols = usable.map(u => u.pos.symbol);
  const totalValue = usable.reduce((s, u) => s + u.pos.currentValue, 0);

  const currentWeights: Record<string, number> = {};
  usable.forEach(u => {
    currentWeights[u.pos.symbol] = parseFloat((u.pos.currentValue / totalValue).toFixed(4));
  });

  const toProposal = (
    id: OptimizedProposal['id'],
    name: string,
    port: OptimizedPortfolio
  ): OptimizedProposal | null => {
    const alloc = discreteAllocation(
      usable.map(u => ({
        symbol: u.pos.symbol,
        price: u.pos.currentPrice,
        isMf: u.pos.assetType === 'MF' || u.pos.assetType === 'CRYPTO'
      })),
      port.weights,
      totalValue
    );
    if (!alloc) return null;

    const trades: RebalanceTrade[] = [];
    usable.forEach(u => {
      const target = alloc.quantities[u.pos.symbol] ?? 0;
      const deltaRaw = target - u.pos.quantity;
      const delta = u.pos.assetType === 'MF' ? parseFloat(deltaRaw.toFixed(2)) : Math.round(deltaRaw);
      if (delta === 0) return;
      trades.push({
        symbol: u.pos.symbol,
        side: delta > 0 ? 'BUY' : 'SELL',
        quantity: Math.abs(delta),
        rate: u.pos.currentPrice,
        amount: parseFloat((Math.abs(delta) * u.pos.currentPrice).toFixed(2))
      });
    });

    const weightBySymbol: Record<string, number> = {};
    symbols.forEach((s, i) => (weightBySymbol[s] = port.weights[i]));

    return {
      ...port,
      id,
      name,
      weightBySymbol,
      targetQuantities: alloc.quantities,
      trades: trades.sort((a, b) => b.amount - a.amount),
      leftoverCash: alloc.leftoverCash
    };
  };

  const proposals = [
    toProposal('MIN_VOL', 'Minimum Volatility', minVolatility(means, cov, MAX_WEIGHT_CAP)),
    toProposal('MAX_SHARPE', 'Maximum Sharpe', maxSharpe(means, cov, MAX_WEIGHT_CAP)),
    toProposal('RISK_PARITY', 'Risk Parity', riskParity(means, cov, MAX_WEIGHT_CAP))
  ].filter((p): p is OptimizedProposal => p !== null);

  if (proposals.length === 0) return null;

  return {
    symbols,
    currentWeights,
    proposals,
    windowDays: days,
    maxWeightCap: MAX_WEIGHT_CAP
  };
};
