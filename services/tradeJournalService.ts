
// Trade journal — infrastructure. Persists closed trades (localStorage) and
// serves the deterministic scorecard from the pure journal engine. Paper
// SELLs are auto-journaled by the virtual execution engine so the journal
// fills itself while practicing.

import {
  computeJournalStats,
  JournalStats,
  JournalTrade
} from '../domain/journal/tradeJournal.engine';

const STORAGE_KEY = 'sunalpha.trade.journal';
const MAX_TRADES = 1000;

export const loadTrades = (): JournalTrade[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as JournalTrade[]) : [];
  } catch {
    return [];
  }
};

const save = (trades: JournalTrade[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trades.slice(-MAX_TRADES)));
  } catch {
    // storage unavailable — journaling is best-effort
  }
};

export const recordClosedTrade = (trade: JournalTrade): void => {
  const trades = loadTrades();
  if (trades.some(t => t.id === trade.id)) return; // idempotent
  trades.push(trade);
  save(trades);
};

/** Attach/replace tags on an existing journal entry (setup, mistakes). */
export const tagTrade = (
  id: string,
  tags: { setup?: string; mistakes?: string[] }
): boolean => {
  const trades = loadTrades();
  const t = trades.find(x => x.id === id);
  if (!t) return false;
  if (tags.setup !== undefined) t.setup = tags.setup;
  if (tags.mistakes !== undefined) t.mistakes = tags.mistakes;
  save(trades);
  return true;
};

export const getJournalStats = (): JournalStats => computeJournalStats(loadTrades());
