
// Portfolio performance & risk metrics (pure domain logic).
//
// The QuantStats/OpenBB metric core, computed deterministically from a daily
// portfolio value series (and optionally a benchmark series aligned to the
// same dates): total return, CAGR, annualized volatility, Sharpe, Sortino,
// max drawdown, beta vs benchmark, and historical daily VaR(95).
// No storage, no clock, no I/O — fully unit-testable.

export interface PerformanceMetrics {
  days: number; // calendar days spanned by the series
  totalReturnPct: number;
  cagrPct: number | null; // null when the span is too short to annualize honestly
  annualVolatilityPct: number;
  sharpe: number; // 0 when volatility is 0
  sortino: number; // 0 when downside deviation is 0
  maxDrawdownPct: number; // <= 0
  beta: number | null; // null without a usable benchmark
  dailyVar95Pct: number; // historical 5th-percentile daily return, <= 0
}

export interface PerformanceOptions {
  riskFreeRatePct?: number; // annual, default 6.5 (India ~91-day T-bill)
  periodsPerYear?: number; // default 252 trading days
  calendarDays?: number; // span of the series; defaults to observations count
  benchmarkValues?: number[]; // same length/dates as values
}

const MIN_DAYS_FOR_CAGR = 30; // annualizing a week of data is noise, not a metric

export const computeDailyReturns = (values: number[]): number[] => {
  const returns: number[] = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] > 0) returns.push(values[i] / values[i - 1] - 1);
  }
  return returns;
};

const mean = (xs: number[]): number => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

const stdDev = (xs: number[]): number => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) * (x - m), 0) / (xs.length - 1));
};

export const computeMaxDrawdownPct = (values: number[]): number => {
  let peak = -Infinity;
  let maxDd = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    else if (peak > 0) maxDd = Math.min(maxDd, (v - peak) / peak);
  }
  return parseFloat((maxDd * 100).toFixed(2));
};

export const computePerformance = (
  values: number[],
  options: PerformanceOptions = {}
): PerformanceMetrics | null => {
  if (values.length < 2 || values[0] <= 0) return null;

  const periodsPerYear = options.periodsPerYear ?? 252;
  const riskFreeAnnual = (options.riskFreeRatePct ?? 6.5) / 100;
  const calendarDays = options.calendarDays ?? values.length;
  const rfDaily = riskFreeAnnual / periodsPerYear;

  const returns = computeDailyReturns(values);
  if (returns.length === 0) return null;

  const totalReturn = values[values.length - 1] / values[0] - 1;
  const cagr =
    calendarDays >= MIN_DAYS_FOR_CAGR
      ? Math.pow(1 + totalReturn, 365 / calendarDays) - 1
      : null;

  const dailyVol = stdDev(returns);
  const annualVol = dailyVol * Math.sqrt(periodsPerYear);

  const excessMean = mean(returns) - rfDaily;
  const sharpe = dailyVol > 0 ? (excessMean * periodsPerYear) / annualVol : 0;

  const downside = returns.map(r => Math.min(r - rfDaily, 0));
  const downsideDev =
    Math.sqrt(downside.reduce((s, d) => s + d * d, 0) / returns.length) * Math.sqrt(periodsPerYear);
  const sortino = downsideDev > 0 ? (excessMean * periodsPerYear) / downsideDev : 0;

  // Historical VaR(95): the 5th-percentile daily return, capped at 0.
  const sorted = [...returns].sort((a, b) => a - b);
  const var95 = Math.min(0, sorted[Math.floor(0.05 * (sorted.length - 1))]);

  // Beta vs benchmark on aligned daily returns.
  let beta: number | null = null;
  if (options.benchmarkValues && options.benchmarkValues.length === values.length) {
    const bReturns = computeDailyReturns(options.benchmarkValues);
    if (bReturns.length === returns.length && bReturns.length >= 2) {
      const mB = mean(bReturns);
      const mP = mean(returns);
      let cov = 0;
      let varB = 0;
      for (let i = 0; i < returns.length; i++) {
        cov += (returns[i] - mP) * (bReturns[i] - mB);
        varB += (bReturns[i] - mB) * (bReturns[i] - mB);
      }
      if (varB > 0) beta = parseFloat((cov / varB).toFixed(2));
    }
  }

  return {
    days: calendarDays,
    totalReturnPct: parseFloat((totalReturn * 100).toFixed(2)),
    cagrPct: cagr === null ? null : parseFloat((cagr * 100).toFixed(2)),
    annualVolatilityPct: parseFloat((annualVol * 100).toFixed(2)),
    sharpe: parseFloat(sharpe.toFixed(2)),
    sortino: parseFloat(sortino.toFixed(2)),
    maxDrawdownPct: computeMaxDrawdownPct(values),
    beta,
    dailyVar95Pct: parseFloat((var95 * 100).toFixed(2))
  };
};
