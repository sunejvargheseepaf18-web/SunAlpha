
// Trade journal engine (pure domain logic).
//
// The metric core every open trading journal (TradeNote, Tradicted,
// Journedge, RR Metrics) converges on: win rate, profit factor,
// EXPECTANCY (what an average trade is worth), R-MULTIPLES (P&L in units of
// planned risk), streaks, holding time, and breakdowns by setup and symbol
// so the trader can see WHICH behavior makes money. Deterministic — the UI
// and any AI brief consume these numbers, never recompute them.

export interface JournalTrade {
  id: string;
  symbol: string;
  side: 'LONG'; // long-only app
  quantity: number;
  entryDate: string; // yyyy-MM-dd
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  fees?: number; // total round-trip costs
  setup?: string; // strategy tag, e.g. "SMA-CROSS", "DIP-BUY"
  mistakes?: string[]; // behavior tags, e.g. "CHASED", "NO-STOP"
  plannedRiskAmount?: number; // rupees at risk if the stop had hit (1R)
}

export interface EnrichedTrade extends JournalTrade {
  pnl: number; // net of fees
  returnPct: number;
  holdingDays: number;
  rMultiple: number | null; // pnl / plannedRiskAmount
}

export interface GroupStats {
  trades: number;
  wins: number;
  winRatePct: number;
  netPnl: number;
}

export interface JournalStats {
  trades: number;
  wins: number;
  losses: number;
  netPnl: number;
  winRatePct: number;
  profitFactor: number | null; // gross wins / gross losses
  expectancy: number; // average net P&L per trade (rupees)
  avgWin: number;
  avgLoss: number; // > 0
  payoffRatio: number | null; // avgWin / avgLoss
  expectancyR: number | null; // mean R over trades that defined risk
  maxWinStreak: number;
  maxLossStreak: number;
  currentStreak: number; // + wins / - losses, most recent trades
  avgHoldingDays: number;
  mistakePnl: number; // net P&L of trades carrying at least one mistake tag
  bySetup: Record<string, GroupStats>;
  bySymbol: Record<string, GroupStats>;
  dailyPnl: { date: string; pnl: number }[]; // by exit date, ascending
  entries: EnrichedTrade[];
}

const dayDiff = (from: string, to: string): number =>
  Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000));

export const enrichTrade = (t: JournalTrade): EnrichedTrade => {
  const gross = (t.exitPrice - t.entryPrice) * t.quantity;
  const pnl = parseFloat((gross - (t.fees ?? 0)).toFixed(2));
  const invested = t.entryPrice * t.quantity;
  return {
    ...t,
    pnl,
    returnPct: invested > 0 ? parseFloat(((pnl / invested) * 100).toFixed(2)) : 0,
    holdingDays: dayDiff(t.entryDate, t.exitDate),
    rMultiple:
      t.plannedRiskAmount && t.plannedRiskAmount > 0
        ? parseFloat((pnl / t.plannedRiskAmount).toFixed(2))
        : null
  };
};

const emptyGroup = (): GroupStats => ({ trades: 0, wins: 0, winRatePct: 0, netPnl: 0 });

export const computeJournalStats = (trades: JournalTrade[]): JournalStats => {
  const entries = trades
    .map(enrichTrade)
    .sort((a, b) => a.exitDate.localeCompare(b.exitDate) || a.id.localeCompare(b.id));

  const wins = entries.filter(e => e.pnl > 0);
  const losses = entries.filter(e => e.pnl <= 0);
  const grossWin = wins.reduce((s, e) => s + e.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, e) => s + e.pnl, 0));
  const netPnl = parseFloat((grossWin - grossLoss).toFixed(2));

  // Streaks over exit-date order
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let run = 0; // + for wins, - for losses
  for (const e of entries) {
    if (e.pnl > 0) run = run > 0 ? run + 1 : 1;
    else run = run < 0 ? run - 1 : -1;
    maxWinStreak = Math.max(maxWinStreak, run);
    maxLossStreak = Math.max(maxLossStreak, -run);
  }

  const groupInto = (key: (e: EnrichedTrade) => string | undefined): Record<string, GroupStats> => {
    const groups: Record<string, GroupStats> = {};
    for (const e of entries) {
      const k = key(e);
      if (!k) continue;
      const g = (groups[k] ??= emptyGroup());
      g.trades += 1;
      if (e.pnl > 0) g.wins += 1;
      g.netPnl = parseFloat((g.netPnl + e.pnl).toFixed(2));
    }
    for (const g of Object.values(groups)) {
      g.winRatePct = g.trades > 0 ? parseFloat(((g.wins / g.trades) * 100).toFixed(1)) : 0;
    }
    return groups;
  };

  const dailyMap = new Map<string, number>();
  for (const e of entries) {
    dailyMap.set(e.exitDate, parseFloat(((dailyMap.get(e.exitDate) ?? 0) + e.pnl).toFixed(2)));
  }

  const rTrades = entries.filter(e => e.rMultiple !== null);
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;

  return {
    trades: entries.length,
    wins: wins.length,
    losses: losses.length,
    netPnl,
    winRatePct: entries.length ? parseFloat(((wins.length / entries.length) * 100).toFixed(1)) : 0,
    profitFactor: grossLoss > 0 ? parseFloat((grossWin / grossLoss).toFixed(2)) : null,
    expectancy: entries.length ? parseFloat((netPnl / entries.length).toFixed(2)) : 0,
    avgWin: parseFloat(avgWin.toFixed(2)),
    avgLoss: parseFloat(avgLoss.toFixed(2)),
    payoffRatio: avgLoss > 0 ? parseFloat((avgWin / avgLoss).toFixed(2)) : null,
    expectancyR: rTrades.length
      ? parseFloat((rTrades.reduce((s, e) => s + (e.rMultiple as number), 0) / rTrades.length).toFixed(2))
      : null,
    maxWinStreak,
    maxLossStreak,
    currentStreak: run,
    avgHoldingDays: entries.length
      ? parseFloat((entries.reduce((s, e) => s + e.holdingDays, 0) / entries.length).toFixed(1))
      : 0,
    mistakePnl: parseFloat(
      entries.filter(e => e.mistakes && e.mistakes.length > 0).reduce((s, e) => s + e.pnl, 0).toFixed(2)
    ),
    bySetup: groupInto(e => e.setup),
    bySymbol: groupInto(e => e.symbol),
    dailyPnl: [...dailyMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, pnl]) => ({ date, pnl })),
    entries
  };
};
