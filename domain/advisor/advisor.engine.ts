
// Portfolio advisor engine (pure domain logic).
//
// A robo-advisor "portfolio checkup" in the open-source tradition
// (VanAurum/robo-advisor, WalletLens-style insight feeds, FinRobot-style
// analyst reports): a deterministic battery of checks over the REAL
// holdings snapshot, each producing an evidence-backed finding with exact
// rupee amounts — replacing hardcoded "AI insights" that named sectors the
// portfolio doesn't hold. An LLM may NARRATE these findings afterwards;
// it never invents them (AGENT_RULES: AI is advisory, decisions are
// deterministic).

export interface AdvisorPosition {
  symbol: string;
  name: string;
  assetType: 'STOCK' | 'MF' | 'GOLD' | 'CRYPTO';
  investedValue: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
}

export interface AdvisorFinding {
  id: string;
  type: 'RISK' | 'OPPORTUNITY' | 'INFO';
  title: string;
  description: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface PortfolioReview {
  healthScore: number; // 0-100, starts at 100 and pays for findings
  grade: 'HEALTHY' | 'NEEDS_ATTENTION' | 'AT_RISK';
  findings: AdvisorFinding[]; // HIGH first
  totalValue: number;
}

export interface AdvisorOptions {
  /** A single position above this % of the portfolio is concentration risk. */
  maxSingleHoldingPct?: number; // default 18
  /** Crypto above this % of the portfolio is over-allocated. */
  maxCryptoPct?: number; // default 10
  /** Fewer distinct positions than this is under-diversified. */
  minPositions?: number; // default 5
  /** A loss deeper than this % (and beyond min value) is a harvest candidate. */
  harvestLossPct?: number; // default 10
  /** Ignore harvest candidates smaller than this loss in rupees. */
  minHarvestLossValue?: number; // default 2000
  /** A winner beyond this % gain is a trim-review candidate. */
  bigWinnerPct?: number; // default 40
}

const IMPACT_COST: Record<AdvisorFinding['impact'], number> = {
  HIGH: 15,
  MEDIUM: 8,
  LOW: 3
};

const inr = (v: number): string => `₹${Math.round(Math.abs(v)).toLocaleString('en-IN')}`;

/**
 * Deterministic portfolio review: same holdings, same findings.
 * Findings carry exact percentages and rupee amounts so every claim is
 * checkable against the holdings table.
 */
export const reviewPortfolio = (
  positions: AdvisorPosition[],
  options: AdvisorOptions = {}
): PortfolioReview => {
  const maxSinglePct = options.maxSingleHoldingPct ?? 18;
  const maxCryptoPct = options.maxCryptoPct ?? 10;
  const minPositions = options.minPositions ?? 5;
  const harvestLossPct = options.harvestLossPct ?? 10;
  const minHarvestLossValue = options.minHarvestLossValue ?? 2000;
  const bigWinnerPct = options.bigWinnerPct ?? 40;

  const findings: AdvisorFinding[] = [];
  const totalValue = positions.reduce((s, p) => s + p.currentValue, 0);

  if (positions.length === 0 || totalValue <= 0) {
    return { healthScore: 100, grade: 'HEALTHY', findings: [], totalValue: 0 };
  }

  // 1. Single-position concentration (exact excess in rupees)
  for (const pos of positions) {
    const weightPct = (pos.currentValue / totalValue) * 100;
    if (weightPct > maxSinglePct) {
      const excessValue = pos.currentValue - (maxSinglePct / 100) * totalValue;
      findings.push({
        id: `concentration-${pos.symbol}`,
        type: 'RISK',
        impact: weightPct > maxSinglePct * 1.5 ? 'HIGH' : 'MEDIUM',
        title: `${pos.symbol} is ${weightPct.toFixed(1)}% of the portfolio`,
        description: `${pos.name} exceeds the ${maxSinglePct}% single-position limit. Trimming ${inr(excessValue)} would bring it back inside the cap.`
      });
    }
  }

  // 2. Crypto over-allocation
  const cryptoValue = positions
    .filter(p => p.assetType === 'CRYPTO')
    .reduce((s, p) => s + p.currentValue, 0);
  const cryptoPct = (cryptoValue / totalValue) * 100;
  if (cryptoPct > maxCryptoPct) {
    findings.push({
      id: 'crypto-allocation',
      type: 'RISK',
      impact: cryptoPct > maxCryptoPct * 2 ? 'HIGH' : 'MEDIUM',
      title: `Crypto is ${cryptoPct.toFixed(1)}% of the portfolio`,
      description: `Crypto exposure (${inr(cryptoValue)}) exceeds the ${maxCryptoPct}% guideline for a volatile, unregulated asset class taxed at a flat 30% with no loss offsets.`
    });
  }

  // 3. Diversification breadth
  if (positions.length < minPositions) {
    findings.push({
      id: 'diversification-count',
      type: 'RISK',
      impact: 'MEDIUM',
      title: `Only ${positions.length} positions`,
      description: `Fewer than ${minPositions} holdings concentrates idiosyncratic risk. Consider a diversified index fund as the core.`
    });
  }
  const classes = new Set(positions.map(p => p.assetType));
  if (classes.size === 1 && positions.length > 0) {
    findings.push({
      id: 'single-asset-class',
      type: 'RISK',
      impact: 'MEDIUM',
      title: `Everything is in one asset class (${[...classes][0]})`,
      description: 'A single-asset-class portfolio has no diversification across market regimes. Consider adding a second class (equity/MF/gold).'
    });
  }

  // 4. Tax-loss harvest candidates (exact loss amounts)
  for (const pos of positions) {
    if (pos.pnlPercent <= -harvestLossPct && Math.abs(pos.pnl) >= minHarvestLossValue) {
      findings.push({
        id: `harvest-${pos.symbol}`,
        type: 'OPPORTUNITY',
        impact: 'MEDIUM',
        title: `${pos.symbol} carries a ${inr(pos.pnl)} unrealized loss`,
        description: `${pos.name} is down ${Math.abs(pos.pnlPercent).toFixed(1)}%. Harvesting books the loss to offset taxable gains; the Tax dashboard has the exact quantities.`
      });
    }
  }

  // 5. Big winners — review, don't auto-sell
  for (const pos of positions) {
    if (pos.pnlPercent >= bigWinnerPct) {
      findings.push({
        id: `winner-${pos.symbol}`,
        type: 'INFO',
        impact: 'LOW',
        title: `${pos.symbol} is up ${pos.pnlPercent.toFixed(1)}%`,
        description: `${pos.name} has gained ${inr(pos.pnl)}. Winners grow into concentration risk — check its weight and rebalance bands.`
      });
    }
  }

  // 6. Aggregate drawdown on invested capital
  const totalInvested = positions.reduce((s, p) => s + p.investedValue, 0);
  const totalPnlPct = totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0;
  if (totalPnlPct <= -10) {
    findings.push({
      id: 'portfolio-drawdown',
      type: 'RISK',
      impact: 'HIGH',
      title: `Portfolio is down ${Math.abs(totalPnlPct).toFixed(1)}% on invested capital`,
      description: `Unrealized loss of ${inr(totalValue - totalInvested)} across the book. Check the risk circuit breaker before adding new positions.`
    });
  }

  // 7. Dust positions — complexity without impact
  const dust = positions.filter(p => (p.currentValue / totalValue) * 100 < 1 && positions.length > 3);
  if (dust.length > 0) {
    findings.push({
      id: 'dust-positions',
      type: 'INFO',
      impact: 'LOW',
      title: `${dust.length} position${dust.length > 1 ? 's' : ''} under 1% of the portfolio`,
      description: `${dust.map(d => d.symbol).join(', ')} ${dust.length > 1 ? 'are' : 'is'} too small to move returns but still add monitoring load. Consolidate or exit.`
    });
  }

  // Order: HIGH risks first, then MEDIUM, then the rest.
  const rank: Record<AdvisorFinding['impact'], number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  findings.sort((a, b) => rank[a.impact] - rank[b.impact]);

  const healthScore = Math.max(
    0,
    Math.min(100, 100 - findings.reduce((s, f) => s + IMPACT_COST[f.impact], 0))
  );
  const grade: PortfolioReview['grade'] =
    healthScore >= 75 ? 'HEALTHY' : healthScore >= 50 ? 'NEEDS_ATTENTION' : 'AT_RISK';

  return { healthScore, grade, findings, totalValue: parseFloat(totalValue.toFixed(2)) };
};
