
import { PortfolioPosition, Insight, PortfolioHistoryPoint, ExecutionMode } from '../types';
import { MOCK_HOLDINGS_DATA } from '../constants';
import { getVirtualPositions, initializePaperAccount } from './paper/paperStore';

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
      // LIVE MODE (Mock Data)
      positions = MOCK_HOLDINGS_DATA.map((holding, idx) => {
        // Stable mock fluctuation to prevent jittery UI on re-renders
        // We use a deterministic "random" based on symbol length to keep it constant per session
        const stableRandom = (holding.symbol.length % 5) / 10; // 0.0 to 0.4
        const fluctuation = stableRandom * 10; 
        const currentPrice = holding.avg + (holding.avg * 0.15) + fluctuation;
        
        return {
          id: `pos-${idx}`,
          assetType: idx % 3 === 0 ? 'STOCK' : 'MF',
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
