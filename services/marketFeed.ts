
// Live equity/index market feed.
//
// Provider research (Aug 2026), Indian-market focus:
// - Yahoo Finance v8 chart API: free, no key, quotes + OHLCV history for
//   NSE ('.NS'), BSE ('.BO') and indices ('^NSEI', '^BSESN'). No browser
//   CORS, so requests go through the Vite dev proxy at /yahoo-api
//   (see vite.config.ts). This is the default provider here.
// - api.mfapi.in: MF NAVs — already integrated in mfNavService.ts.
// - Broker APIs (Upstox: free incl. market data; Zerodha Kite Connect:
//   ₹500/mo with live + 10y historical): the production-grade upgrade path.
//   Implement them as additional providers behind getLiveQuote's interface.
// - Alpha Vantage: CORS-friendly but 25 req/day free — too low for a
//   holdings screen; viable only as a keyed, low-frequency fallback.
//
// Design: try the live provider, cache briefly, and return null on any
// failure — callers keep their previous/mock price. No decision logic here.

import { MarketQuote } from '../types';

// Base URL for the Yahoo feed. In dev this is the Vite proxy path; deploys
// can point it at their own relay via MARKET_FEED_BASE.
const FEED_BASE: string =
  (typeof process !== 'undefined' && (process.env as any)?.MARKET_FEED_BASE) || '/yahoo-api';

const QUOTE_CACHE_TTL_MS = 60 * 1000; // quotes go stale fast; keep it short

// ---------------------------------------------------------------------------
// Symbol mapping (pure, unit-testable)
// ---------------------------------------------------------------------------

// App symbols/index names -> Yahoo tickers. Indian equities default to NSE.
const SYMBOL_OVERRIDES: Record<string, string> = {
  'NIFTY 50': '^NSEI',
  NIFTY: '^NSEI',
  SENSEX: '^BSESN',
  BANKNIFTY: '^NSEBANK',
  NASDAQ: '^IXIC',
  'INDIA VIX': '^INDIAVIX',
  // Crypto pairs quote in INR on Yahoo (CoinGecko is the primary feed)
  BTC: 'BTC-INR',
  ETH: 'ETH-INR',
  SOL: 'SOL-INR',
  // US listings held directly keep their plain ticker
  AAPL: 'AAPL',
  MSFT: 'MSFT',
  GOOGL: 'GOOGL',
  VTI: 'VTI'
};

export const toYahooSymbol = (symbol: string): string => {
  const upper = symbol.trim().toUpperCase();
  if (SYMBOL_OVERRIDES[upper]) return SYMBOL_OVERRIDES[upper];
  if (upper.startsWith('^') || upper.includes('.')) return upper; // already qualified
  return `${upper}.NS`; // NSE default for this app's universe
};

// ---------------------------------------------------------------------------
// Yahoo v8 chart response parsing (pure, unit-testable)
// ---------------------------------------------------------------------------

export interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        currency?: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        regularMarketTime?: number;
      };
      timestamp?: number[];
      events?: {
        dividends?: Record<string, { amount?: number; date?: number }>;
      };
      indicators?: {
        quote?: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
    error?: unknown;
  };
}

export interface LiveQuote extends MarketQuote {
  asOf: string; // ISO timestamp of the price
}

export interface OhlcvBar {
  date: string; // yyyy-MM-dd
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const parseYahooQuote = (symbol: string, res: YahooChartResponse): LiveQuote | null => {
  const meta = res?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  // previousClose is the true prior-session close for regularMarketPrice.
  // chartPreviousClose is only the close before the CHART WINDOW — after
  // hours on a range=1d request that is TWO sessions back, which made day
  // change/% (and day P&L) compute against the wrong session. Fallback only.
  const prevClose = meta?.previousClose ?? meta?.chartPreviousClose;
  if (typeof price !== 'number' || !isFinite(price) || price <= 0) return null;

  const change = typeof prevClose === 'number' && prevClose > 0 ? price - prevClose : 0;
  const changePercent = typeof prevClose === 'number' && prevClose > 0 ? (change / prevClose) * 100 : 0;

  return {
    symbol,
    price: parseFloat(price.toFixed(2)),
    change: parseFloat(change.toFixed(2)),
    changePercent: parseFloat(changePercent.toFixed(2)),
    exchange: meta?.symbol?.endsWith('.NS') ? 'NSE' : meta?.symbol?.endsWith('.BO') ? 'BSE' : 'YF',
    asOf: meta?.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000).toISOString()
      : new Date().toISOString()
  };
};

