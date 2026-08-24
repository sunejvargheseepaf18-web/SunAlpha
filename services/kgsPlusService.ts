
// KGS++ service — assembles the pure day-plan engine's inputs from the
// live pieces the app already computes: CPR levels (technical report),
// market regime, and — for indices — the live OI summary with NSE's
// official totals. Advisory only.

import { CPRLevels, MarketRegime } from '../types';
import { buildKgsPlusPlan, KgsPlusPlan } from '../domain/strategy/kgsPlus.engine';
import { computeOiSummary } from '../domain/derivatives/oiAnalytics.engine';
import { getLiveChainDetail } from './derivativesFeed';

export type { KgsPlusPlan };

const INDEX_SYMBOLS = new Set(['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY']);

export const getKgsPlusPlan = async (
  symbol: string,
  spot: number,
  cpr: CPRLevels | null,
  regime: MarketRegime | undefined
): Promise<KgsPlusPlan | null> => {
  if (!cpr || !regime || spot <= 0) return null;

  // OI lane only where an option chain exists (indices); stocks plan on
  // CPR + regime alone rather than inventing OI.
  let oi = null;
  if (INDEX_SYMBOLS.has(symbol.toUpperCase())) {
    const detail = await getLiveChainDetail(symbol);
    if (detail) oi = computeOiSummary(detail.fullRows, detail.officialTotals);
  }

  return buildKgsPlusPlan({
    spot,
    cpr: {
      pivot: cpr.pivot,
      tc: cpr.tc,
      bc: cpr.bc,
      width: cpr.width,
      relationship: cpr.relationship,
      r1: cpr.r1,
      r2: cpr.r2,
      s1: cpr.s1,
      s2: cpr.s2
    },
    regime: { trend: regime.trend, volatility: regime.volatility },
    oi
  });
};
