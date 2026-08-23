
// Crypto price feed — CoinGecko free API (keyless, CORS-enabled — the one
// feed that needs no proxy) quoting INR natively with 24h change, with the
// Yahoo '-INR' tickers as fallback via the existing market feed. Null on
// failure; callers keep fallback prices.

import { getLiveQuote, LiveQuote } from './marketFeed';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const CACHE_TTL_MS = 60 * 1000;

// App symbols -> CoinGecko ids (pure, exported for tests)
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  MATIC: 'matic-network'
};

export const toCoinGeckoId = (symbol: string): string | null =>
  COINGECKO_IDS[symbol.trim().toUpperCase()] ?? null;

export interface CoinGeckoPriceResponse {
  [id: string]: { inr?: number; inr_24h_change?: number };
}

/** Parse a simple/price response into per-symbol quotes (pure). */
export const parseCoinGeckoPrices = (
  symbols: string[],
  res: CoinGeckoPriceResponse
): Map<string, LiveQuote> => {
  const map = new Map<string, LiveQuote>();
  for (const symbol of symbols) {
    const id = toCoinGeckoId(symbol);
    if (!id) continue;
    const row = res[id];
    const price = row?.inr;
    if (typeof price !== 'number' || !isFinite(price) || price <= 0) continue;
    const changePercent = typeof row?.inr_24h_change === 'number' ? row.inr_24h_change : 0;
    map.set(symbol, {
      symbol,
      price: parseFloat(price.toFixed(2)),
      change: parseFloat(((price * changePercent) / (100 + changePercent)).toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      exchange: 'CRYPTO',
      asOf: new Date().toISOString()
    });
  }
  return map;
};

const cache = new Map<string, { quote: LiveQuote; ts: number }>();

/** Batch crypto quotes in INR. Missing symbols fall back to Yahoo '-INR'. */
export const getCryptoQuotes = async (symbols: string[]): Promise<Map<string, LiveQuote>> => {
  const result = new Map<string, LiveQuote>();
  const stale: string[] = [];
  for (const s of symbols) {
    const hit = cache.get(s);
    if (hit && Date.now() - hit.ts < CACHE_TTL_MS) result.set(s, hit.quote);
    else stale.push(s);
  }
  if (stale.length === 0) return result;

  // Primary: CoinGecko (one call for all ids)
  try {
    const ids = stale.map(toCoinGeckoId).filter(Boolean).join(',');
    if (ids) {
      const res = await fetch(
        `${COINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=inr&include_24hr_change=true`,
        { headers: { Accept: 'application/json' } }
      );
      if (res.ok) {
        const parsed = parseCoinGeckoPrices(stale, (await res.json()) as CoinGeckoPriceResponse);
        for (const [symbol, quote] of parsed) {
          cache.set(symbol, { quote, ts: Date.now() });
          result.set(symbol, quote);
        }
      }
    }
  } catch {
    // fall through to Yahoo per-symbol
  }

  // Fallback: Yahoo '-INR' tickers (mapped in marketFeed SYMBOL_OVERRIDES)
  const missing = stale.filter(s => !result.has(s));
  if (missing.length > 0) {
    const yahooQuotes = await Promise.all(missing.map(s => getLiveQuote(s)));
    missing.forEach((s, i) => {
      const q = yahooQuotes[i];
      if (q) {
        cache.set(s, { quote: q, ts: Date.now() });
        result.set(s, q);
      }
    });
  }
  return result;
};
