
import { describe, it, expect } from 'vitest';
import { scoreText, scoreHeadlines } from './sentiment.engine';

describe('scoreText', () => {
  it('scores clearly positive finance headlines positive', () => {
    const s = scoreText('Reliance beats estimates as profit surges to record high');
    expect(s.score).toBeGreaterThan(0.5);
    expect(s.positives).toContain('beats');
    expect(s.positives).toContain('record');
  });

  it('scores clearly negative headlines negative', () => {
    const s = scoreText('M&M shares plunge after regulator opens fraud probe');
    expect(s.score).toBeLessThan(-0.5);
    expect(s.negatives).toContain('plunge');
    expect(s.negatives).toContain('probe');
  });

  it('negation flips polarity within a two-token window', () => {
    // "fails to beat" -> beat is negated -> negative
    expect(scoreText('Company fails to beat street estimates').score).toBeLessThan(0);
    // "no fraud" -> fraud negated -> counts positive
    expect(scoreText('Regulator finds no fraud at the company').score).toBeGreaterThan(0);
  });

  it('returns zero with no matched terms', () => {
    const s = scoreText('Board meeting scheduled for Thursday afternoon');
    expect(s.score).toBe(0);
    expect(s.positives).toHaveLength(0);
  });

  it('mixed headlines land between the poles', () => {
    const s = scoreText('Profit rises but debt concerns weigh on outlook');
    expect(Math.abs(s.score)).toBeLessThan(0.5);
  });
});

describe('scoreHeadlines', () => {
  it('aggregates and labels bullish coverage', () => {
    const agg = scoreHeadlines([
      'Stock surges on record profit',
      'Broker upgrades target after strong growth',
      'Board meeting scheduled Thursday' // neutral, excluded from mean
    ]);
    expect(agg.label).toBe('BULLISH');
    expect(agg.scored).toBe(2);
    expect(agg.total).toBe(3);
    expect(agg.topPositives.length).toBeGreaterThan(0);
  });

  it('labels bearish coverage and surfaces the driving terms', () => {
    const agg = scoreHeadlines([
      'Shares plunge as losses widen',
      'Downgrade follows weak quarterly numbers'
    ]);
    expect(agg.label).toBe('BEARISH');
    expect(agg.topNegatives).toContain('plunge');
  });

  it('is NEUTRAL with no scoreable headlines or balanced coverage', () => {
    expect(scoreHeadlines(['AGM on Friday', 'New office opened']).label).toBe('NEUTRAL');
    expect(
      scoreHeadlines(['Profit surges to record', 'Shares plunge on fraud probe']).label
    ).toBe('NEUTRAL');
  });

  it('handles an empty list', () => {
    const agg = scoreHeadlines([]);
    expect(agg.score).toBe(0);
    expect(agg.total).toBe(0);
  });
});
