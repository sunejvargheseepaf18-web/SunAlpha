
// Dividend income engine (pure domain logic) — the Ghostfolio/Portfolio
// Performance metric set: trailing-twelve-month income per holding, yield
// on current price and on cost, last payout, and a 12-month income
// timeline for the portfolio. Deterministic; dividend events come in from
// the feed layer, `asOf` is injected for testability.

export interface DividendEventInput {
  date: string; // ex-date, yyyy-MM-dd
  amount: number; // per share
}

export interface IncomeHolding {
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
}

export interface HoldingIncome {
  symbol: string;
  name: string;
  ttmDividendPerShare: number;
  ttmIncome: number; // quantity x TTM per-share dividends
  yieldPct: number; // TTM DPS / current price
  yieldOnCostPct: number; // TTM DPS / avg buy price
  payoutsTtm: number; // number of payouts in the window
  lastPayout: DividendEventInput | null;
}

export interface MonthlyIncome {
  month: string; // yyyy-MM
  income: number;
}

export interface IncomeReport {
  holdings: HoldingIncome[]; // only holdings with TTM income, largest first
  totalTtmIncome: number;
  portfolioYieldPct: number; // total TTM income / current portfolio value
  monthly: MonthlyIncome[]; // last 12 months, oldest first, zero-filled
}

const monthKey = (date: string): string => date.slice(0, 7);

const lastTwelveMonths = (asOf: string): string[] => {
  const months: string[] = [];
  const d = new Date(`${monthKey(asOf)}-01T00:00:00Z`);
  for (let i = 11; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    months.push(`${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return months;
};

export const computeIncomeReport = (
  holdings: IncomeHolding[],
  dividendsBySymbol: Record<string, DividendEventInput[]>,
  asOf: string
): IncomeReport => {
  const windowStart = new Date(new Date(asOf).getTime() - 365 * 86400000)
    .toISOString()
    .split('T')[0];

  const rows: HoldingIncome[] = [];
  const monthlyMap = new Map<string, number>(lastTwelveMonths(asOf).map(m => [m, 0]));
  let totalTtmIncome = 0;
  let totalValue = 0;

  for (const h of holdings) {
    totalValue += h.quantity * h.currentPrice;
    const events = (dividendsBySymbol[h.symbol] ?? []).filter(
      e => e.date >= windowStart && e.date <= asOf && e.amount > 0
    );
    if (events.length === 0) continue;

    const ttmDps = parseFloat(events.reduce((s, e) => s + e.amount, 0).toFixed(4));
    const ttmIncome = parseFloat((ttmDps * h.quantity).toFixed(2));
    totalTtmIncome += ttmIncome;

    for (const e of events) {
      const key = monthKey(e.date);
      if (monthlyMap.has(key)) {
        monthlyMap.set(key, parseFloat(((monthlyMap.get(key) ?? 0) + e.amount * h.quantity).toFixed(2)));
      }
    }

    rows.push({
      symbol: h.symbol,
      name: h.name,
      ttmDividendPerShare: ttmDps,
      ttmIncome,
      yieldPct: h.currentPrice > 0 ? parseFloat(((ttmDps / h.currentPrice) * 100).toFixed(2)) : 0,
      yieldOnCostPct: h.avgPrice > 0 ? parseFloat(((ttmDps / h.avgPrice) * 100).toFixed(2)) : 0,
      payoutsTtm: events.length,
      lastPayout: events[events.length - 1]
    });
  }

  return {
    holdings: rows.sort((a, b) => b.ttmIncome - a.ttmIncome),
    totalTtmIncome: parseFloat(totalTtmIncome.toFixed(2)),
    portfolioYieldPct: totalValue > 0 ? parseFloat(((totalTtmIncome / totalValue) * 100).toFixed(2)) : 0,
    monthly: [...monthlyMap.entries()].map(([month, income]) => ({ month, income }))
  };
};
