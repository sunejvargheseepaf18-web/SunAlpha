
// Fundamental quality engine (pure domain logic).
//
// A Piotroski-style checklist adapted to the fundamentals this app carries:
// the original F-Score's nine binary signals (profitability, leverage &
// liquidity, operating efficiency) re-expressed over ROE/ROCE/margins,
// growth, balance-sheet strength, cash conversion and Indian-market
// governance (promoter pledging). Each check is a transparent pass/fail
// row — the score is just the count of passes, never a black box.
//
// Also here: the Sustainalytics ESG *risk* interpretation bands (lower is
// better) so the UI never re-invents them.

import { FundamentalData } from '../../types';

export interface QualityCheck {
  id: string;
  label: string;
  /** Human-readable actual value, e.g. "18.4%" or "0.35x" */
  actual: string;
  /** The bar to clear, e.g. "> 12%" */
  threshold: string;
  pass: boolean;
}

export type QualityGrade = 'STRONG' | 'AVERAGE' | 'WEAK';

export interface QualityReport {
  symbol: string;
  score: number; // 0-9 passes
  maxScore: number; // always 9
  grade: QualityGrade;
  checks: QualityCheck[];
  summary: string;
}

const pctFmt = (v: number): string => `${v.toFixed(1)}%`;
const xFmt = (v: number): string => `${v.toFixed(2)}x`;

/**
 * Nine-point quality checklist over a FundamentalData snapshot.
 * Deterministic: same inputs, same score.
 */
export const computeQualityScore = (data: FundamentalData): QualityReport => {
  const checks: QualityCheck[] = [
    {
      id: 'roe',
      label: 'Return on equity',
      actual: pctFmt(data.roe),
      threshold: '> 12%',
      pass: data.roe > 12
    },
    {
      id: 'npm',
      label: 'Net profit margin',
      actual: pctFmt(data.npm),
      threshold: '> 8%',
      pass: data.npm > 8
    },
    {
      id: 'roce',
      label: 'Return on capital employed',
      actual: pctFmt(data.roce),
      threshold: '> 15%',
      pass: data.roce > 15
    },
    {
      id: 'revenue-growth',
      label: 'Revenue growth (3Y)',
      actual: pctFmt(data.revenueGrowth3Y),
      threshold: '> 8%',
      pass: data.revenueGrowth3Y > 8
    },
    {
      id: 'profit-growth',
      label: 'Profit growth (3Y)',
      actual: pctFmt(data.profitGrowth3Y),
      threshold: '> 10%',
      pass: data.profitGrowth3Y > 10
    },
    {
      id: 'leverage',
      label: 'Debt to equity',
      actual: xFmt(data.debtToEquity),
      threshold: '< 1.0x',
      pass: data.debtToEquity < 1
    },
    {
      id: 'solvency',
      label: 'Interest cover & liquidity',
      actual: `${data.interestCoverage.toFixed(1)}x cover, CR ${data.currentRatio.toFixed(2)}`,
      threshold: 'cover > 3x and CR > 1.2',
      pass: data.interestCoverage > 3 && data.currentRatio > 1.2
    },
    {
      id: 'cash-conversion',
      label: 'FCF conversion of profit',
      actual: pctFmt(data.freeCashFlowConversion * 100),
      threshold: '> 80%',
      pass: data.freeCashFlowConversion > 0.8
    },
    {
      id: 'pledging',
      label: 'Promoter pledged shares',
      actual: pctFmt(data.pledgedShares),
      threshold: '= 0%',
      pass: data.pledgedShares === 0
    }
  ];

  const score = checks.filter(c => c.pass).length;
  const grade: QualityGrade = score >= 7 ? 'STRONG' : score >= 4 ? 'AVERAGE' : 'WEAK';

  const failed = checks.filter(c => !c.pass).map(c => c.label.toLowerCase());
  const summary =
    grade === 'STRONG'
      ? `High-quality business: ${score}/9 checks pass.`
      : grade === 'AVERAGE'
        ? `Mixed quality (${score}/9). Watch: ${failed.slice(0, 3).join(', ')}.`
        : `Weak fundamentals (${score}/9). Fails: ${failed.slice(0, 4).join(', ')}.`;

  return { symbol: data.symbol, score, maxScore: 9, grade, checks, summary };
};

// --- ESG risk interpretation (Sustainalytics bands, lower = better) ----------

export type EsgRiskBand = 'NEGLIGIBLE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'SEVERE';

export const classifyEsgRisk = (totalEsg: number): EsgRiskBand =>
  totalEsg < 10 ? 'NEGLIGIBLE'
  : totalEsg < 20 ? 'LOW'
  : totalEsg < 30 ? 'MEDIUM'
  : totalEsg < 40 ? 'HIGH'
  : 'SEVERE';
