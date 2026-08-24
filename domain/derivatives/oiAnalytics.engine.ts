
// Open-interest analytics engine (pure domain logic).
//
// The analysis battery of the open NSE chain tools
// (VarunS2002/Python-NSE-Option-Chain-Analyzer, Open-Interest-NSE-Live-
// Analysis): every number here is DERIVED from the chain the user can see,
// never asserted —
// - PCR: total put OI / total call OI (>1 put-heavy = bullish positioning,
//   <0.7 call-heavy = bearish, by the standard reading).
// - OI WALLS: the max-PE-OI strike acts as support, max-CE-OI as
//   resistance — writers defend where they're heaviest.
// - MAX PAIN: the expiry price that minimizes total option-buyer payoff
//   (sum of intrinsic values across the chain), a magnet-level heuristic.
// - BUILDUP: the classic price x OI-change quadrant — long buildup,
//   short buildup, short covering, long unwinding.

import { OptionChainRow } from '../../types';

export type BuildupKind = 'LONG_BUILDUP' | 'SHORT_BUILDUP' | 'SHORT_COVERING' | 'LONG_UNWINDING' | 'NEUTRAL';

/** Classic quadrant: price change x OI change. */
export const classifyBuildup = (priceChange: number, oiChange: number): BuildupKind => {
  if (priceChange === 0 || oiChange === 0) return 'NEUTRAL';
  if (priceChange > 0 && oiChange > 0) return 'LONG_BUILDUP';
  if (priceChange < 0 && oiChange > 0) return 'SHORT_BUILDUP';
  if (priceChange > 0 && oiChange < 0) return 'SHORT_COVERING';
  return 'LONG_UNWINDING';
};

