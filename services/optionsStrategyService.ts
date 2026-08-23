
// Options strategy service — builds template strategies from the LIVE NSE
// option chain (real premiums, IVs and greeks) and runs the pure strategy
// engine. Null when the chain is unavailable.

import { getLiveOptionChain } from './derivativesFeed';
import { getLiveQuote } from './marketFeed';
import {
  analyzeStrategy,
  buildStrategy,
  ChainStrike,
  OptionLeg,
  StrategyAnalysis,
  StrategyTemplate,
  STRATEGY_TEMPLATES
} from '../domain/options/strategy.engine';

export { STRATEGY_TEMPLATES };
export type { StrategyAnalysis, StrategyTemplate, OptionLeg };

const LOT_SIZES: Record<string, number> = { NIFTY: 75, BANKNIFTY: 35, FINNIFTY: 65 };

export interface BuiltStrategy {
  template: StrategyTemplate;
  legs: OptionLeg[];
  analysis: StrategyAnalysis;
  spot: number;
  lotSize: number;
}

export const buildLiveStrategy = async (
  symbol: string,
  templateId: StrategyTemplate['id']
): Promise<BuiltStrategy | null> => {
  const upper = symbol.toUpperCase();
  const [chain, quote] = await Promise.all([getLiveOptionChain(upper), getLiveQuote(upper)]);
  if (!chain || chain.length < 5) return null;

  // Spot: live quote when available, else infer from the chain's ATM strike.
  const spot = quote?.price ?? chain[Math.floor(chain.length / 2)].strike;

  const strikes: ChainStrike[] = chain.map(row => ({
    strike: row.strike,
    cePremium: row.ce.price,
    pePremium: row.pe.price,
    ceGreeks: row.ce.greeks,
    peGreeks: row.pe.greeks
  }));

  const legs = buildStrategy(templateId, strikes, spot);
  if (!legs) return null;

  const lotSize = LOT_SIZES[upper] ?? 1;
  const atm = chain.reduce((best, row) =>
    Math.abs(row.strike - spot) < Math.abs(best.strike - spot) ? row : best
  );
  const analysis = analyzeStrategy(legs, {
    spot,
    lotSize,
    ivPct: (atm.ce.iv + atm.pe.iv) / 2,
    daysToExpiry: 7 // nearest weekly expiry approximation
  });
  if (!analysis) return null;

  const template = STRATEGY_TEMPLATES.find(t => t.id === templateId)!;
  return { template, legs, analysis, spot, lotSize };
};
