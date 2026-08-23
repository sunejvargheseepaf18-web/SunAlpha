
import { describe, it, expect } from 'vitest';
import {
  toYahooSymbol,
  parseYahooQuote,
  parseYahooHistory,
  parseYahooIntradayBars,
  parseYahooDividends,
  YahooChartResponse
} from './marketFeed';

describe('toYahooSymbol', () => {
  it('maps NSE equities to .NS by default', () => {
    expect(toYahooSymbol('RELIANCE')).toBe('RELIANCE.NS');
    expect(toYahooSymbol('M&M')).toBe('M&M.NS');
  });

  it('maps known indices to their Yahoo tickers', () => {
    expect(toYahooSymbol('NIFTY 50')).toBe('^NSEI');
    expect(toYahooSymbol('SENSEX')).toBe('^BSESN');
  });

  it('leaves already-qualified and US symbols untouched', () => {
    expect(toYahooSymbol('TATASTEEL.BO')).toBe('TATASTEEL.BO');
    expect(toYahooSymbol('^NSEBANK')).toBe('^NSEBANK');
    expect(toYahooSymbol('AAPL')).toBe('AAPL');
  });
});

const chartResponse = (over?: Partial<NonNullable<YahooChartResponse['chart']>['result']>): YahooChartResponse => ({
  chart: {
    result: [
      {
        meta: {
          symbol: 'RELIANCE.NS',
          currency: 'INR',
          regularMarketPrice: 1318.39,
          chartPreviousClose: 1310.1,
          regularMarketTime: 1755763200
        },
        timestamp: [1755590400, 1755676800, 1755763200],
        indicators: {
          quote: [
            {
              open: [1305.0, 1312.5, null],
              high: [1315.2, 1320.0, null],
              low: [1301.1, 1308.0, null],
              close: [1310.1, 1318.39, null],
              volume: [1250000, 1410000, null]
            }
          ]
        }
      }
    ],
    error: null
  }
});

describe('parseYahooQuote', () => {
  it('extracts price and computes change vs previous close', () => {
    const q = parseYahooQuote('RELIANCE', chartResponse())!;
    expect(q.price).toBeCloseTo(1318.39, 2);
    expect(q.change).toBeCloseTo(8.29, 2);
    expect(q.changePercent).toBeCloseTo((8.29 / 1310.1) * 100, 1);
    expect(q.exchange).toBe('NSE');
    expect(q.asOf).toBe(new Date(1755763200 * 1000).toISOString());
  });

  it('returns null on empty/invalid payloads instead of a fake quote', () => {
    expect(parseYahooQuote('X', {} as YahooChartResponse)).toBeNull();
    expect(
      parseYahooQuote('X', { chart: { result: [{ meta: { regularMarketPrice: 0 } }] } })
    ).toBeNull();
  });
});

describe('parseYahooDividends', () => {
  it('extracts, sorts and sanitizes dividend events', () => {
    const res: YahooChartResponse = {
      chart: {
        result: [
          {
            events: {
              dividends: {
                '1755763200': { amount: 10, date: 1755763200 },
                '1745000000': { amount: 5.5, date: 1745000000 },
                bad: { amount: 0, date: 1745000001 } // zero amount — dropped
              }
            }
          }
        ]
      }
    };
    const events = parseYahooDividends(res);
    expect(events).toHaveLength(2);
    expect(events[0].amount).toBe(5.5); // sorted ascending by date
    expect(events[1].date).toBe(new Date(1755763200 * 1000).toISOString().split('T')[0]);
  });

  it('returns empty for responses without events', () => {
    expect(parseYahooDividends({} as YahooChartResponse)).toHaveLength(0);
  });
});

describe('parseYahooHistory', () => {
  it('zips timestamps with OHLCV and drops null holiday rows', () => {
    const bars = parseYahooHistory(chartResponse());
    expect(bars).toHaveLength(2); // third row is all nulls
    expect(bars[1].close).toBeCloseTo(1318.39, 2);
    expect(bars[0].date < bars[1].date).toBe(true);
    expect(bars[0].volume).toBe(1250000);
  });

  it('returns an empty array for malformed payloads', () => {
    expect(parseYahooHistory({} as YahooChartResponse)).toHaveLength(0);
  });
});

describe('parseYahooIntradayBars', () => {
  it('keeps intraday resolution: unique epochs, minute-level dates', () => {
    // Three 5-minute bars: 09:15, 09:20, 09:25 IST on 2026-08-21
    const t0 = 1787543100; // arbitrary epoch anchor
    const res: YahooChartResponse = {
      chart: {
        result: [
          {
            timestamp: [t0, t0 + 300, t0 + 600],
            indicators: {
              quote: [
                {
                  open: [100, 100.5, null], // third row incomplete — dropped
                  high: [100.6, 101, 101.2],
                  low: [99.8, 100.2, 100.6],
                  close: [100.5, 100.9, 101.1],
                  volume: [12000, 9000, 7000]
                }
              ]
            }
          }
        ]
      }
    };
    const bars = parseYahooIntradayBars(res);
    expect(bars).toHaveLength(2);
    expect(bars[0].epoch).toBe(t0);
    expect(bars[1].epoch).toBe(t0 + 300);
    expect(bars[1].epoch - bars[0].epoch).toBe(300); // 5-minute spacing survives
    expect(bars[0].date).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/); // minute-level label
    expect(bars[0].close).toBeCloseTo(100.5, 2);
    expect(bars[0].volume).toBe(12000);
  });

  it('returns an empty array for malformed payloads', () => {
    expect(parseYahooIntradayBars({} as YahooChartResponse)).toHaveLength(0);
  });
});
