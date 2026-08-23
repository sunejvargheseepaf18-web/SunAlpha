
// Live derivatives (F&O) feed.
//
// Research (Aug 2026): the only free source of full Indian option chains
// (OI, IV, volume per strike) is NSE's own JSON endpoint — the same one
// behind nsepython, Python-NSE-Option-Chain-Analyzer and stock-nse-india:
//   GET https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY
// It requires browser-like headers and a cookie session, and has no CORS,
// so requests go through the Vite dev proxy at /nse-api (vite.config.ts),
// with a one-time priming request to establish cookies. Yahoo carries no
// NSE options. Production path: broker APIs (Upstox free, Kite Connect,
// Angel One SmartAPI) behind this same interface.
//
// NSE provides IV but NOT greeks — those are computed here with
// Black-Scholes from NSE's own implied volatility (pure, unit-tested).

import { Greeks, OptionChainRow, OptionContract } from '../types';

const NSE_BASE: string =
  (typeof process !== 'undefined' && (process.env as any)?.NSE_FEED_BASE) || '/nse-api';

const CHAIN_CACHE_TTL_MS = 3 * 60 * 1000; // NSE updates the chain every ~3 min
const RISK_FREE_RATE = 0.065; // approx. 91-day T-bill yield; only affects greeks mildly

// ---------------------------------------------------------------------------
// Black-Scholes greeks from implied volatility (pure, unit-testable)
// ---------------------------------------------------------------------------

// Standard normal PDF
const phi = (x: number): number => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);

// Standard normal CDF (Abramowitz & Stegun 7.1.26, ~1e-7 accurate)
export const normCdf = (x: number): number => {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const poly =
    t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const nd = 1 - phi(Math.abs(x)) * poly;
  return x >= 0 ? nd : 1 - nd;
};

/**
 * Black-Scholes greeks. ivPct is implied volatility in percent (NSE units),
 * daysToExpiry in calendar days. Theta is per-day; vega per 1% IV move.
 */
