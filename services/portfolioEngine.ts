
import { PortfolioPosition, Insight, PortfolioHistoryPoint, ExecutionMode } from '../types';
import { MOCK_HOLDINGS_DATA } from '../constants';
import { getVirtualPositions, initializePaperAccount } from './paper/paperStore';
import { getLatestNavByName } from './mfNavService';
import { generateHoldingAdvices } from '../domain/advice/advice.engine';
import { HoldingAdvice, MarketSignal } from '../domain/advice/advice.types';

/**
 * Single source of truth for the recommendation shown next to a holding —
 * every surface (Holdings, Universe, Rebalance) must render these advices,
 * never derive its own verdict, so a symbol can't say SELL in one view and
 * HOLD in another. `signals` is the market view per symbol (conviction
 * engine verdicts); portfolio context (concentration) is applied on top.
 */
export const getHoldingAdvices = (
  positions: PortfolioPosition[],
  signals: Record<string, MarketSignal> = {},
  maxSingleHoldingPct = 18
): HoldingAdvice[] =>
  generateHoldingAdvices(
    positions.map(p => ({
      symbol: p.symbol,
      name: p.name,
      assetType: p.assetType,
      quantity: p.quantity,
      currentPrice: p.currentPrice,
      currentValue: p.currentValue
    })),
    { maxSingleHoldingPct, signals }
  );

// Re-price MF positions from the live AMFI NAV feed. Positions that cannot be
// linked (bad name match, feed unreachable) are returned unchanged so the
// portfolio still renders — they just keep their fallback price.
const repriceMfPositionsWithLiveNav = async (
  positions: PortfolioPosition[]
): Promise<PortfolioPosition[]> =>
  Promise.all(
    positions.map(async (pos) => {
      if (pos.assetType !== 'MF') return pos;
      const latest = await getLatestNavByName(pos.name || pos.symbol);
      if (!latest) return pos;

      const currentValue = pos.quantity * latest.nav;
      return {
        ...pos,
        currentPrice: parseFloat(latest.nav.toFixed(4)),
        currentValue: parseFloat(currentValue.toFixed(2)),
        pnl: parseFloat((currentValue - pos.investedValue).toFixed(2)),
        pnlPercent: parseFloat(
          (((currentValue - pos.investedValue) / pos.investedValue) * 100).toFixed(2)
        ),
        priceSource: 'LIVE_NAV' as const,
        priceAsOf: latest.date
      };
    })
  );

export const calculatePortfolio = async (mode: ExecutionMode = 'LIVE'): Promise<{
  totalValue: number;
  totalInvested: number;
  totalPnl: number;
  dayPnl: number;
  positions: PortfolioPosition[];
}> => {
  // Simulate calculation delay
  await new Promise(r => setTimeout(r, 400));

  let positions: PortfolioPosition[] = [];

  if (mode === 'PAPER') {
      // Ensure store is ready
      await initializePaperAccount();
      const rawPositions = getVirtualPositions();
      
      // For paper, we want real-ish data but stable for the session unless updated
      positions = await Promise.all(rawPositions.map(async (p) => {
          // Stable fluctuation based on symbol char code
          const seed = p.symbol.charCodeAt(0);
          const fluctuation = (seed % 10 - 5); 
          const currentPrice = p.avgPrice + (p.avgPrice * 0.05) + fluctuation; 
          
          return {
              ...p,
              currentPrice: parseFloat(currentPrice.toFixed(2)),
              currentValue: parseFloat((p.quantity * currentPrice).toFixed(2)),
              pnl: parseFloat(((currentPrice - p.avgPrice) * p.quantity).toFixed(2)),
              pnlPercent: parseFloat((((currentPrice - p.avgPrice) / p.avgPrice) * 100).toFixed(2))
          };
      }));

  } else {
      // LIVE MODE — dummy holdings snapshot; equities priced at their last
      // traded price, MFs at purchase NAV until the live NAV link below runs.
      positions = MOCK_HOLDINGS_DATA.map((holding, idx) => {
        const currentPrice = holding.last ?? holding.avg;

        return {
          id: `pos-${idx}`,
          assetType: holding.assetType,
          symbol: holding.symbol,
          name: holding.name,
          quantity: holding.qty,
          avgPrice: holding.avg,
          currentPrice: parseFloat(currentPrice.toFixed(2)),
          investedValue: holding.qty * holding.avg,
          currentValue: parseFloat((holding.qty * currentPrice).toFixed(2)),
          pnl: parseFloat(((currentPrice - holding.avg) * holding.qty).toFixed(2)),
          pnlPercent: parseFloat((((currentPrice - holding.avg) / holding.avg) * 100).toFixed(2))
        };
      });
  }

  // Link MF holdings to their real latest NAV (equity pricing unchanged).
  positions = await repriceMfPositionsWithLiveNav(positions);

  const totalValue = positions.reduce((acc, pos) => acc + pos.currentValue, 0);
  const totalInvested = positions.reduce((acc, pos) => acc + pos.investedValue, 0);
  const totalPnl = totalValue - totalInvested;
  const dayPnl = totalValue * 0.012; 

  return {
    totalValue,
    totalInvested,
    totalPnl,
    dayPnl,
    positions
  };
};

export const fetchPortfolioHistory = async (months: number = 6): Promise<PortfolioHistoryPoint[]> => {
  await new Promise(r => setTimeout(r, 400));
  
  const history: PortfolioHistoryPoint[] = [];
  const now = new Date();
  
  // Starting normalized values
  let currentPortfolio = 100;
  let currentBenchmark = 100;
  
  // Go back 'months' and simulate forward
  const days = months * 30;
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);

  // Deterministic history generation
  for (let i = 0; i <= days; i += 2) { 
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    
    // Sine wave + trend for stable looking chart
    const trend = i * 0.05;
    const wave = Math.sin(i * 0.1) * 2;
    
    const portChange = trend + wave + (Math.random() * 0.5); 
    const benchChange = trend + (Math.random() * 0.5);

    history.push({
      date: date.toISOString().split('T')[0],
      portfolioValue: parseFloat((100 + portChange).toFixed(2)),
      benchmarkValue: parseFloat((100 + benchChange).toFixed(2))
    });
  }
  
  return history;
};

export const generateAIInsights = (): Insight[] => {
  return [
    {
      id: '1',
      type: 'RISK',
      title: 'High Sector Concentration',
      description: '65% of your equity portfolio is exposed to the Technology sector. Consider diversifying into FMCG or Pharma to lower volatility.',
      impact: 'HIGH'
    },
    {
      id: '2',
      type: 'OPPORTUNITY',
      title: 'Tax Harvesting',
      description: 'You have unrealized losses in 2 holdings that could offset your short-term capital gains tax liability for this year.',
      impact: 'MEDIUM'
    },
    {
      id: '3',
      type: 'INFO',
      title: 'Dividend Declared',
      description: 'Reliance Industries has declared a dividend of ₹10/share. Ex-date is next Tuesday.',
      impact: 'LOW'
    }
  ];
};