export const parseYahooHistory = (res: YahooChartResponse): OhlcvBar[] => {
  const result = res?.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  if (!quote || timestamps.length === 0) return [];

  const bars: OhlcvBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    if (open == null || high == null || low == null || close == null) continue; // holiday/partial rows
    bars.push({
      date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: quote.volume?.[i] ?? 0
    });
  }
  return bars;
};

// ---------------------------------------------------------------------------
// Fetching with cache + graceful failure
// ---------------------------------------------------------------------------

const quoteCache = new Map<string, { quote: LiveQuote; ts: number }>();
const HISTORY_CACHE_TTL_MS = 5 * 60 * 1000; // bars change once a day; 5min is generous
const historyCache = new Map<string, { bars: OhlcvBar[]; ts: number }>();

// In-flight request dedup: the holdings screen, advisor, screener and
// analytics often ask for the same symbol in the same tick — one network
// request serves them all instead of N identical ones.
const pendingQuotes = new Map<string, Promise<LiveQuote | null>>();
const pendingHistories = new Map<string, Promise<OhlcvBar[]>>();

const fetchChart = async (
  yahooSymbol: string,
  range: string,
  interval: string,
  events?: string
): Promise<YahooChartResponse> => {
  const eventsParam = events ? `&events=${events}` : '';
  const url = `${FEED_BASE}/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=${range}&interval=${interval}${eventsParam}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`market feed ${res.status} for ${yahooSymbol}`);
  return res.json() as Promise<YahooChartResponse>;
};

/**
 * Latest quote for an app symbol. Null only when there is NO answer at all:
 * a fetch failure falls back to the last-known-good quote (its asOf shows
 * the age) rather than dropping to the caller's static fallback.
 */
export const getLiveQuote = async (symbol: string): Promise<LiveQuote | null> => {
  const cached = quoteCache.get(symbol);
  if (cached && Date.now() - cached.ts < QUOTE_CACHE_TTL_MS) return cached.quote;

  const pending = pendingQuotes.get(symbol);
  if (pending) return pending;

  const request = (async (): Promise<LiveQuote | null> => {
    try {
      const res = await fetchChart(toYahooSymbol(symbol), '1d', '1d');
      const quote = parseYahooQuote(symbol, res);
      if (quote) quoteCache.set(symbol, { quote, ts: Date.now() });
      return quote ?? cached?.quote ?? null;
    } catch {
      return cached?.quote ?? null; // stale beats nothing; asOf carries the age
    } finally {
      pendingQuotes.delete(symbol);
    }
  })();
  pendingQuotes.set(symbol, request);
  return request;
};

/** Daily OHLCV history for an app symbol. Empty array on failure. Cached + deduped. */
export const getLiveHistory = async (symbol: string, days = 90): Promise<OhlcvBar[]> => {
  const range = days <= 30 ? '1mo' : days <= 95 ? '3mo' : days <= 190 ? '6mo' : '1y';
  const key = `${symbol}:${range}`;

  const cached = historyCache.get(key);
  if (cached && Date.now() - cached.ts < HISTORY_CACHE_TTL_MS) return cached.bars.slice(-days);

  const pending = pendingHistories.get(key);
  if (pending) return pending.then(bars => bars.slice(-days));

  const request = (async (): Promise<OhlcvBar[]> => {
    try {
      const res = await fetchChart(toYahooSymbol(symbol), range, '1d');
      const bars = parseYahooHistory(res);
      if (bars.length > 0) historyCache.set(key, { bars, ts: Date.now() });
      return bars;
    } catch {
      return cached?.bars ?? []; // expired-but-present history beats none
    } finally {
      pendingHistories.delete(key);
    }
  })();
  pendingHistories.set(key, request);
  return request.then(bars => bars.slice(-days));
};

// ---------------------------------------------------------------------------
// Intraday bars (5m/15m) — Yahoo serves these on the same chart endpoint
// ---------------------------------------------------------------------------

export interface IntradayBar {
  date: string; // "yyyy-MM-dd HH:mm" (local), for legends
  epoch: number; // unix seconds — the chart's time axis
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Parse a chart response keeping intraday resolution (pure). */
export const parseYahooIntradayBars = (res: YahooChartResponse): IntradayBar[] => {
  const result = res?.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  if (!quote || timestamps.length === 0) return [];

  const bars: IntradayBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    if (open == null || high == null || low == null || close == null) continue; // gaps/partial rows
    const when = new Date(timestamps[i] * 1000);
    const hh = String(when.getHours()).padStart(2, '0');
    const mm = String(when.getMinutes()).padStart(2, '0');
    bars.push({
      date: `${when.toISOString().split('T')[0]} ${hh}:${mm}`,
      epoch: timestamps[i],
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: quote.volume?.[i] ?? 0
    });
  }
  return bars;
};

const INTRADAY_CACHE_TTL_MS = 60 * 1000; // intraday bars actually move
const intradayCache = new Map<string, { bars: IntradayBar[]; ts: number }>();
const pendingIntraday = new Map<string, Promise<IntradayBar[]>>();

/**
 * Intraday OHLCV. '1d' uses 5-minute bars, '5d' 15-minute. Empty on
 * failure (with last-known-good fallback), like the daily feed.
 */
export const getIntradayHistory = async (
  symbol: string,
  range: '1d' | '5d' = '1d'
): Promise<IntradayBar[]> => {
  const interval = range === '1d' ? '5m' : '15m';
  const key = `${symbol}:${range}:${interval}`;

  const cached = intradayCache.get(key);
  if (cached && Date.now() - cached.ts < INTRADAY_CACHE_TTL_MS) return cached.bars;

  const pending = pendingIntraday.get(key);
  if (pending) return pending;

  const request = (async (): Promise<IntradayBar[]> => {
    try {
      const res = await fetchChart(toYahooSymbol(symbol), range, interval);
      const bars = parseYahooIntradayBars(res);
      if (bars.length > 0) intradayCache.set(key, { bars, ts: Date.now() });
      return bars;
    } catch {
      return cached?.bars ?? [];
    } finally {
      pendingIntraday.delete(key);
    }
  })();
  pendingIntraday.set(key, request);
  return request;
};

export interface DividendEvent {
  date: string; // yyyy-MM-dd (ex-date)
  amount: number; // per share
}

/** Parse the events.dividends map of a chart response (pure). */
export const parseYahooDividends = (res: YahooChartResponse): DividendEvent[] => {
  const dividends = res?.chart?.result?.[0]?.events?.dividends;
  if (!dividends) return [];
  return Object.values(dividends)
    .filter(d => typeof d.amount === 'number' && d.amount! > 0 && typeof d.date === 'number')
    .map(d => ({
      date: new Date((d.date as number) * 1000).toISOString().split('T')[0],
      amount: parseFloat((d.amount as number).toFixed(4))
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

/** Dividend events (ex-dates + per-share amounts) for a symbol. Empty on failure. */
export const getDividendHistory = async (symbol: string, days = 365): Promise<DividendEvent[]> => {
  const range = days <= 366 ? '1y' : days <= 731 ? '2y' : '5y';
  try {
    const res = await fetchChart(toYahooSymbol(symbol), range, '1d', 'div');
    return parseYahooDividends(res);
  } catch {
    return [];
  }
};

/** Batch quotes; symbols that fail are simply absent from the map. */
export const getLiveQuotes = async (symbols: string[]): Promise<Map<string, LiveQuote>> => {
  const results = await Promise.all(symbols.map(s => getLiveQuote(s)));
  const map = new Map<string, LiveQuote>();
  symbols.forEach((s, i) => {
    const q = results[i];
    if (q) map.set(s, q);
  });
  return map;
};
