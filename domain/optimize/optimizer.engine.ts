
// Portfolio optimization engine (pure domain logic).
//
// The PyPortfolioOpt/skfolio core, browser-native and deterministic:
// annualized mean returns and covariance from daily returns, diagonal
// shrinkage (Ledoit-Wolf-lite) so a handful of noisy series can't produce a
// degenerate matrix, and three long-only optimizers — minimum volatility,
// maximum Sharpe, and risk parity — solved with projected gradient descent
// onto the capped simplex (no shorting, weights sum to 1, per-asset cap).
// n is small here (a personal portfolio), so simple iterative solvers are
// exact enough and fully testable.

export interface OptimizedPortfolio {
  weights: number[]; // aligned with the input asset order, sums to 1
  expectedReturnPct: number; // annualized
  volatilityPct: number; // annualized
  sharpe: number;
}

const PERIODS_PER_YEAR = 252;
const SHRINKAGE = 0.2; // blend toward the diagonal; stabilizes small samples

// --- Statistics -------------------------------------------------------------

/** Daily returns matrix (rows = days, cols = assets) -> annualized means. */
export const annualizedMeanReturns = (returns: number[][]): number[] => {
  const n = returns[0]?.length ?? 0;
  const means = new Array(n).fill(0);
  for (const row of returns) for (let j = 0; j < n; j++) means[j] += row[j];
  return means.map(m => (m / returns.length) * PERIODS_PER_YEAR);
};

/** Annualized covariance with diagonal shrinkage. */
export const covarianceMatrix = (returns: number[][], shrinkage = SHRINKAGE): number[][] => {
  const t = returns.length;
  const n = returns[0]?.length ?? 0;
  const means = new Array(n).fill(0);
  for (const row of returns) for (let j = 0; j < n; j++) means[j] += row[j] / t;

  const cov: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const row of returns) {
    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        cov[i][j] += (row[i] - means[i]) * (row[j] - means[j]);
      }
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let v = (cov[i][j] / Math.max(1, t - 1)) * PERIODS_PER_YEAR;
      if (i !== j) v *= 1 - shrinkage; // shrink off-diagonals toward zero
      cov[i][j] = v;
      cov[j][i] = v;
    }
  }
  return cov;
};

const matVec = (m: number[][], v: number[]): number[] =>
  m.map(row => row.reduce((s, x, j) => s + x * v[j], 0));

const dot = (a: number[], b: number[]): number => a.reduce((s, x, i) => s + x * b[i], 0);

export const portfolioStats = (
  weights: number[],
  means: number[],
  cov: number[][],
  riskFreePct = 6.5
): OptimizedPortfolio => {
  const ret = dot(weights, means);
  const vol = Math.sqrt(Math.max(0, dot(weights, matVec(cov, weights))));
  return {
    weights: weights.map(w => parseFloat(w.toFixed(4))),
    expectedReturnPct: parseFloat((ret * 100).toFixed(2)),
    volatilityPct: parseFloat((vol * 100).toFixed(2)),
    sharpe: vol > 0 ? parseFloat(((ret - riskFreePct / 100) / vol).toFixed(2)) : 0
  };
};

// --- Capped simplex projection ---------------------------------------------

/** Project onto { w : sum(w)=1, 0 <= w_i <= cap } by iterative clip-and-shift. */
export const projectToCappedSimplex = (w: number[], cap: number): number[] => {
  const n = w.length;
  const effectiveCap = Math.max(cap, 1 / n); // cap below 1/n is infeasible
  let x = [...w];
  for (let iter = 0; iter < 50; iter++) {
    x = x.map(v => Math.min(effectiveCap, Math.max(0, v)));
    const sum = x.reduce((s, v) => s + v, 0);
    if (Math.abs(sum - 1) < 1e-9) break;
    const free = x.map((v, i) => i).filter(i => (sum > 1 ? x[i] > 0 : x[i] < effectiveCap));
    if (free.length === 0) break;
    const delta = (1 - sum) / free.length;
    for (const i of free) x[i] += delta;
  }
  return x.map(v => Math.min(effectiveCap, Math.max(0, v)));
};

// --- Optimizers -------------------------------------------------------------

// Minimize f(w) = riskAversion * w'Σw - w'μ via projected gradient descent.
const solve = (
  means: number[],
  cov: number[][],
  riskAversion: number,
  cap: number
): number[] => {
  const n = means.length;
  let w = projectToCappedSimplex(new Array(n).fill(1 / n), cap);
  const trace = cov.reduce((s, row, i) => s + row[i], 0);
  const step = 1 / Math.max(1e-9, 2 * riskAversion * trace);

  for (let iter = 0; iter < 800; iter++) {
    const grad = matVec(cov, w).map((g, i) => 2 * riskAversion * g - means[i]);
    const next = projectToCappedSimplex(w.map((v, i) => v - step * grad[i]), cap);
    const moved = next.reduce((s, v, i) => s + Math.abs(v - w[i]), 0);
    w = next;
    if (moved < 1e-10) break;
  }
  return w;
};

/** Lowest-variance long-only portfolio (returns ignored). */
export const minVolatility = (means: number[], cov: number[][], maxWeight = 1): OptimizedPortfolio =>
  portfolioStats(solve(new Array(means.length).fill(0), cov, 1, maxWeight), means, cov);

/**
 * Max-Sharpe via a deterministic risk-aversion sweep: solve the mean-variance
 * problem across a log-spaced grid of risk aversions and keep the portfolio
 * with the best Sharpe. Exact-enough for small n, with no QP solver needed.
 */
export const maxSharpe = (
  means: number[],
  cov: number[][],
  maxWeight = 1,
  riskFreePct = 6.5
): OptimizedPortfolio => {
  let best: OptimizedPortfolio | null = null;
  for (let k = 0; k <= 14; k++) {
    const riskAversion = Math.pow(10, -1 + (3 * k) / 14); // 0.1 .. 100
    const stats = portfolioStats(solve(means, cov, riskAversion, maxWeight), means, cov, riskFreePct);
    if (!best || stats.sharpe > best.sharpe) best = stats;
  }
  return best!;
};

/** Equal risk contribution portfolio (multiplicative iteration). */
export const riskParity = (means: number[], cov: number[][], maxWeight = 1): OptimizedPortfolio => {
  const n = means.length;
  let w = new Array(n).fill(1 / n);
  for (let iter = 0; iter < 300; iter++) {
    const sigmaW = matVec(cov, w);
    const rc = w.map((v, i) => v * sigmaW[i]); // risk contributions
    const target = rc.reduce((s, x) => s + x, 0) / n;
    if (rc.every(x => x > 0 && Math.abs(x - target) / target < 1e-6)) break;
    w = w.map((v, i) => (rc[i] > 0 ? v * Math.sqrt(target / rc[i]) : v));
    const sum = w.reduce((s, v) => s + v, 0);
    w = w.map(v => v / sum);
  }
  return portfolioStats(projectToCappedSimplex(w, maxWeight), means, cov);
};
