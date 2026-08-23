
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
  const prevClose = meta?.chartPreviousClose ?? meta?.previousClose;
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

/** Latest quote for an app symbol. Null on any failure — caller keeps its fallback. */
export const getLiveQuote = async (symbol: string): Promise<LiveQuote | null> => {
  const cached = quoteCache.get(symbol);
  if (cached && Date.now() - cached.ts < QUOTE_CACHE_TTL_MS) return cached.quote;

  try {
    const res = await fetchChart(toYahooSymbol(symbol), '1d', '1d');
    const quote = parseYahooQuote(symbol, res);
    if (quote) quoteCache.set(symbol, { quote, ts: Date.now() });
    return quote;
  } catch {
    return null;
  }
};

/** Daily OHLCV history for an app symbol. Empty array on failure. */
export const getLiveHistory = async (symbol: string, days = 90): Promise<OhlcvBar[]> => {
  const range = days <= 30 ? '1mo' : days <= 95 ? '3mo' : days <= 190 ? '6mo' : '1y';
  try {
    const res = await fetchChart(toYahooSymbol(symbol), range, '1d');
    return parseYahooHistory(res).slice(-days);
  } catch {
    return [];
  }
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