export const computeGreeks = (
  spot: number,
  strike: number,
  ivPct: number,
  daysToExpiry: number,
  type: 'CE' | 'PE',
  r: number = RISK_FREE_RATE
): Greeks => {
  const sigma = ivPct / 100;
  const T = Math.max(daysToExpiry, 0.5) / 365; // floor at half a day to avoid expiry singularities
  if (spot <= 0 || strike <= 0 || sigma <= 0) {
    return { delta: 0, gamma: 0, theta: 0, vega: 0 };
  }

  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(spot / strike) + (r + (sigma * sigma) / 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const discount = Math.exp(-r * T);

  const delta = type === 'CE' ? normCdf(d1) : normCdf(d1) - 1;
  const gamma = phi(d1) / (spot * sigma * sqrtT);
  const thetaAnnual =
    type === 'CE'
      ? -(spot * phi(d1) * sigma) / (2 * sqrtT) - r * strike * discount * normCdf(d2)
      : -(spot * phi(d1) * sigma) / (2 * sqrtT) + r * strike * discount * normCdf(-d2);
  const vega = (spot * phi(d1) * sqrtT) / 100;

  return {
    delta: parseFloat(delta.toFixed(4)),
    gamma: parseFloat(gamma.toFixed(6)),
    theta: parseFloat((thetaAnnual / 365).toFixed(2)),
    vega: parseFloat(vega.toFixed(2))
  };
};

// ---------------------------------------------------------------------------
// NSE option-chain payload parsing (pure, unit-testable)
// ---------------------------------------------------------------------------

interface NseOptionSide {
  strikePrice?: number;
  expiryDate?: string;
  openInterest?: number;
  changeinOpenInterest?: number;
  totalTradedVolume?: number;
  impliedVolatility?: number;
  lastPrice?: number;
  change?: number;
}

export interface NseOptionChainResponse {
  records?: {
    expiryDates?: string[];
    underlyingValue?: number;
    timestamp?: string; // e.g. "22-Aug-2026 15:30:00" — NSE's own data time
    data?: Array<{
      strikePrice?: number;
      expiryDate?: string;
      CE?: NseOptionSide;
      PE?: NseOptionSide;
    }>;
  };
}

const daysUntil = (nseDate: string, now: Date): number => {
  // NSE dates look like "28-Aug-2026"
  const parsed = new Date(nseDate);
  if (isNaN(parsed.getTime())) return 7; // conservative default
  return Math.max(0.5, (parsed.getTime() - now.getTime()) / 86400000);
};

const toContract = (
  side: NseOptionSide,
  strike: number,
  type: 'CE' | 'PE',
  spot: number,
  daysToExpiry: number
): OptionContract => {
  const iv = side.impliedVolatility && side.impliedVolatility > 0 ? side.impliedVolatility : 15;
  return {
    strike,
    type,
    price: side.lastPrice ?? 0,
    change: side.change ?? 0,
    oi: side.openInterest ?? 0,
    oiChange: side.changeinOpenInterest ?? 0,
    volume: side.totalTradedVolume ?? 0,
    iv,
    greeks: computeGreeks(spot, strike, iv, daysToExpiry, type)
  };
};

/**
 * Parse NSE's option-chain payload into rows for the nearest expiry,
 * centered on the ATM strike (strikesEachSide in/out of the money).
 * `now` is injected for determinism in tests.
 */
export const parseNseOptionChain = (
  res: NseOptionChainResponse,
  strikesEachSide = 5,
  now: Date = new Date()
): { rows: OptionChainRow[]; spot: number; expiry: string; asOf: string } | null => {
  const records = res?.records;
  const spot = records?.underlyingValue;
  const expiry = records?.expiryDates?.[0];
  const data = records?.data;
  if (!spot || spot <= 0 || !expiry || !data?.length) return null;

  const dte = daysUntil(expiry, now);
  const rows: OptionChainRow[] = [];
  for (const item of data) {
    if (item.expiryDate !== expiry || !item.strikePrice) continue;
    if (!item.CE || !item.PE) continue; // need both sides for a chain row
    rows.push({
      strike: item.strikePrice,
      ce: toContract(item.CE, item.strikePrice, 'CE', spot, dte),
      pe: toContract(item.PE, item.strikePrice, 'PE', spot, dte)
    });
  }
  if (rows.length === 0) return null;

  rows.sort((a, b) => a.strike - b.strike);
  // Center the window on the ATM strike
  let atmIdx = 0;
  for (let i = 1; i < rows.length; i++) {
    if (Math.abs(rows[i].strike - spot) < Math.abs(rows[atmIdx].strike - spot)) atmIdx = i;
  }
  const start = Math.max(0, atmIdx - strikesEachSide);

  // NSE stamps its own data time on the payload; surface it so consumers
  // can show "OI as of 15:30" instead of implying live data after hours.
  const stamped = records?.timestamp ? new Date(records.timestamp) : null;
  const asOf = stamped && !isNaN(stamped.getTime()) ? stamped.toISOString() : now.toISOString();

  return { rows: rows.slice(start, start + strikesEachSide * 2 + 1), spot, expiry, asOf };
};

// ---------------------------------------------------------------------------
// Fetching with cookie priming, cache and graceful failure
// ---------------------------------------------------------------------------

export interface LiveChainDetail {
  rows: OptionChainRow[];
  spot: number;
  expiry: string;
  asOf: string; // NSE's own data timestamp — show it, don't imply "live"
}

const chainCache = new Map<string, { detail: LiveChainDetail; ts: number }>();
let primed = false;

const INDEX_SYMBOLS = new Set(['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'NIFTYNXT50']);

const prime = async (): Promise<void> => {
  // Establish NSE's session cookies via the proxy (homepage + option-chain
  // page, the Python-NSE-Option-Chain-Analyzer session recipe).
  await fetch(`${NSE_BASE}/`, { headers: { Accept: 'text/html' } }).catch(() => {});
  await fetch(`${NSE_BASE}/option-chain`, { headers: { Accept: 'text/html' } }).catch(() => {});
  primed = true;
};

/**
 * Full chain detail (rows + spot + expiry + NSE's data timestamp) for an
 * index or stock. One re-prime + retry on 401/403 (expired cookies), never
 * more — NSE rate-limits aggressively and hammering earns a CAPTCHA wall.
 * Null on failure — callers fall back to their simulated chain.
 */
export const getLiveChainDetail = async (symbol: string): Promise<LiveChainDetail | null> => {
  const upper = symbol.toUpperCase();
  const cached = chainCache.get(upper);
  if (cached && Date.now() - cached.ts < CHAIN_CACHE_TTL_MS) return cached.detail;

  try {
    if (!primed) await prime();

    const endpoint = INDEX_SYMBOLS.has(upper)
      ? `${NSE_BASE}/api/option-chain-indices?symbol=${encodeURIComponent(upper)}`
      : `${NSE_BASE}/api/option-chain-equities?symbol=${encodeURIComponent(upper)}`;

    let res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    if (res.status === 401 || res.status === 403) {
      // Cookie session expired — re-prime once and retry once.
      await prime();
      res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    }
    if (!res.ok) throw new Error(`NSE chain ${res.status} for ${upper}`);

    const parsed = parseNseOptionChain((await res.json()) as NseOptionChainResponse);
    if (!parsed) return null;

    chainCache.set(upper, { detail: parsed, ts: Date.now() });
    return parsed;
  } catch {
    return cached?.detail ?? null; // expired-but-real beats nothing
  }
};

/** Rows-only view of getLiveChainDetail (existing callers). */
export const getLiveOptionChain = async (symbol: string): Promise<OptionChainRow[] | null> => {
  const detail = await getLiveChainDetail(symbol);
  return detail?.rows ?? null;
};
