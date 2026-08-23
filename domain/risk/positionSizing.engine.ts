
// Position sizing (pure domain logic) — the freqtrade-edge / professional
// pattern: risk a fixed fraction of capital per trade, with the stop placed
// a volatility-scaled distance away (ATR multiple), so size shrinks when the
// instrument is wild and grows when it is quiet. Never sizes by "feel".

import { BtBar } from '../backtest/backtest.engine';

/** Wilder's Average True Range over bars[0..index]. Null until enough bars. */
export const atr = (bars: BtBar[], period = 14, index = bars.length - 1): number | null => {
  if (index < period) return null;
  const trueRange = (i: number): number => {
    const high = bars[i].high;
    const low = bars[i].low;
    const prevClose = bars[i - 1].close;
    return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
  };
  let value = 0;
  for (let i = 1; i <= period; i++) value += trueRange(i);
  value /= period;
  for (let i = period + 1; i <= index; i++) {
    value = (value * (period - 1) + trueRange(i)) / period;
  }
  return value;
};

export interface SizingInput {
  capital: number; // account/portfolio value the risk budget is drawn from
  entryPrice: number;
  stopDistance: number; // absolute price distance to the stop (e.g. 2 x ATR)
  riskPerTradePct?: number; // % of capital lost if the stop is hit; default 1
  maxPositionPct?: number; // cap on position value as % of capital; default 20
  isMf?: boolean; // MF units to 2dp; stocks whole shares
}

export interface SizingResult {
  quantity: number;
  stopPrice: number; // entry - stopDistance (long-only)
  riskAmount: number; // what is actually lost at the stop with this quantity
  positionValue: number;
  cappedBy: 'RISK' | 'MAX_POSITION' | null; // which constraint bound the size
}

export const sizePosition = (input: SizingInput): SizingResult | null => {
  const {
    capital,
    entryPrice,
    stopDistance,
    riskPerTradePct = 1,
    maxPositionPct = 20,
    isMf = false
  } = input;
  if (capital <= 0 || entryPrice <= 0 || stopDistance <= 0) return null;

  const riskBudget = (riskPerTradePct / 100) * capital;
  const byRisk = riskBudget / stopDistance;
  const byExposure = ((maxPositionPct / 100) * capital) / entryPrice;

  const raw = Math.min(byRisk, byExposure);
  const quantity = isMf ? Math.floor(raw * 100) / 100 : Math.floor(raw);
  if (quantity <= 0) return null;

  return {
    quantity,
    stopPrice: parseFloat((entryPrice - stopDistance).toFixed(2)),
    riskAmount: parseFloat((quantity * stopDistance).toFixed(2)),
    positionValue: parseFloat((quantity * entryPrice).toFixed(2)),
    cappedBy: raw === byExposure && byExposure < byRisk ? 'MAX_POSITION' : raw === byRisk && byRisk <= byExposure ? 'RISK' : null
  };
};

/** Convenience: ATR-based sizing from price history (2 x ATR stop default). */
export const sizePositionFromBars = (
  bars: BtBar[],
  capital: number,
  options: { atrPeriod?: number; atrMultiple?: number; riskPerTradePct?: number; maxPositionPct?: number } = {}
): SizingResult | null => {
  if (bars.length === 0) return null;
  const distance = atr(bars, options.atrPeriod ?? 14);
  if (distance === null || distance <= 0) return null;
  return sizePosition({
    capital,
    entryPrice: bars[bars.length - 1].close,
    stopDistance: distance * (options.atrMultiple ?? 2),
    riskPerTradePct: options.riskPerTradePct,
    maxPositionPct: options.maxPositionPct
  });
};
