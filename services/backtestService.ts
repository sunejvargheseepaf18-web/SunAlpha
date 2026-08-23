
// Backtest service — feeds real feed history into the pure backtest engine.
// Equities/indices use OHLCV from the market feed; mutual funds use NAV
// history (NAV-only bars). Null when history is unavailable — the UI simply
// doesn't render a backtest instead of inventing one.

import { runBacktest, BacktestResult, BtBar } from '../domain/backtest/backtest.engine';
import { STRATEGY_CATALOG, StrategyDef } from '../domain/backtest/strategies';
import { getLiveHistory } from './marketFeed';
import { resolveScheme, getNavHistory } from './mfNavService';

export { STRATEGY_CATALOG };
export type { StrategyDef, BacktestResult };

const barsForSymbol = async (symbol: string, days: number, isMf: boolean): Promise<BtBar[]> => {
  if (isMf) {
    const scheme = await resolveScheme(symbol);
    if (!scheme) return [];
    const nav = await getNavHistory(scheme.schemeCode, days);
    if (!nav) return [];
    return nav.history.map(h => ({
      date: h.date,
      open: h.value, // MFs trade at NAV — one price per day
      high: h.value,
      low: h.value,
      close: h.value,
      volume: 0
    }));
  }
  const bars = await getLiveHistory(symbol, days);
  return bars.map(b => ({ ...b }));
};

export const runStrategyBacktest = async (
  symbol: string,
  strategyId: string,
  options: { days?: number; isMf?: boolean } = {}
): Promise<BacktestResult | null> => {
  const def = STRATEGY_CATALOG.find(s => s.id === strategyId);
  if (!def) return null;

  const bars = await barsForSymbol(symbol, options.days ?? 365, options.isMf ?? false);
  if (bars.length < 40) return null; // too little history to say anything

  return runBacktest(bars, def.build());
};
