
// Fundamentals & ESG feed — Yahoo quoteSummary modules via the existing
// /yahoo-api proxy: financialData + defaultKeyStatistics (real ROE, margins,
// leverage, growth, valuation) and esgScores (Sustainalytics ESG risk).
// Honest caveat: Yahoo sometimes gates quoteSummary behind crumb auth; every
// caller keeps its simulated fallback, so a 401 degrades, never breaks.

import { FundamentalData, EsgScores } from '../types';
import { toYahooSymbol } from './marketFeed';

const FEED_BASE: string =
  (typeof process !== 'undefined' && (process.env as any)?.MARKET_FEED_BASE) || '/yahoo-api';

// --- Response shapes (the slices we read) -----------------------------------

interface RawValue {
  raw?: number;
}

export interface QuoteSummaryResponse {
  quoteSummary?: {
    result?: Array<{
      financialData?: {
        returnOnEquity?: RawValue;
        profitMargins?: RawValue;
        revenueGrowth?: RawValue;
        earningsGrowth?: RawValue;
        debtToEquity?: RawValue; // Yahoo reports this as a percent-like number
        currentRatio?: RawValue;
        returnOnAssets?: RawValue;
      };
      defaultKeyStatistics?: {
        trailingEps?: RawValue;
        forwardPE?: RawValue;
        pegRatio?: RawValue;
        heldPercentInsiders?: RawValue;
      };
      summaryDetail?: {
        trailingPE?: RawValue;
      };
      esgScores?: {
        totalEsg?: RawValue;
        environmentScore?: RawValue;
        socialScore?: RawValue;
        governanceScore?: RawValue;
        highestControversy?: number;
        esgPerformance?: string;
      };
    }>;
  };
}

export type { EsgScores };

// --- Pure parsers (exported for tests) ---------------------------------------

const pct = (v?: RawValue): number | null =>
  typeof v?.raw === 'number' && isFinite(v.raw) ? parseFloat((v.raw * 100).toFixed(2)) : null;
const num = (v?: RawValue): number | null =>
  typeof v?.raw === 'number' && isFinite(v.raw) ? parseFloat(v.raw.toFixed(2)) : null;

/**
 * Map quoteSummary modules onto FundamentalData. Fields Yahoo doesn't carry
 * keep the provided fallbacks — a partial truth beats a full fiction.
 */
export const parseFundamentals = (
  symbol: string,
  res: QuoteSummaryResponse,
  fallback: FundamentalData
): FundamentalData | null => {
  const result = res?.quoteSummary?.result?.[0];
  const fin = result?.financialData;
  const stats = result?.defaultKeyStatistics;
  if (!fin && !stats) return null;

  const roe = pct(fin?.returnOnEquity);
  if (roe === null && num(stats?.pegRatio) === null) return null; // nothing usable

  // Yahoo's debtToEquity is total-debt / equity x 100 (e.g. 41.3 = 0.41x)
  const rawDe = num(fin?.debtToEquity);

  return {
    ...fallback,
    symbol,
    roe: roe ?? fallback.roe,
    npm: pct(fin?.profitMargins) ?? fallback.npm,
    roce: pct(fin?.returnOnAssets) ?? fallback.roce, // ROA as the closest live proxy
    revenueGrowth3Y: pct(fin?.revenueGrowth) ?? fallback.revenueGrowth3Y, // trailing YoY
    profitGrowth3Y: pct(fin?.earningsGrowth) ?? fallback.profitGrowth3Y,
    debtToEquity: rawDe !== null ? parseFloat((rawDe / 100).toFixed(2)) : fallback.debtToEquity,
    currentRatio: num(fin?.currentRatio) ?? fallback.currentRatio,
    currentPe: num(result?.summaryDetail?.trailingPE) ?? fallback.currentPe,
    pegRatio: num(stats?.pegRatio) ?? fallback.pegRatio,
    promoterHolding: pct(stats?.heldPercentInsiders) ?? fallback.promoterHolding
  };
};

export const parseEsg = (res: QuoteSummaryResponse): EsgScores | null => {
  const esg = res?.quoteSummary?.result?.[0]?.esgScores;
  const total = num(esg?.totalEsg);
  if (total === null) return null;
  return {
    totalEsg: total,
    environmentScore: num(esg?.environmentScore) ?? 0,
    socialScore: num(esg?.socialScore) ?? 0,
    governanceScore: num(esg?.governanceScore) ?? 0,
    controversyLevel: typeof esg?.highestControversy === 'number' ? esg.highestControversy : 0,
    performance: esg?.esgPerformance
  };
};

// --- Fetching ----------------------------------------------------------------

const fetchQuoteSummary = async (symbol: string, modules: string): Promise<QuoteSummaryResponse | null> => {
  try {
    const yahooSymbol = encodeURIComponent(toYahooSymbol(symbol));
    const res = await fetch(
      `${FEED_BASE}/v10/finance/quoteSummary/${yahooSymbol}?modules=${modules}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return null;
    return (await res.json()) as QuoteSummaryResponse;
  } catch {
    return null;
  }
};

export const getLiveFundamentals = async (
  symbol: string,
  fallback: FundamentalData
): Promise<FundamentalData | null> => {
  const res = await fetchQuoteSummary(symbol, 'financialData,defaultKeyStatistics,summaryDetail');
  return res ? parseFundamentals(symbol, res, fallback) : null;
};

export const getEsgScores = async (symbol: string): Promise<EsgScores | null> => {
  const res = await fetchQuoteSummary(symbol, 'esgScores');
  return res ? parseEsg(res) : null;
};
