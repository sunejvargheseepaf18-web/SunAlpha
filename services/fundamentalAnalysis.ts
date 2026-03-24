import { FundamentalData, FAReport, FABucket, FundamentalDirection } from '../types';

// Helper to create buckets
const createBucket = (
  id: string,
  name: string,
  score: number,
  summary: string,
  metrics: any[]
): FABucket => {
  let direction: FundamentalDirection = 'NEUTRAL';
  if (score >= 70) direction = 'POSITIVE';
  if (score <= 40) direction = 'NEGATIVE';

  return { id, name, score, direction, summary, metrics };
};

export const generateFundamentalReport = (data: FundamentalData): FAReport => {
  
  // 1. Profitability
  const profitScore = Math.min(100, (data.roe / 20 * 40) + (data.npm / 15 * 60)); // Simplified weighting
  const profitability = createBucket(
    'profitability', 'Profitability', Math.round(profitScore),
    data.roe > 15 ? "High quality earnings with robust ROE." : "Profitability is below sector benchmarks.",
    [
      { name: 'ROE', value: `${data.roe.toFixed(1)}%`, benchmark: '>15%', status: data.roe > 15 ? 'POSITIVE' : 'NEGATIVE' },
      { name: 'Net Margin', value: `${data.npm.toFixed(1)}%`, status: data.npm > 10 ? 'POSITIVE' : 'NEUTRAL' }
    ]
  );

  // 2. Growth
  const growthScore = Math.min(100, (data.revenueGrowth3Y + data.profitGrowth3Y) * 2); 
  const growth = createBucket(
    'growth', 'Growth', Math.round(growthScore),
    data.profitGrowth3Y > 15 ? "Consistent double-digit growth." : "Growth is sluggish.",
    [
      { name: 'Rev Growth (3Y)', value: `${data.revenueGrowth3Y.toFixed(1)}%`, status: data.revenueGrowth3Y > 10 ? 'POSITIVE' : 'NEUTRAL' },
      { name: 'PAT Growth (3Y)', value: `${data.profitGrowth3Y.toFixed(1)}%`, status: data.profitGrowth3Y > 15 ? 'POSITIVE' : 'NEUTRAL' }
    ]
  );

  // 3. Financial Health
  let healthScore = 100;
  if (data.debtToEquity > 1) healthScore -= 30;
  if (data.interestCoverage < 5) healthScore -= 30;
  const financialHealth = createBucket(
    'health', 'Financial Health', Math.round(healthScore),
    healthScore > 80 ? "Fortress balance sheet." : "Leverage concerns present.",
    [
      { name: 'Debt/Equity', value: data.debtToEquity.toFixed(2), benchmark: '<1.0', status: data.debtToEquity < 1 ? 'POSITIVE' : 'NEGATIVE' },
      { name: 'Int. Coverage', value: data.interestCoverage.toFixed(1), benchmark: '>5', status: data.interestCoverage > 5 ? 'POSITIVE' : 'NEGATIVE' }
    ]
  );

  // 4. Cash Flow
  const cfScore = data.freeCashFlowConversion > 0.7 ? 85 : 40;
  const cashFlow = createBucket(
    'cashflow', 'Cash Flow Quality', cfScore,
    cfScore > 70 ? "Profits are converting to cash efficiently." : "Accounting profits not backed by cash.",
    [
      { name: 'FCF Conversion', value: `${(data.freeCashFlowConversion * 100).toFixed(0)}%`, benchmark: '>70%', status: data.freeCashFlowConversion > 0.7 ? 'POSITIVE' : 'NEGATIVE' }
    ]
  );

  // 5. Valuation
  let valScore = 50;
  const diffPe = data.peHistory - data.currentPe;
  valScore += diffPe * 2; // Higher score if current PE is lower than history
  valScore = Math.max(0, Math.min(100, valScore));
  
  const valuation = createBucket(
    'valuation', 'Valuation', Math.round(valScore),
    data.currentPe < data.peHistory ? "Trading below historical average." : "Valuation looks stretched.",
    [
      { name: 'P/E', value: data.currentPe.toFixed(1), benchmark: data.peHistory.toFixed(1), status: data.currentPe < data.peHistory ? 'POSITIVE' : 'NEGATIVE' },
      { name: 'PEG', value: data.pegRatio.toFixed(2), status: data.pegRatio < 1 ? 'POSITIVE' : 'NEUTRAL' }
    ]
  );

  // 6. Capital Allocation (Mock Logic)
  const allocScore = 65;
  const capitalAllocation = createBucket(
    'allocation', 'Capital Allocation', allocScore,
    "Management has a stable track record of reinvestment.",
    [{ name: 'Reinvestment Rate', value: 'High', status: 'POSITIVE' }]
  );

  // 7. Business Quality (Mock Logic)
  const qualityScore = data.npm > 15 ? 85 : 60;
  const businessQuality = createBucket(
    'quality', 'Business Quality', qualityScore,
    qualityScore > 80 ? "Strong moat with high margins." : "Competitive industry pressure.",
    [{ name: 'Moat', value: qualityScore > 80 ? 'Wide' : 'Narrow', status: qualityScore > 80 ? 'POSITIVE' : 'NEUTRAL' }]
  );

  // 8. Risk
  let riskScore = 80; // High score means LOW risk
  if (data.pledgedShares > 0) riskScore -= 40;
  if (data.promoterHolding < 30) riskScore -= 20;
  
  const risk = createBucket(
    'risk', 'Risk & Red Flags', Math.round(riskScore),
    riskScore > 70 ? "Clean corporate governance structure." : "Governance or pledge risks detected.",
    [
      { name: 'Promoter Hold', value: `${data.promoterHolding.toFixed(1)}%`, status: data.promoterHolding > 40 ? 'POSITIVE' : 'NEUTRAL' },
      { name: 'Pledged', value: `${data.pledgedShares.toFixed(1)}%`, status: data.pledgedShares === 0 ? 'POSITIVE' : 'NEGATIVE' }
    ]
  );

  // Overall Aggregation
  const allBuckets = [profitability, growth, financialHealth, cashFlow, valuation, capitalAllocation, businessQuality, risk];
  const avgScore = Math.round(allBuckets.reduce((sum, b) => sum + b.score, 0) / allBuckets.length);
  
  let overallDirection: FundamentalDirection = 'NEUTRAL';
  if (avgScore >= 70) overallDirection = 'POSITIVE';
  if (avgScore <= 45) overallDirection = 'NEGATIVE';

  return {
    symbol: data.symbol,
    overallScore: avgScore,
    overallDirection,
    summary: `Fundamentally ${overallDirection.toLowerCase()} with a score of ${avgScore}. ${profitability.summary} ${valuation.summary}`,
    buckets: {
      profitability,
      growth,
      financialHealth,
      cashFlow,
      valuation,
      capitalAllocation,
      businessQuality,
      risk
    }
  };
};
