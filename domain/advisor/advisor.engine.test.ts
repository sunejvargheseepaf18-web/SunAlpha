
import { describe, it, expect } from 'vitest';
import { reviewPortfolio, AdvisorPosition } from './advisor.engine';

const pos = (
  symbol: string,
  assetType: AdvisorPosition['assetType'],
  invested: number,
  current: number
): AdvisorPosition => ({
  symbol,
  name: `${symbol} Ltd`,
  assetType,
  investedValue: invested,
  currentValue: current,
  pnl: current - invested,
  pnlPercent: parseFloat((((current - invested) / invested) * 100).toFixed(2))
});

// A balanced book: 7 positions, no single one above 18%, crypto under 10%
const balanced: AdvisorPosition[] = [
  pos('RELIANCE', 'STOCK', 44000, 45000),
  pos('M&M', 'STOCK', 44000, 46000),
  pos('QUANT-ELSS', 'MF', 45000, 45000),
  pos('AXIS-ELSS', 'MF', 44000, 44000),
  pos('SBI-CONTRA', 'MF', 45000, 46000),
  pos('NIPPON-ELSS', 'MF', 44000, 44000),
  pos('BTC', 'CRYPTO', 24000, 25000)
];

describe('reviewPortfolio', () => {
  it('a balanced portfolio reads HEALTHY with no findings', () => {
    const review = reviewPortfolio(balanced);
    expect(review.findings).toHaveLength(0);
    expect(review.healthScore).toBe(100);
    expect(review.grade).toBe('HEALTHY');
  });

  it('flags single-position concentration with the exact trim amount', () => {
    const book = [
      pos('M&M', 'STOCK', 300000, 400000), // dominates the book
      pos('RELIANCE', 'STOCK', 60000, 60000),
      pos('QUANT-ELSS', 'MF', 60000, 60000),
      pos('AXIS-ELSS', 'MF', 40000, 40000),
      pos('SBI-CONTRA', 'MF', 40000, 40000)
    ];
    const review = reviewPortfolio(book);
    const finding = review.findings.find(f => f.id === 'concentration-M&M')!;
    expect(finding.type).toBe('RISK');
    expect(finding.impact).toBe('HIGH'); // 66.7% > 1.5 x 18%
    expect(finding.title).toContain('66.7%');
    // Excess = 400000 - 18% of 600000 = 292000
    expect(finding.description).toContain('₹2,92,000');
  });

  it('flags crypto over-allocation against the 10% guideline', () => {
    const book = [
      pos('RELIANCE', 'STOCK', 50000, 50000),
      pos('M&M', 'STOCK', 50000, 50000),
      pos('QUANT-ELSS', 'MF', 50000, 50000),
      pos('AXIS-ELSS', 'MF', 20000, 20000),
      pos('BTC', 'CRYPTO', 20000, 30000)
    ];
    const review = reviewPortfolio(book);
    const finding = review.findings.find(f => f.id === 'crypto-allocation')!;
    expect(finding.type).toBe('RISK');
    expect(finding.title).toContain('15.0%');
  });

  it('flags thin books and single-asset-class books', () => {
    const thin = reviewPortfolio([
      pos('RELIANCE', 'STOCK', 50000, 50000),
      pos('M&M', 'STOCK', 50000, 50000)
    ]);
    expect(thin.findings.some(f => f.id === 'diversification-count')).toBe(true);
    expect(thin.findings.some(f => f.id === 'single-asset-class')).toBe(true);
  });

  it('surfaces harvest candidates only beyond both loss thresholds', () => {
    const book = [
      ...balanced.slice(0, 5),
      pos('NIPPON-MULTI', 'MF', 40000, 34000) // -15%, ₹6,000 loss
    ];
    const review = reviewPortfolio(book);
    const harvest = review.findings.find(f => f.id === 'harvest-NIPPON-MULTI')!;
    expect(harvest.type).toBe('OPPORTUNITY');
    expect(harvest.title).toContain('₹6,000');

    // Same % loss but tiny value: below the ₹2,000 floor -> no finding
    const tiny = reviewPortfolio([...balanced.slice(0, 5), pos('X', 'STOCK', 10000, 8900)]);
    expect(tiny.findings.some(f => f.id === 'harvest-X')).toBe(false);
  });

  it('big winners become low-impact review notes, not sell orders', () => {
    const book = [...balanced.slice(0, 5), pos('WINNER', 'STOCK', 20000, 30000)]; // +50%
    const review = reviewPortfolio(book);
    const winner = review.findings.find(f => f.id === 'winner-WINNER')!;
    expect(winner.type).toBe('INFO');
    expect(winner.impact).toBe('LOW');
  });

  it('deep aggregate drawdown is a HIGH risk and sinks the health score', () => {
    const book = [
      pos('A', 'STOCK', 100000, 80000),
      pos('B', 'STOCK', 100000, 82000),
      pos('C', 'MF', 100000, 85000),
      pos('D', 'MF', 100000, 84000),
      pos('E', 'MF', 100000, 86000)
    ];
    const review = reviewPortfolio(book);
    expect(review.findings.some(f => f.id === 'portfolio-drawdown' && f.impact === 'HIGH')).toBe(true);
    expect(review.healthScore).toBeLessThan(75);
    expect(review.grade).not.toBe('HEALTHY');
  });

  it('dust positions are consolidated into one INFO finding', () => {
    const book = [
      pos('RELIANCE', 'STOCK', 200000, 200000),
      pos('M&M', 'STOCK', 200000, 200000),
      pos('QUANT-ELSS', 'MF', 150000, 150000),
      pos('AXIS-ELSS', 'MF', 100000, 100000),
      pos('DUST1', 'STOCK', 3000, 3000),
      pos('DUST2', 'STOCK', 2500, 2500)
    ];
    const review = reviewPortfolio(book);
    const dust = review.findings.find(f => f.id === 'dust-positions')!;
    expect(dust.title).toContain('2 positions');
    expect(dust.description).toContain('DUST1');
    expect(dust.description).toContain('DUST2');
  });

  it('orders findings HIGH before MEDIUM before LOW and clamps the score', () => {
    const messy = [
      pos('HUGE', 'STOCK', 400000, 380000),
      pos('LOSER', 'MF', 100000, 70000),
      pos('WINNER', 'STOCK', 10000, 16000),
      pos('DUST', 'MF', 3000, 3000)
    ];
    const review = reviewPortfolio(messy);
    const impacts = review.findings.map(f => f.impact);
    const order: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    for (let i = 1; i < impacts.length; i++) {
      expect(order[impacts[i]]).toBeGreaterThanOrEqual(order[impacts[i - 1]]);
    }
    expect(review.healthScore).toBeGreaterThanOrEqual(0);
    expect(review.healthScore).toBeLessThanOrEqual(100);
  });

  it('an empty book is trivially healthy', () => {
    const review = reviewPortfolio([]);
    expect(review.findings).toHaveLength(0);
    expect(review.healthScore).toBe(100);
  });
});
