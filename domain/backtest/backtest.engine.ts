
// Backtest engine (pure domain logic — no network, no storage, no clock).
//
// An event-driven, bar-by-bar simulator in the backtesting.py mold, built
// around the three correctness rules every credible framework enforces:
//   1. NO LOOKAHEAD — the strategy decides on bar i seeing bars[0..i] only,
//      and the order executes at bar i+1's OPEN, never bar i's close.
//   2. COSTS ARE REAL — commission and slippage are charged per side;
//      realistic costs typically halve a naive backtest's edge.
//   3. HONEST BENCHMARK — buy-and-hold is computed with the same costs.
// Long-only by design: SunAlpha is an advisory app, and AGENT_RULES routes
// all real execution through the rebalance/risk engines.

export interface BtBar {
  date: string; // yyyy-MM-dd, ascending
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Target state after bar i (seen bars[0..i]):
// LONG = be invested, FLAT = be in cash, HOLD = keep whatever position exists.
export type StrategySignal = 'LONG' | 'FLAT' | 'HOLD';
export type Strategy = (bars: BtBar[], index: number) => StrategySignal;

export interface BacktestOptions {
  initialCapital?: number; // default 1,00,000
  commissionPct?: number; // per side, % of notional; default 0.05
  slippagePct?: number; // per side, % of price; default 0.05
}

export interface BtTrade {
  entryDate: string;
  entryPrice: number; // includes slippage
  exitDate: string;
  exitPrice: number; // includes slippage
  returnPct: number; // net of slippage (commission tracked in equity)
  holdingDays: number;
}

export interface BacktestStats {
  totalReturnPct: number;
  buyHoldReturnPct: number; // same costs, invested at first tradable open
  maxDrawdownPct: number;
  tradesCount: number;
  winRatePct: number; // of closed trades
  profitFactor: number | null; // gross wins / gross losses; null if no losses
  exposurePct: number; // fraction of bars spent in the market
}

export interface BacktestResult {
  equityCurve: { date: string; value: number }[];
  trades: BtTrade[];
  stats: BacktestStats;
}

const daysBetween = (a: string, b: string): number =>
  Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));

export const runBacktest = (
  bars: BtBar[],
  strategy: Strategy,
  options: BacktestOptions = {}
): BacktestResult | null => {
  if (bars.length < 3) return null;

  const initialCapital = options.initialCapital ?? 100000;
  const commission = (options.commissionPct ?? 0.05) / 100;
  const slippage = (options.slippagePct ?? 0.05) / 100;

  let cash = initialCapital;
  let units = 0;
  let entry: { date: string; price: number } | null = null;
  const trades: BtTrade[] = [];
  const equityCurve: { date: string; value: number }[] = [];
  let barsInMarket = 0;

  for (let i = 0; i < bars.length; i++) {
    // 1. Execute the order decided on the PREVIOUS bar at THIS bar's open.
    if (i > 0) {
      const signal = strategy(bars.slice(0, i), i - 1); // sees bars[0..i-1] only
      const open = bars[i].open;

      if (signal === 'LONG' && units === 0 && open > 0) {
        const buyPrice = open * (1 + slippage);
        const investable = cash / (1 + commission);
        units = investable / buyPrice;
        cash -= investable + investable * commission;
        cash = Math.max(0, cash);
        entry = { date: bars[i].date, price: buyPrice };
      } else if (signal === 'FLAT' && units > 0) {
        const sellPrice = open * (1 - slippage);
        const proceeds = units * sellPrice;
        cash += proceeds - proceeds * commission;
        trades.push({
          entryDate: entry!.date,
          entryPrice: parseFloat(entry!.price.toFixed(2)),
          exitDate: bars[i].date,
          exitPrice: parseFloat(sellPrice.toFixed(2)),
          returnPct: parseFloat((((sellPrice - entry!.price) / entry!.price) * 100).toFixed(2)),
          holdingDays: daysBetween(entry!.date, bars[i].date)
        });
        units = 0;
        entry = null;
      }
      // HOLD (or LONG while long / FLAT while flat): no action.
    }

    if (units > 0) barsInMarket++;
    equityCurve.push({
      date: bars[i].date,
      value: parseFloat((cash + units * bars[i].close).toFixed(2))
    });
  }

  // Close any open position at the last close (standard end-of-test marking).
  if (units > 0 && entry) {
    const last = bars[bars.length - 1];
    const sellPrice = last.close * (1 - slippage);
    trades.push({
      entryDate: entry.date,
      entryPrice: parseFloat(entry.price.toFixed(2)),
      exitDate: last.date,
      exitPrice: parseFloat(sellPrice.toFixed(2)),
      returnPct: parseFloat((((sellPrice - entry.price) / entry.price) * 100).toFixed(2)),
      holdingDays: daysBetween(entry.date, last.date)
    });
  }

  const finalEquity = equityCurve[equityCurve.length - 1].value;

  // Buy & hold with identical costs: buy at bars[1].open (first tradable open
  // — bar 0's open is not reachable without lookahead), sell at last close.
  const bhBuy = bars[1].open * (1 + slippage);
  const bhInvestable = initialCapital / (1 + commission);
  const bhUnits = bhBuy > 0 ? bhInvestable / bhBuy : 0;
  const bhProceeds = bhUnits * bars[bars.length - 1].close * (1 - slippage);
  const bhFinal = bhProceeds - bhProceeds * commission;

  // Max drawdown on the equity curve
  let peak = -Infinity;
  let maxDd = 0;
  for (const p of equityCurve) {
    if (p.value > peak) peak = p.value;
    else if (peak > 0) maxDd = Math.min(maxDd, (p.value - peak) / peak);
  }

  const wins = trades.filter(t => t.returnPct > 0);
  const grossWin = wins.reduce((s, t) => s + t.returnPct, 0);
  const grossLoss = Math.abs(trades.filter(t => t.returnPct <= 0).reduce((s, t) => s + t.returnPct, 0));

  return {
    equityCurve,
    trades,
    stats: {
      totalReturnPct: parseFloat((((finalEquity - initialCapital) / initialCapital) * 100).toFixed(2)),
      buyHoldReturnPct: parseFloat((((bhFinal - initialCapital) / initialCapital) * 100).toFixed(2)),
      maxDrawdownPct: parseFloat((maxDd * 100).toFixed(2)),
      tradesCount: trades.length,
      winRatePct: trades.length ? parseFloat(((wins.length / trades.length) * 100).toFixed(1)) : 0,
      profitFactor: grossLoss > 0 ? parseFloat((grossWin / grossLoss).toFixed(2)) : null,
      exposurePct: parseFloat(((barsInMarket / bars.length) * 100).toFixed(1))
    }
  };
};
