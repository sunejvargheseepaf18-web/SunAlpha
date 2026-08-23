
// Lesson memory — infrastructure for the reflection loop.
//
// Bridges the advice journal (what we said, at what price) and the pure
// lessons engine (what we learned) so callers can pull prompt-ready
// track-record lines for one symbol or the whole portfolio.

import { loadJournal } from './adviceJournal';
import { gradeAdviceJournal } from '../domain/advice/journal.engine';
import { AdviceLesson, extractLessons, formatLessons } from '../domain/advice/lessons.engine';
import { PortfolioPosition } from '../types';

const todayIso = (): string => new Date().toISOString().split('T')[0];

/**
 * Lessons learned about one symbol, graded against its current price.
 * Empty array until at least two past advices exist for it.
 */
export const getSymbolLessons = (symbol: string, currentPrice: number): AdviceLesson[] => {
  if (currentPrice <= 0) return [];
  const today = todayIso();
  const entries = loadJournal().filter(e => e.symbol === symbol && e.date !== today);
  if (entries.length === 0) return [];
  return extractLessons(gradeAdviceJournal(entries, { [symbol]: currentPrice }), {
    minSamples: 2,
    maxLessons: 4
  });
};

/** Portfolio-wide lessons, graded against the given positions' prices. */
export const getPortfolioLessons = (positions: PortfolioPosition[]): AdviceLesson[] => {
  const today = todayIso();
  const entries = loadJournal().filter(e => e.date !== today);
  if (entries.length === 0) return [];
  const prices = Object.fromEntries(positions.map(p => [p.symbol, p.currentPrice]));
  return extractLessons(gradeAdviceJournal(entries, prices));
};

/** Prompt-ready track record block for a symbol; empty string if none. */
export const getSymbolLessonsText = (symbol: string, currentPrice: number): string =>
  formatLessons(getSymbolLessons(symbol, currentPrice));
