
// AI portfolio advisor service.
//
// Deterministic first, narrative second: the pure advisor engine computes
// evidence-backed findings from the real holdings snapshot (exact rupee
// amounts), then a WORKER-tier model may write a short adviser's note over
// the digested findings. The note is advisory color — offline, the
// findings stand alone and nothing degrades.

import { PortfolioPosition, Insight } from '../types';
import {
  reviewPortfolio,
  PortfolioReview,
  AdvisorPosition
} from '../domain/advisor/advisor.engine';
import { runWorkerBrief } from './ai/llm';
import { digest } from './ai/contextDigest';

export type { PortfolioReview };

export interface AdvisorReport {
  review: PortfolioReview;
  /** One-paragraph adviser's note from the AI, null when offline. */
  narrative: string | null;
}

const toAdvisorPosition = (p: PortfolioPosition): AdvisorPosition => ({
  symbol: p.symbol,
  name: p.name,
  assetType: p.assetType,
  investedValue: p.investedValue,
  currentValue: p.currentValue,
  pnl: p.pnl,
  pnlPercent: p.pnlPercent
});

/** Findings are Insight-shaped by design — one mapping, no re-derivation. */
export const findingsToInsights = (review: PortfolioReview): Insight[] =>
  review.findings.map(f => ({
    id: f.id,
    type: f.type,
    title: f.title,
    description: f.description,
    impact: f.impact
  }));

export const getAdvisorReport = async (
  positions: PortfolioPosition[]
): Promise<AdvisorReport> => {
  const review = reviewPortfolio(positions.map(toAdvisorPosition));

  let narrative: string | null = null;
  if (review.findings.length > 0) {
    const response = await runWorkerBrief<{ note: string }>(
      {
        role: 'Portfolio Adviser',
        task: "Write a 3-sentence adviser's note summarizing this portfolio review for the owner.",
        acceptanceCriteria: [
          'Mention the health score and the single most important finding first.',
          'Only reference findings listed in the context — never invent holdings or numbers.',
          'Plain language, no hedging boilerplate, max 80 words.'
        ],
        context: {
          healthScore: String(review.healthScore),
          grade: review.grade,
          findings: digest(
            review.findings.map(f => ({ impact: f.impact, title: f.title })),
            900
          )
        }
      },
      {
        type: 'object',
        properties: { note: { type: 'string' } },
        required: ['note']
      }
    );
    narrative = response.success && response.data?.note ? response.data.note : null;
  }

  return { review, narrative };
};
