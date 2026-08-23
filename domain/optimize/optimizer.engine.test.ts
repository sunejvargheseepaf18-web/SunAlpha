
import { describe, it, expect } from 'vitest';
import {
  annualizedMeanReturns,
  covarianceMatrix,
  minVolatility,
  maxSharpe,
  riskParity,
  projectToCappedSimplex
} from './optimizer.engine';
import { discreteAllocation } from './discreteAllocation';

// Synthetic daily-returns matrix generator: deterministic sinusoid mix with
// per-asset drift and vol — enough structure for stable covariance.
const syntheticReturns = (drifts: number[], vols: number[], days = 260): number[][] => {
  const rows: number[][] = [];
  for (let t = 0; t < days; t++) {
    rows.push(
      drifts.map((d, j) => d / 252 + (vols[j] / Math.sqrt(252)) * Math.sin(0.7 * t + j * 2.1))
    );
  }
  return rows;
};

describe('statistics', () => {
  it('annualizes mean returns correctly', () => {
    const returns = [[0.001, -0.002], [0.001, -0.002]];
    const means = annualizedMeanReturns(returns);
    expect(means[0]).toBeCloseTo(0.001 * 252, 6);
    expect(means[1]).toBeCloseTo(-0.002 * 252, 6);
  });

  it('covariance is symmetric with positive diagonal', () => {
    const cov = covarianceMatrix(syntheticReturns([0.1, 0.05], [0.2, 0.3]));
    expect(cov[0][1]).toBeCloseTo(cov[1][0], 10);
    expect(cov[0][0]).toBeGreaterThan(0);
    expect(cov[1][1]).toBeGreaterThan(cov[0][0]); // higher-vol asset
  });
});

describe('projectToCappedSimplex', () => {
  it('produces weights that sum to 1 within bounds', () => {
    const w = projectToCappedSimplex([0.9, 0.9, -0.5], 0.5);
    expect(w.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 6);
    expect(Math.max(...w)).toBeLessThanOrEqual(0.5 + 1e-9);
    expect(Math.min(...w)).toBeGreaterThanOrEqual(0);
  });
});

describe('optimizers', () => {
  it('min volatility splits ~50/50 between two identical uncorrelated assets', () => {
    // Two assets, same vol, phase-shifted so correlation is low
    const returns: number[][] = [];
    for (let t = 0; t < 260; t++) {
      returns.push([0.01 * Math.sin(0.9 * t), 0.01 * Math.cos(0.9 * t)]);
    }
    const cov = covarianceMatrix(returns, 0);
    const means = annualizedMeanReturns(returns);
    const port = minVolatility(means, cov);
    expect(port.weights[0]).toBeCloseTo(0.5, 1);
    expect(port.weights[1]).toBeCloseTo(0.5, 1);
  });

  it('max sharpe tilts strongly toward the dominant asset', () => {
    // Same risk, very different drift: A should dominate
    const returns = syntheticReturns([0.2, 0.02], [0.15, 0.15]);
    const cov = covarianceMatrix(returns);
    const means = annualizedMeanReturns(returns);
    const port = maxSharpe(means, cov);
    expect(port.weights[0]).toBeGreaterThan(0.75);
    expect(port.weights.reduce((s, w) => s + w, 0)).toBeCloseTo(1, 3);
  });

  it('respects the per-asset weight cap', () => {
    const returns = syntheticReturns([0.25, 0.02, 0.02], [0.15, 0.15, 0.15]);
    const cov = covarianceMatrix(returns);
    const means = annualizedMeanReturns(returns);
    const port = maxSharpe(means, cov, 0.4);
    expect(Math.max(...port.weights)).toBeLessThanOrEqual(0.4 + 1e-6);
    expect(port.weights.reduce((s, w) => s + w, 0)).toBeCloseTo(1, 3);
  });

  it('risk parity weights inversely to volatility for uncorrelated assets', () => {
    // Diagonal case: sigma 10% vs 20% -> weights ~2:1
    const cov = [
      [0.01, 0],
      [0, 0.04]
    ];
    const port = riskParity([0.1, 0.1], cov);
    expect(port.weights[0] / port.weights[1]).toBeCloseTo(2, 1);
  });
});

describe('discreteAllocation', () => {
  it('converts weights into whole shares near targets without overspending', () => {
    const result = discreteAllocation(
      [
        { symbol: 'RELIANCE', price: 1318.39 },
        { symbol: 'M&M', price: 3420.32 },
        { symbol: 'MIRAE-ELSS', price: 55.85, isMf: true }
      ],
      [0.4, 0.3, 0.3],
      500000
    )!;
    expect(result.spent + result.leftoverCash).toBeCloseTo(500000, 2);
    expect(result.leftoverCash).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(result.quantities['RELIANCE'])).toBe(true);
    expect(Number.isInteger(result.quantities['M&M'])).toBe(true);
    // Achieved weights within ~2 points of target
    expect(Math.abs(result.achievedWeights['RELIANCE'] - 0.4)).toBeLessThan(0.02);
    expect(Math.abs(result.achievedWeights['MIRAE-ELSS'] - 0.3)).toBeLessThan(0.02);
  });

  it('rejects invalid inputs', () => {
    expect(discreteAllocation([{ symbol: 'X', price: 0 }], [1], 1000)).toBeNull();
    expect(discreteAllocation([{ symbol: 'X', price: 10 }], [0.5, 0.5], 1000)).toBeNull();
  });
});
