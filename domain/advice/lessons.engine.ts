
// Reflection lessons (pure domain logic).
//
// The FinMem/TradingAgents insight: an agent improves only if graded past
// outcomes are fed back into future reasoning. SunAlpha's version keeps the
// reflection DETERMINISTIC (FinRobot principle: numbers from pure compute,
// LLMs for reasoning): lessons are extracted from the graded advice journal
// by plain aggregation, then digested into debate briefs and the judge's
// input as labeled track-record lines. No model ever invents an outcome.

import { JournalScorecard } from './journal.engine';

export interface AdviceLesson {
  key: string; // "SELL:M&M" or "OVERALL:BUY"
  symbol: string | null; // null for overall lessons
  chip: 'HOLD' | 'SELL' | 'BUY';
  samples: number;
  correct: number;
  hitRatePct: number;
  avgReturnPct: number; // mean price move after the advice
  text: string; // one prompt-ready line
}

export interface LessonOptions {
  minSamples?: number; // groups smaller than this teach nothing yet
  maxLessons?: number; // keep prompt injection bounded
}

const lessonText = (
  scope: string,
  chip: string,
  correct: number,
  samples: number,
  avgReturnPct: number
): string =>
  `${chip} advice ${scope}: ${correct}/${samples} pointed the right way; ` +
  `price moved ${avgReturnPct >= 0 ? '+' : ''}${avgReturnPct.toFixed(1)}% on average afterwards.`;

export const extractLessons = (
  scorecard: JournalScorecard,
  options: LessonOptions = {}
): AdviceLesson[] => {
  const minSamples = options.minSamples ?? 2;
  const maxLessons = options.maxLessons ?? 8;

  interface Bucket {
    symbol: string | null;
    chip: AdviceLesson['chip'];
    samples: number;
    correct: number;
    returnSum: number;
  }
  const buckets = new Map<string, Bucket>();

  const add = (key: string, symbol: string | null, chip: AdviceLesson['chip'], correct: boolean, returnPct: number) => {
    const b = buckets.get(key) ?? { symbol, chip, samples: 0, correct: 0, returnSum: 0 };
    b.samples += 1;
    if (correct) b.correct += 1;
    b.returnSum += returnPct;
    buckets.set(key, b);
  };

  for (const e of scorecard.entries) {
    add(`${e.chip}:${e.symbol}`, e.symbol, e.chip, e.correct, e.returnPct);
    add(`OVERALL:${e.chip}`, null, e.chip, e.correct, e.returnPct);
  }

  const lessons: AdviceLesson[] = [];
  for (const [key, b] of buckets) {
    if (b.samples < minSamples) continue;
    const avgReturnPct = parseFloat((b.returnSum / b.samples).toFixed(2));
    lessons.push({
      key,
      symbol: b.symbol,
      chip: b.chip,
      samples: b.samples,
      correct: b.correct,
      hitRatePct: parseFloat(((b.correct / b.samples) * 100).toFixed(1)),
      avgReturnPct,
      text: lessonText(
        b.symbol ? `on ${b.symbol}` : 'across all holdings',
        b.chip,
        b.correct,
        b.samples,
        avgReturnPct
      )
    });
  }

  // Most-evidenced lessons first; symbol-specific before overall on ties.
  lessons.sort((a, b) => b.samples - a.samples || (a.symbol === null ? 1 : 0) - (b.symbol === null ? 1 : 0));
  return lessons.slice(0, maxLessons);
};

/** Prompt-ready block of lesson lines; empty string when nothing was learned yet. */
export const formatLessons = (lessons: AdviceLesson[]): string =>
  lessons.map(l => `- ${l.text}`).join('\n');
