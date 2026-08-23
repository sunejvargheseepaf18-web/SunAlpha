
// Central Pivot Range engine (pure domain logic) — the "CPR by KGS" /
// Frank Ochoa (Secrets of a Pivot Boss) construction:
//   Pivot = (H + L + C) / 3
//   BC    = (H + L) / 2
//   TC    = 2 x Pivot - BC        (TC/BC swapped so TC is always the top)
// computed from the PREVIOUS COMPLETED session, plus everything the KGS
// TradingView study adds around it:
//   - Floor pivots R1-R3 / S1-S3 from the same session
//   - Tomorrow's CPR from the latest completed bar (narrow range tomorrow
//     = trending day expected)
//   - Width classification on the pivot-width convention (narrow < 0.5%
//     of pivot, wide > 0.75%)
//   - The two-day value-relationship (higher value, lower value, inside,
//     outside, overlapping) that reads market structure.
//
// Day selection matters: during a live session the last bar is TODAY
// (forming) and today's CPR comes from the bar before it; after the close
// the last bar IS the latest completed session and the next session's CPR
// comes from it directly. `todayIso` is injected so this stays pure.

import { CPRRelationship, CPRWidth } from '../../types';

export interface CprCore {
  pivot: number;
  tc: number; // always >= bc
  bc: number;
}

export interface FloorPivots {
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
}

export interface CprBundle extends CprCore, FloorPivots {
  width: CPRWidth;
  widthPercent: number; // (tc - bc) / pivot x 100
  relationship?: CPRRelationship;
  sourceDate: string; // the completed session the levels come from
  // KGS's "Tomorrow's CPR": next session's range from the latest completed
  // bar. Absent when the latest bar is still forming today (its H/L/C are
  // not final, and levels from an unfinished bar would drift all day).
  tomorrow?: { pivot: number; tc: number; bc: number; width: CPRWidth };
}

export const computeCprCore = (high: number, low: number, close: number): CprCore => {
  const pivot = (high + low + close) / 3;
  const bc = (high + low) / 2;
  const tc = 2 * pivot - bc;
  return { pivot, tc: Math.max(tc, bc), bc: Math.min(tc, bc) };
};

/** Classic floor-trader pivots from the same session's H/L/C. */
export const computeFloorPivots = (high: number, low: number, close: number): FloorPivots => {
  const pivot = (high + low + close) / 3;
  const range = high - low;
  return {
    r1: 2 * pivot - low,
    s1: 2 * pivot - high,
    r2: pivot + range,
    s2: pivot - range,
    r3: high + 2 * (pivot - low),
    s3: low - 2 * (high - pivot)
  };
};

// Pivot-width convention: < 0.5% of pivot = narrow (trending day likely),
// > 0.75% = wide (sideways likely).
const NARROW_PCT = 0.5;
const WIDE_PCT = 0.75;

export const classifyCprWidth = (core: CprCore): { width: CPRWidth; widthPercent: number } => {
  const widthPercent = core.pivot > 0 ? ((core.tc - core.bc) / core.pivot) * 100 : 0;
  const width: CPRWidth =
    widthPercent < NARROW_PCT ? 'NARROW' : widthPercent > WIDE_PCT ? 'WIDE' : 'AVERAGE';
  return { width, widthPercent: parseFloat(widthPercent.toFixed(3)) };
};

/** Ochoa's two-day CPR relationship — how today's value sits vs yesterday's. */
export const determineCprRelationship = (curr: CprCore, prev: CprCore): CPRRelationship => {
  if (curr.bc > prev.tc) return 'HIGHER_VALUE';
  if (curr.tc < prev.bc) return 'LOWER_VALUE';
  if (curr.bc > prev.bc && curr.tc < prev.tc) return 'INSIDE_VALUE';
  if (curr.bc < prev.bc && curr.tc > prev.tc) return 'OUTSIDE_VALUE';
  if (curr.bc > prev.bc && curr.bc < prev.tc) return 'OVERLAPPING_HIGHER';
  if (curr.tc < prev.tc && curr.tc > prev.bc) return 'OVERLAPPING_LOWER';
  return 'UNCHANGED';
};

export interface CprBar {
  date: string; // yyyy-MM-dd (a forming intraday bar carries today's date)
  high: number;
  low: number;
  close: number;
}

/**
 * Full CPR bundle from daily bars.
 * - Last bar dated `todayIso` (a live, forming session): its H/L/C are not
 *   final, so TODAY's CPR comes from the bar before it, the relationship
 *   from the bar before that, and no tomorrow's CPR is offered.
 * - Otherwise (after the close / weekend): the last bar is the latest
 *   completed session — the NEXT session's CPR comes from it directly
 *   (this is where using len-2 unconditionally shows stale levels), and
 *   tomorrow's CPR equals it by definition.
 */
export const computeCprFromBars = (bars: CprBar[], todayIso: string): CprBundle | null => {
  if (bars.length < 3) return null;

  const last = bars[bars.length - 1];
  const lastIsForming = last.date === todayIso;

  const source = lastIsForming ? bars[bars.length - 2] : bars[bars.length - 1];
  const prior = lastIsForming ? bars[bars.length - 3] : bars[bars.length - 2];

  const core = computeCprCore(source.high, source.low, source.close);
  const prev = computeCprCore(prior.high, prior.low, prior.close);
  const { width, widthPercent } = classifyCprWidth(core);

  const bundle: CprBundle = {
    ...core,
    ...computeFloorPivots(source.high, source.low, source.close),
    width,
    widthPercent,
    relationship: determineCprRelationship(core, prev),
    sourceDate: source.date
  };

  if (!lastIsForming) {
    // The latest completed bar IS the base for the next session.
    bundle.tomorrow = { ...core, width };
  }
  return bundle;
};
