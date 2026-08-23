
// Bull vs Bear debate engine (adapted from the TradingAgents pattern).
//
// Instead of one model emitting a verdict, two WORKER agents argue opposite
// sides from the same digested evidence, and a PLANNER judge reads their two
// one-page cases — never the raw data — and issues a MarketSignal with
// confidence. The signal feeds the advice engine as its `signals` input;
// per AGENT_RULES the debate never generates orders or executes anything.

import { Type } from '@google/genai';
import { generateJSON, runWorkerBrief } from './llm';
import { digest } from './contextDigest';
import { MarketSignal } from '../../domain/advice/advice.types';

export interface DebateCase {
  thesis: string; // one-sentence core argument
  points: string[]; // evidence-backed supporting points
}

export interface DebateVerdict {
  signal: MarketSignal;
  confidence: number; // 0-100
  bullPoints: string[]; // strongest surviving bull arguments
  bearPoints: string[]; // strongest surviving bear arguments
  reasoning: string; // judge's synthesis, 2-3 sentences
}

const caseSchema = {
  type: Type.OBJECT,
  properties: {
    thesis: { type: Type.STRING },
    points: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ['thesis', 'points']
};

const verdictSchema = {
  type: Type.OBJECT,
  properties: {
    signal: {
      type: Type.STRING,
      enum: ['STRONG BUY', 'BUY', 'ACCUMULATE', 'HOLD', 'REDUCE', 'SELL', 'AVOID']
    },
    confidence: { type: Type.NUMBER },
    bullPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
    bearPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
    reasoning: { type: Type.STRING }
  },
  required: ['signal', 'confidence', 'bullPoints', 'bearPoints', 'reasoning']
};

const RESEARCH_CRITERIA = [
  'Every point must cite a fact from the provided context — no invented data',
  'Acknowledge the single strongest opposing fact and address it',
  'Maximum 5 points, each one sentence',
  'No hedging language; argue the assigned side as strongly as the evidence allows'
];

/**
 * Run one bull-vs-bear debate for a symbol over pre-assembled context
 * (technical scores, fundamentals, regime, position info — anything).
 * Returns null when the AI is offline or any stage fails: callers fall back
 * to the deterministic conviction verdict, never to a guessed signal.
 */
export const runBullBearDebate = async (
  symbol: string,
  context: Record<string, unknown>
): Promise<DebateVerdict | null> => {
  try {
    // Digest once; both researchers argue from identical evidence.
    const digested = Object.fromEntries(
      Object.entries(context).map(([k, v]) => [k, digest(v, 700)])
    );

    const [bull, bear] = await Promise.all([
      runWorkerBrief<DebateCase>(
        {
          role: 'Bull Researcher',
          task: `Build the strongest evidence-based BULLISH case for ${symbol}.`,
          acceptanceCriteria: RESEARCH_CRITERIA,
          context: digested
        },
        caseSchema
      ),
      runWorkerBrief<DebateCase>(
        {
          role: 'Bear Researcher',
          task: `Build the strongest evidence-based BEARISH case for ${symbol}, challenging optimistic assumptions.`,
          acceptanceCriteria: RESEARCH_CRITERIA,
          context: digested
        },
        caseSchema
      )
    ]);

    if (!bull.success || !bear.success || !bull.data || !bear.data) return null;

    // The judge reads the two one-page cases only — never the raw context.
    const judgePrompt = [
      `ROLE: Debate Judge / Head of Research`,
      `TASK: Weigh the bull and bear cases for ${symbol} and issue one signal.`,
      `RULES:`,
      `1. Judge only the arguments below; do not introduce new facts.`,
      `2. Discard any point that is not evidence-backed.`,
      `3. Confidence reflects how one-sided the surviving evidence is (50 = balanced).`,
      `4. This signal is advisory input to a portfolio advice engine — it does not execute trades.`,
      `BULL CASE: ${digest(bull.data, 900)}`,
      `BEAR CASE: ${digest(bear.data, 900)}`
    ].join('\n');

    const verdict = await generateJSON<DebateVerdict>(judgePrompt, verdictSchema, 'PLANNER');
    if (!verdict.success || !verdict.data) return null;

    // Clamp confidence defensively before anything downstream reads it.
    verdict.data.confidence = Math.max(0, Math.min(100, verdict.data.confidence));
    return verdict.data;
  } catch {
    return null; // offline / provider error — deterministic engines take over
  }
};

/**
 * Convenience: debate several holdings and return a signals map ready to
 * pass to portfolioEngine.getHoldingAdvices. Symbols whose debate fails are
 * simply absent — the advice engine treats them as HOLD-by-default.
 */
export const debateSignals = async (
  contexts: Record<string, Record<string, unknown>>
): Promise<Record<string, MarketSignal>> => {
  const symbols = Object.keys(contexts);
  const verdicts = await Promise.all(symbols.map(s => runBullBearDebate(s, contexts[s])));
  const signals: Record<string, MarketSignal> = {};
  symbols.forEach((s, i) => {
    const v = verdicts[i];
    if (v) signals[s] = v.signal;
  });
  return signals;
};
