
import { describe, it, expect } from 'vitest';
import { computeQualityScore, classifyEsgRisk } from './quality.engine';
import { FundamentalData } from '../../types';

const base: FundamentalData = {
  symbol: 'TEST',
  roe: 22,
  roce: 25,
  npm: 15,
  revenueGrowth3Y: 14,
  profitGrowth3Y: 18,
  debtToEquity: 0.2,
  interestCoverage: 12,
  currentRatio: 1.8,
  freeCashFlowConversion: 0.95,
  peHistory: 25,
  currentPe: 22,
  pegRatio: 1.2,
  promoterHolding: 55,
  pledgedShares: 0
};

describe('computeQualityScore', () => {
  it('scores a clean compounder 9/9 STRONG', () => {
    const report = computeQualityScore(base);
    expect(report.score).toBe(9);
    expect(report.maxScore).toBe(9);
    expect(report.grade).toBe('STRONG');
    expect(report.checks).toHaveLength(9);
    expect(report.checks.every(c => c.pass)).toBe(true);
    expect(report.summary).toContain('9/9');
  });

  it('scores a leveraged low-margin business WEAK and names failures', () => {
    const junk: FundamentalData = {
      ...base,
      roe: 6,
      roce: 8,
      npm: 3,
      revenueGrowth3Y: 2,
      profitGrowth3Y: -5,
      debtToEquity: 2.4,
      interestCoverage: 1.5,
      currentRatio: 0.9,
      freeCashFlowConversion: 0.4,
      pledgedShares: 12
    };
    const report = computeQualityScore(junk);
    expect(report.score).toBe(0);
    expect(report.grade).toBe('WEAK');
    expect(report.summary).toContain('0/9');
  });

  it('grades the middle band AVERAGE with the right boundaries', () => {
    // Fail exactly 3 checks -> 6/9 AVERAGE
    const mid = computeQualityScore({ ...base, roe: 10, npm: 5, pledgedShares: 3 });
    expect(mid.score).toBe(6);
    expect(mid.grade).toBe('AVERAGE');

    // 7/9 is the STRONG floor
    const strongFloor = computeQualityScore({ ...base, roe: 10, npm: 5 });
    expect(strongFloor.score).toBe(7);
    expect(strongFloor.grade).toBe('STRONG');

    // 4/9 is the AVERAGE floor; 3/9 is WEAK
    const avgFloor = computeQualityScore({
      ...base, roe: 10, npm: 5, roce: 10, revenueGrowth3Y: 3, profitGrowth3Y: 4
    });
    expect(avgFloor.score).toBe(4);
    expect(avgFloor.grade).toBe('AVERAGE');
  });

  it('solvency check requires BOTH interest cover and current ratio', () => {
    const coverOnly = computeQualityScore({ ...base, currentRatio: 1.0 });
    expect(coverOnly.checks.find(c => c.id === 'solvency')!.pass).toBe(false);
    const crOnly = computeQualityScore({ ...base, interestCoverage: 2 });
    expect(crOnly.checks.find(c => c.id === 'solvency')!.pass).toBe(false);
  });

  it('any promoter pledging fails the governance check', () => {
    const pledged = computeQualityScore({ ...base, pledgedShares: 0.5 });
    expect(pledged.checks.find(c => c.id === 'pledging')!.pass).toBe(false);
    expect(pledged.score).toBe(8);
  });
});

describe('classifyEsgRisk', () => {
  it('maps Sustainalytics bands (lower is better)', () => {
    expect(classifyEsgRisk(5)).toBe('NEGLIGIBLE');
    expect(classifyEsgRisk(15)).toBe('LOW');
    expect(classifyEsgRisk(25)).toBe('MEDIUM');
    expect(classifyEsgRisk(35)).toBe('HIGH');
    expect(classifyEsgRisk(45)).toBe('SEVERE');
  });

  it('band edges belong to the higher-risk side', () => {
    expect(classifyEsgRisk(10)).toBe('LOW');
    expect(classifyEsgRisk(20)).toBe('MEDIUM');
    expect(classifyEsgRisk(30)).toBe('HIGH');
    expect(classifyEsgRisk(40)).toBe('SEVERE');
  });
});