export interface OiSummary {
  totalCallOi: number;
  totalPutOi: number;
  pcr: number; // put OI / call OI
  pcrReading: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  supportStrike: number; // max PE OI
  supportOi: number;
  resistanceStrike: number; // max CE OI
  resistanceOi: number;
  maxPainStrike: number;
  // Net day positioning from OI changes (Analyzer's call-sum vs put-sum idea)
  callOiChangeSum: number;
  putOiChangeSum: number;
  changeReading: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

/**
 * Max pain: the strike at which the summed intrinsic payout to option
 * BUYERS (weighted by OI) is smallest.
 */
export const computeMaxPain = (rows: OptionChainRow[]): number => {
  if (rows.length === 0) return 0;
  let best = rows[0].strike;
  let bestPain = Infinity;
  for (const candidate of rows) {
    const priceAtExpiry = candidate.strike;
    let pain = 0;
    for (const row of rows) {
      pain += Math.max(0, priceAtExpiry - row.strike) * row.ce.oi; // calls pay above strike
      pain += Math.max(0, row.strike - priceAtExpiry) * row.pe.oi; // puts pay below strike
    }
    if (pain < bestPain) {
      bestPain = pain;
      best = candidate.strike;
    }
  }
  return best;
};

/**
 * Derive the whole OI picture from a chain window. Null on an empty chain.
 * `officialTotals` (NSE's own totOI figures, when the payload carries them)
 * override the computed totals so PCR matches the exchange's published
 * number exactly; walls, max pain and ΔOI still come from the rows.
 */
export const computeOiSummary = (
  rows: OptionChainRow[],
  officialTotals?: { ceOi: number; peOi: number }
): OiSummary | null => {
  if (rows.length === 0) return null;

  let totalCallOi = 0;
  let totalPutOi = 0;
  let callOiChangeSum = 0;
  let putOiChangeSum = 0;
  let support = rows[0];
  let resistance = rows[0];

  for (const row of rows) {
    totalCallOi += row.ce.oi;
    totalPutOi += row.pe.oi;
    callOiChangeSum += row.ce.oiChange;
    putOiChangeSum += row.pe.oiChange;
    if (row.pe.oi > support.pe.oi) support = row;
    if (row.ce.oi > resistance.ce.oi) resistance = row;
  }
  // Exchange-published totals win over our own summation.
  if (officialTotals && (officialTotals.ceOi > 0 || officialTotals.peOi > 0)) {
    totalCallOi = officialTotals.ceOi;
    totalPutOi = officialTotals.peOi;
  }
  if (totalCallOi <= 0 && totalPutOi <= 0) return null; // no OI at all — nothing to read

  const pcr = totalCallOi > 0 ? parseFloat((totalPutOi / totalCallOi).toFixed(2)) : 99;
  const pcrReading = pcr > 1 ? 'BULLISH' : pcr < 0.7 ? 'BEARISH' : 'NEUTRAL';

  // Fresh put writing vs fresh call writing today (Analyzer's sum logic):
  // put writers add OI when confident of support -> bullish, and vice versa.
  const netChange = putOiChangeSum - callOiChangeSum;
  const changeScale = Math.max(totalCallOi, totalPutOi) * 0.01; // 1% of book = meaningful
  const changeReading =
    netChange > changeScale ? 'BULLISH' : netChange < -changeScale ? 'BEARISH' : 'NEUTRAL';

  return {
    totalCallOi,
    totalPutOi,
    pcr,
    pcrReading,
    supportStrike: support.strike,
    supportOi: support.pe.oi,
    resistanceStrike: resistance.strike,
    resistanceOi: resistance.ce.oi,
    maxPainStrike: computeMaxPain(rows),
    callOiChangeSum,
    putOiChangeSum,
    changeReading
  };
};

// --- OI-derived scan signals ---------------------------------------------------

export interface OiScanHit {
  type: 'OI_PCR_EXTREME' | 'OI_FRESH_WRITING' | 'OI_MAX_PAIN_MAGNET';
  strength: number; // 0-100
  description: string;
  sentiment: 'BULLISH' | 'BEARISH';
}

const PCR_HIGH = 1.25;
const PCR_LOW = 0.6;
const clampStrength = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Turn an OI summary into scanner-grade signals — the same OI the option
 * chain displays, feeding the screener instead of only a radar card:
 * - OI_PCR_EXTREME: positioning stretched beyond the normal PCR band.
 * - OI_FRESH_WRITING: today's net new writing is a meaningful share of the
 *   book (put writers defending = bullish, call writers capping = bearish).
 * - OI_MAX_PAIN_MAGNET: spot trades ≥1% away from the max-pain strike —
 *   the OI-weighted level expiry tends to gravitate toward.
 */
export const oiScanHits = (summary: OiSummary, spot: number): OiScanHit[] => {
  const hits: OiScanHit[] = [];

  if (summary.pcr >= PCR_HIGH || summary.pcr <= PCR_LOW) {
    const stretched = summary.pcr >= PCR_HIGH ? summary.pcr - PCR_HIGH : PCR_LOW - summary.pcr;
    hits.push({
      type: 'OI_PCR_EXTREME',
      strength: clampStrength(60 + stretched * 80),
      description: `PCR ${summary.pcr} — ${summary.pcr >= PCR_HIGH ? 'put-heavy positioning (support below)' : 'call-heavy positioning (supply above)'}.`,
      sentiment: summary.pcr >= PCR_HIGH ? 'BULLISH' : 'BEARISH'
    });
  }

  const book = Math.max(summary.totalCallOi, summary.totalPutOi);
  const netWriting = summary.putOiChangeSum - summary.callOiChangeSum;
  if (book > 0 && Math.abs(netWriting) >= book * 0.03) {
    hits.push({
      type: 'OI_FRESH_WRITING',
      strength: clampStrength(55 + (Math.abs(netWriting) / book) * 400),
      description: `${netWriting > 0 ? 'Put' : 'Call'} writers added ${formatOi(Math.abs(netWriting))} net OI today (${((Math.abs(netWriting) / book) * 100).toFixed(1)}% of the book).`,
      sentiment: netWriting > 0 ? 'BULLISH' : 'BEARISH'
    });
  }

  if (spot > 0 && summary.maxPainStrike > 0) {
    const gapPct = ((summary.maxPainStrike - spot) / spot) * 100;
    if (Math.abs(gapPct) >= 1) {
      hits.push({
        type: 'OI_MAX_PAIN_MAGNET',
        strength: clampStrength(50 + Math.abs(gapPct) * 10),
        description: `Spot ${spot.toFixed(0)} is ${Math.abs(gapPct).toFixed(1)}% ${gapPct > 0 ? 'below' : 'above'} max pain ${summary.maxPainStrike} — OI-weighted gravity points ${gapPct > 0 ? 'up' : 'down'} into expiry.`,
        sentiment: gapPct > 0 ? 'BULLISH' : 'BEARISH'
      });
    }
  }

  return hits;
};

/** Human-readable lakh/crore contract counts for radar labels. */
export const formatOi = (oi: number): string => {
  if (oi >= 1_00_00_000) return `${(oi / 1_00_00_000).toFixed(1)}Cr`;
  if (oi >= 1_00_000) return `${(oi / 1_00_000).toFixed(1)}L`;
  if (oi >= 1_000) return `${(oi / 1_000).toFixed(1)}K`;
  return String(oi);
};
