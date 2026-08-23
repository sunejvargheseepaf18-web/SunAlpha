
import { describe, it, expect } from 'vitest';
import { extractLessons, formatLessons } from './lessons.engine';
import { GradedEntry, JournalScorecard } from './journal.engine';

const graded = (over: Partial<GradedEntry>): GradedEntry => ({
  id: 'x',
  date: '2026-08-20',
  symbol: 'M&M',
  chip: 'SELL',
  action: 'TRIM',
  priceAtAdvice: 3420,
  currentPrice: 3300,
  returnPct: -3.5,
  correct: true,
  ...over
});

const card = (entries: GradedEntry[]): JournalScorecard => ({
  total: entries.length,
  graded: entries.length,
  correct: entries.filter(e => e.correct).length,
  hitRatePct: 0,
  avgReturnPct: 0,
  entries
});

describe('extractLessons', () => {
  it('aggregates per symbol+chip and produces prompt-ready text', () => {
    const lessons = extractLessons(
      card([
        graded({ id: '1', returnPct: -3.5, correct: true }),
        graded({ id: '2', returnPct: -1.5, correct: true }),
        graded({ id: '3', returnPct: 2.0, correct: false })
      ]),
      { minSamples: 2 }
    );

    const mm = lessons.find(l => l.key === 'SELL:M&M')!;
    expect(mm.samples).toBe(3);
    expect(mm.correct).toBe(2);
    expect(mm.hitRatePct).toBeCloseTo(66.7, 1);
    expect(mm.avgReturnPct).toBeCloseTo(-1.0, 2);
    expect(mm.text).toContain('SELL advice on M&M: 2/3');
    expect(mm.text).toContain('-1.0%');
  });

  it('includes an overall lesson per chip alongside symbol lessons', () => {
    const lessons = extractLessons(
      card([
        graded({ id: '1', symbol: 'M&M' }),
        graded({ id: '2', symbol: 'RELIANCE', returnPct: -2.0 })
      ]),
      { minSamples: 2 }
    );
    // Each symbol has only 1 sample (below min), but overall SELL has 2
    expect(lessons.find(l => l.key === 'SELL:M&M')).toBeUndefined();
    const overall = lessons.find(l => l.key === 'OVERALL:SELL')!;
    expect(overall.samples).toBe(2);
    expect(overall.text).toContain('across all holdings');
  });

  it('drops under-evidenced groups and caps the lesson count', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      graded({ id: `s${i}`, symbol: `SYM${i % 6}`, returnPct: -1 })
    );
    const lessons = extractLessons(card(many), { minSamples: 2, maxLessons: 4 });
    expect(lessons.length).toBeLessThanOrEqual(4);
    // Best-evidenced first
    expect(lessons[0].samples).toBeGreaterThanOrEqual(lessons[lessons.length - 1].samples);
  });

  it('returns nothing for an empty scorecard', () => {
    expect(extractLessons(card([]))).toHaveLength(0);
    expect(formatLessons([])).toBe('');
  });
});

describe('formatLessons', () => {
  it('renders one bullet line per lesson', () => {
    const lessons = extractLessons(
      card([graded({ id: '1' }), graded({ id: '2', returnPct: -2 })]),
      { minSamples: 2 }
    );
    const block = formatLessons(lessons);
    expect(block.split('\n').length).toBe(lessons.length);
    expect(block.startsWith('- ')).toBe(true);
  });
});
