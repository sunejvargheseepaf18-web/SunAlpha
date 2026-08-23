
// Social / copy trading service — strategy leaderboard + copy planning.
//
// This app has no social network of human traders, so "leaders" are the
// built-in algorithmic strategies with REAL track records: each leader is
// one strategy on one instrument, backtested on live-first price history
// (next-open fills, costs charged). No invented star traders, no fabricated
// returns — offline, the leaderboard is simply empty.
//
// Copying is ADVISORY (AGENT_RULES): planCopy emits exact orders (quantity,
// rate, amount) the user can take to the paper/live execution flow; nothing
// here executes anything.

import { runBacktest, BtBar, BacktestResult } from '../domain/backtest/backtest.engine';
import { STRATEGY_CATALOG, StrategyDef, buyAndHold } from '../domain/backtest/strategies';
import {
  LeaderTrackRecord,
  LeaderboardEntry,
  CopyOrder,
  rankLeaders,
  mapCopyTrade,
  evaluateCopyStopLoss,
  CopyStopLossReading
} from '../domain/social/copy.engine';
import { getLiveHistory } from './marketFeed';

export type { LeaderboardEntry, CopyOrder, CopyStopLossReading };
export { evaluateCopyStopLoss };

// Instruments the strategy leaders trade: the portfolio's stocks plus the
// index ETF used as the diversified default elsewhere in the app.
const LEADER_UNIVERSE = ['RELIANCE', 'M&M', 'NIFTYBEES'];
const HISTORY_DAYS = 365;
export const DEFAULT_COPY_STOP_LOSS_PCT = 15; // eToro-style CSL default

interface LeaderRun {
  def: StrategyDef;
  symbol: string;
  bars: BtBar[];
  result: BacktestResult;
}

const LEADER_DEFS: StrategyDef[] = [
  ...STRATEGY_CATALOG,
  {
    id: 'buy-hold',
    name: 'Buy & Hold',
    description: 'Always invested — the cost-aware baseline every leader must beat.',
    build: buyAndHold
  }
];

const leaderId = (defId: string, symbol: string): string => `${defId}@${symbol}`;

const runLeaders = async (): Promise<LeaderRun[]> => {
  const histories = await Promise.all(
    LEADER_UNIVERSE.map(async symbol => ({ symbol, bars: await getLiveHistory(symbol, HISTORY_DAYS) }))
  );

  const runs: LeaderRun[] = [];
  for (const { symbol, bars } of histories) {
    if (bars.length < 40) continue; // feed offline or thin history — skip honestly
    for (const def of LEADER_DEFS) {
      const result = runBacktest(bars, def.build());
      if (result) runs.push({ def, symbol, bars, result });
    }
  }
  return runs;
};

const toTrackRecord = (run: LeaderRun): LeaderTrackRecord => ({
  id: leaderId(run.def.id, run.symbol),
  name: `${run.def.name} — ${run.symbol}`,
  description: run.def.description,
  symbol: run.symbol,
  equityCurve: run.result.equityCurve,
  stats: {
    totalReturnPct: run.result.stats.totalReturnPct,
    maxDrawdownPct: run.result.stats.maxDrawdownPct,
    winRatePct: run.result.stats.winRatePct,
    profitFactor: run.result.stats.profitFactor,
    tradesCount: run.result.stats.tradesCount,
    exposurePct: run.result.stats.exposurePct
  }
});

/**
 * Rank every (strategy x instrument) leader by its real backtested track
 * record. Empty when no price history is reachable.
 */
export const getStrategyLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  const runs = await runLeaders();
  return rankLeaders(runs.map(toTrackRecord));
};

export interface CopyPlan {
  leader: LeaderboardEntry;
  /** What the leader's strategy holds right now. */
  stance: 'INVESTED' | 'IN_CASH';
  orders: CopyOrder[];
  copyStopLossPct: number;
  note: string;
}

/**
 * Plan copying a leader with `allocation` rupees: mirror the leader's
 * CURRENT position proportionally (eToro "copy open trades"). If the
 * strategy is in cash, there is nothing to buy yet — the plan says so
 * instead of inventing an entry.
 */
export const planCopy = async (
  leaderIdToCopy: string,
  allocation: number,
  currentHoldings: Record<string, number> = {}
): Promise<CopyPlan | null> => {
  const runs = await runLeaders();
  const run = runs.find(r => leaderId(r.def.id, r.symbol) === leaderIdToCopy);
  if (!run) return null;

  const entry = rankLeaders(runs.map(toTrackRecord)).find(e => e.id === leaderIdToCopy);
  if (!entry) return null;

  // The leader's current stance: the strategy's signal on the latest bar.
  const signal = run.def.build()(run.bars, run.bars.length - 1);
  const lastClose = run.bars[run.bars.length - 1].close;
  const leaderEquity = run.result.equityCurve[run.result.equityCurve.length - 1].value;

  if (signal !== 'LONG') {
    return {
      leader: entry,
      stance: 'IN_CASH',
      orders: [],
      copyStopLossPct: DEFAULT_COPY_STOP_LOSS_PCT,
      note: `${entry.name} is currently in cash — keep the ₹${allocation.toLocaleString('en-IN')} liquid and mirror its next entry.`
    };
  }

  // Leader is fully invested: its units ≈ equity / last close.
  const order = mapCopyTrade(
    { symbol: run.symbol, side: 'BUY', quantity: leaderEquity / lastClose, price: lastClose },
    leaderEquity,
    allocation,
    currentHoldings
  );

  return {
    leader: entry,
    stance: 'INVESTED',
    orders: order ? [order] : [],
    copyStopLossPct: DEFAULT_COPY_STOP_LOSS_PCT,
    note: order
      ? `Mirrors the leader's open ${run.symbol} position. Copy stop-loss: close all and stop copying if the copied capital falls ${DEFAULT_COPY_STOP_LOSS_PCT}%.`
      : `The leader is invested, but ₹${allocation.toLocaleString('en-IN')} is too small to mirror the position above dust limits.`
  };
};
