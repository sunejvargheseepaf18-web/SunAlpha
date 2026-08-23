
// Advice journal — infrastructure for the feedback loop.
//
// Persists every issued HoldingAdvice with the price it was issued at
// (localStorage), and grades the journal against current prices using the
// pure domain engine. No decision logic lives here.

import { HoldingAdvice } from '../domain/advice/advice.types';
import {
  AdviceJournalEntry,
  gradeAdviceJournal,
  JournalScorecard
} from '../domain/advice/journal.engine';
import { PortfolioPosition } from '../types';

const STORAGE_KEY = 'sunalpha.advice.journal';
const MAX_ENTRIES = 500; // keep the journal bounded

export const loadJournal = (): AdviceJournalEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AdviceJournalEntry[]) : [];
  } catch {
    return [];
  }
};

const saveJournal = (entries: AdviceJournalEntry[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // storage unavailable — journaling is best-effort, never blocks advice
  }
};

/**
 * Record today's advices. One entry per symbol per day: re-running the
 * dashboard on the same day updates that day's entry instead of stacking
 * duplicates, so grading isn't skewed by refresh counts.
 */
export const recordAdvices = (
  advices: HoldingAdvice[],
  positions: PortfolioPosition[]
): void => {
  const today = new Date().toISOString().split('T')[0];
  const priceBySymbol = new Map(positions.map(p => [p.symbol, p.currentPrice]));

  const journal = loadJournal().filter(
    e => !(e.date === today && advices.some(a => a.symbol === e.symbol))
  );

  for (const advice of advices) {
    const price = priceBySymbol.get(advice.symbol);
    if (price === undefined || price <= 0) continue;
    journal.push({
      id: `${advice.symbol}-${today}`,
      date: today,
      symbol: advice.symbol,
      chip: advice.chip,
      action: advice.action,
      priceAtAdvice: price,
      plannedQuantity: advice.plan?.quantity,
      plannedRate: advice.plan?.rate
    });
  }

  saveJournal(journal);
};

/**
 * Grade all past advice against current prices. Excludes entries issued
 * today (no time has passed to judge them).
 */
export const gradeJournal = (positions: PortfolioPosition[]): JournalScorecard => {
  const today = new Date().toISOString().split('T')[0];
  const pastEntries = loadJournal().filter(e => e.date !== today);
  const currentPrices = Object.fromEntries(positions.map(p => [p.symbol, p.currentPrice]));
  return gradeAdviceJournal(pastEntries, currentPrices);
};
