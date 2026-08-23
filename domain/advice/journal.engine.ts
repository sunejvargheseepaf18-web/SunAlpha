
// Advice journal grading (pure domain logic — no storage, no clock, no I/O).
//
// The feedback loop from the TradingAgents pattern: every advice the system
// issues is journaled with the price it was issued at; later, grading against
// current prices tells us whether the advice pointed the right way. The
// scorecard is deterministic so it can feed future AI briefs (digested) or
// render in the UI without any model in the loop.

export interface AdviceJournalEntry {
  id: string;
  date: string; // ISO yyyy-MM-dd the advice was issued
  symbol: string;
  chip: 'HOLD' | 'SELL' | 'BUY';
  action: string; // HOLD | TRIM | EXIT | ADD
  priceAtAdvice: number; // price/NAV when the advice was issued
  plannedQuantity?: number;
  plannedRate?: number;
}

export interface GradedEntry extends AdviceJournalEntry {
  currentPrice: number;
  returnPct: number; // move since the advice, in %
  correct: boolean;
}

export interface JournalScorecard {
  total: number; // entries in the journal
  graded: number; // entries with a known current price
  correct: number;
  hitRatePct: number; // correct / graded
  avgReturnPct: number; // mean move across graded entries
  entries: GradedEntry[];
}

// A HOLD is "correct" while the price stays inside this band.
const HOLD_BAND_PCT = 5;

const isCorrect = (chip: AdviceJournalEntry['chip'], returnPct: number): boolean => {
  if (chip === 'SELL') return returnPct <= 0; // advised out before a fall (or flat)
  if (chip === 'BUY') return returnPct >= 0; // advised in before a rise (or flat)
  return Math.abs(returnPct) < HOLD_BAND_PCT; // HOLD: no big move missed
};

export const gradeAdviceJournal = (
  entries: AdviceJournalEntry[],
  currentPrices: Record<string, number>
): JournalScorecard => {
  const graded: GradedEntry[] = [];

  for (const entry of entries) {
    const currentPrice = currentPrices[entry.symbol];
    if (currentPrice === undefined || currentPrice <= 0 || entry.priceAtAdvice <= 0) continue;

    const returnPct = ((currentPrice - entry.priceAtAdvice) / entry.priceAtAdvice) * 100;
    graded.push({
      ...entry,
      currentPrice,
      returnPct: parseFloat(returnPct.toFixed(2)),
      correct: isCorrect(entry.chip, returnPct)
    });
  }

  const correct = graded.filter(g => g.correct).length;
  return {
    total: entries.length,
    graded: graded.length,
    correct,
    hitRatePct: graded.length > 0 ? parseFloat(((correct / graded.length) * 100).toFixed(1)) : 0,
    avgReturnPct:
      graded.length > 0
        ? parseFloat((graded.reduce((s, g) => s + g.returnPct, 0) / graded.length).toFixed(2))
        : 0,
    entries: graded
  };
};
