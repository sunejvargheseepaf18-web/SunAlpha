
import { describe, it, expect } from 'vitest';
import { parseFundamentals, parseEsg, QuoteSummaryResponse } from './fundamentalsFeed';
import { FundamentalData } from '../types';

const fallback: FundamentalData = {
  symbol: 'RELIANCE',
  roe: 9,
  roce: 14,
  npm: 7,
  revenueGrowth3Y: 11,
  profitGrowth3Y: 13,
  debtToEquity: 0.7,
  interestCoverage: 6,
  currentRatio: 1.3,
  freeCashFlowConversion: 0.9,
  peHistory: 24,
  currentPe: 26,
  pegRatio: 1.6,
  promoterHolding: 50,
  pledgedShares: 0
};

// Shape documented by Yahoo v10 quoteSummary: every numeric is {raw, fmt}
const fullResponse: QuoteSummaryResponse = {
  quoteSummary: {
    result: [
      {
        financialData: {
          returnOnEquity: { raw: 0.0876 },
          profitMargins: { raw: 0.0801 },
          returnOnAssets: { raw: 0.0412 },
          revenueGrowth: { raw: 0.102 },
          earningsGrowth: { raw: 0.078 },
          debtToEquity: { raw: 41.3 }, // Yahoo percent-style: 0.41x
          currentRatio: { raw: 1.18 }
        },
        defaultKeyStatistics: {
          trailingEps: { raw: 51.4 },
          pegRatio: { raw: 2.1 },
          heldPercentInsiders: { raw: 0.5039 }
        },
        summaryDetail: {
          trailingPE: { raw: 28.4 }
        },
        esgScores: {
          totalEsg: { raw: 24.9 },
          environmentScore: { raw: 8.2 },
          socialScore: { raw: 10.1 },
          governanceScore: { raw: 6.6 },
          highestControversy: 2,
          esgPerformance: 'AVG_PERF'
        }
      }
    ]
  }
};

describe('parseFundamentals', () => {
  it('maps live Yahoo modules onto FundamentalData with unit conversions', () => {
    const data = parseFundamentals('RELIANCE', fullResponse, fallback)!;
    expect(data.symbol).toBe('RELIANCE');
    expect(data.roe).toBeCloseTo(8.76, 2); // decimal -> percent
    expect(data.npm).toBeCloseTo(8.01, 2);
    expect(data.roce).toBeCloseTo(4.12, 2); // ROA proxy
    expect(data.revenueGrowth3Y).toBeCloseTo(10.2, 2);
    expect(data.profitGrowth3Y).toBeCloseTo(7.8, 2);
    expect(data.debtToEquity).toBeCloseTo(0.41, 2); // percent-style / 100
    expect(data.currentRatio).toBeCloseTo(1.18, 2);
    expect(data.currentPe).toBeCloseTo(28.4, 2);
    expect(data.pegRatio).toBeCloseTo(2.1, 2);
    expect(data.promoterHolding).toBeCloseTo(50.39, 2); // insiders decimal -> percent
  });

  it('keeps fallback values for fields Yahoo does not carry', () => {
    const data = parseFundamentals('RELIANCE', fullResponse, fallback)!;
    // No interest coverage / FCF conversion / pledging / PE history in quoteSummary
    expect(data.interestCoverage).toBe(fallback.interestCoverage);
    expect(data.freeCashFlowConversion).toBe(fallback.freeCashFlowConversion);
    expect(data.peHistory).toBe(fallback.peHistory);
    expect(data.pledgedShares).toBe(fallback.pledgedShares);
  });

  it('fills gaps in a partial response from the fallback', () => {
    const partial: QuoteSummaryResponse = {
      quoteSummary: {
        result: [{ financialData: { returnOnEquity: { raw: 0.2 } } }]
      }
    };
    const data = parseFundamentals('X', partial, fallback)!;
    expect(data.roe).toBeCloseTo(20, 2);
    expect(data.npm).toBe(fallback.npm);
    expect(data.debtToEquity).toBe(fallback.debtToEquity);
  });

  it('returns null when the response carries nothing usable', () => {
    expect(parseFundamentals('X', {}, fallback)).toBeNull();
    expect(parseFundamentals('X', { quoteSummary: { result: [] } }, fallback)).toBeNull();
    expect(
      parseFundamentals('X', { quoteSummary: { result: [{ financialData: {} }] } }, fallback)
    ).toBeNull();
  });
});

describe('parseEsg', () => {
  it('extracts Sustainalytics scores and controversy level', () => {
    const esg = parseEsg(fullResponse)!;
    expect(esg.totalEsg).toBeCloseTo(24.9, 2);
    expect(esg.environmentScore).toBeCloseTo(8.2, 2);
    expect(esg.socialScore).toBeCloseTo(10.1, 2);
    expect(esg.governanceScore).toBeCloseTo(6.6, 2);
    expect(esg.controversyLevel).toBe(2);
    expect(esg.performance).toBe('AVG_PERF');
  });

  it('returns null when Yahoo has no ESG coverage for the symbol', () => {
    expect(parseEsg({})).toBeNull();
    expect(parseEsg({ quoteSummary: { result: [{ esgScores: {} }] } })).toBeNull();
  });
});
