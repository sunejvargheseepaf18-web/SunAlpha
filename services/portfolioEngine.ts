
import { PortfolioPosition, Insight, PortfolioHistoryPoint, ExecutionMode } from '../types';
import { MOCK_HOLDINGS_DATA } from '../constants';
import { getVirtualPositions, initializePaperAccount } from './paper/paperStore';
import { getLatestNavByName } from './mfNavService';
import { getLiveQuotes } from './marketFeed';
import { getCryptoQuotes } from './cryptoFeed';
import { generateHoldingAdvices, generateRedeploymentPlan } from '../domain/advice/advice.engine';
import {
  HoldingAdvice,
  MarketSignal,
  RedeployCandidate,
  RedeploymentPlan
} from '../domain/advice/advice.types';

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

// Mock market data for redeployment fallbacks (this app has no live equity
// feed yet; replace with real quotes when the broker service goes live).
const NIFTYBEES_PRICE = 280.5;
const NIFTY_HEDGE_MARGIN_PER_LOT = 38600; // ≈16% of 1-lot notional
const NIFTY_LOT_SIZE = 75;

/**
 * Companion to getHoldingAdvices: when the advices free cash (trims/exits),
 * suggest where it goes next — bullish-signal holdings first, then a
 * diversified index ETF, then margin for a NIFTY short hedge. Every
 * suggestion carries exact quantity, rate and amount.
 */
export const getRedeploymentPlan = (
  advices: HoldingAdvice[],
  positions: PortfolioPosition[]
): RedeploymentPlan => {
  const candidates: RedeployCandidate[] = [];

  // 1. Holdings the market is bullish on (and that we're not selling)
  for (const advice of advices) {
    if (advice.action !== 'HOLD' && advice.action !== 'ADD') continue;
    if (!['STRONG BUY', 'BUY', 'ACCUMULATE'].includes(advice.signal)) continue;
    const pos = positions.find(p => p.symbol === advice.symbol);
    if (!pos || pos.currentPrice <= 0) continue;
    candidates.push({
      symbol: pos.symbol,
      name: pos.name,
      kind: pos.assetType === 'MF' ? 'MF' : 'STOCK',
      rate: pos.currentPrice,
      reason: `Market signal ${advice.signal} on an existing holding.`,
      maxAllocationPct: 30
    });
  }

  // 2. Diversified index exposure — the default home for trim proceeds
  candidates.push({
    symbol: 'NIFTYBEES',
    name: 'Nippon India Nifty 50 BeES ETF',
    kind: 'ETF',
    rate: NIFTYBEES_PRICE,
    reason: 'Replaces single-stock concentration with diversified index exposure.',
    maxAllocationPct: 60
  });

  // 3. Derivatives: margin for a NIFTY short hedge while the book is unwound
  candidates.push({
    symbol: 'NIFTY-SHORT-HEDGE',
    name: 'NIFTY short futures hedge',
    kind: 'DERIVATIVE_HEDGE',
    rate: NIFTY_HEDGE_MARGIN_PER_LOT,
    lotSize: NIFTY_LOT_SIZE,
    reason: 'Protects remaining equity exposure during the rebalance.',
    maxAllocationPct: 25
  });

  return generateRedeploymentPlan(advices, candidates);
};

const withPrice = (
  pos: PortfolioPosition,
  price: number,
  priceSource: 'LIVE_NAV' | 'LIVE_QUOTE',
  priceAsOf: string
): PortfolioPosition => {
  const currentValue = pos.quantity * price;
  return {
    ...pos,
    currentPrice: parseFloat(price.toFixed(4)),
    currentValue: parseFloat(currentValue.toFixed(2)),
    pnl: parseFloat((currentValue - pos.investedValue).toFixed(2)),
    pnlPercent: parseFloat(
      (((currentValue - pos.investedValue) / pos.investedValue) * 100).toFixed(2)
    ),
    priceSource,
    priceAsOf
  };
};

// Re-price positions from live feeds: MFs from the AMFI NAV feed, equities
// from the market quote feed. Positions the feeds can't answer are returned
// unchanged so the portfolio still renders on their fallback price.
const repriceWithLiveFeeds = async (
  positions: PortfolioPosition[]
): Promise<PortfolioPosition[]> => {
  const equitySymbols = positions.filter(p => p.assetType === 'STOCK').map(p => p.symbol);
  const cryptoSymbols = positions.filter(p => p.assetType === 'CRYPTO').map(p => p.symbol);
  const [equityQuotes, cryptoQuotes] = await Promise.all([
    getLiveQuotes(equitySymbols),
    getCryptoQuotes(cryptoSymbols)
  ]);

  return Promise.all(
    positions.map(async (pos) => {
      if (pos.assetType === 'STOCK') {
        const quote = equityQuotes.get(pos.symbol);
        return quote ? withPrice(pos, quote.price, 'LIVE_QUOTE', quote.asOf) : pos;
      }
      if (pos.assetType === 'CRYPTO') {
        const quote = cryptoQuotes.get(pos.symbol);
        return quote ? withPrice(pos, quote.price, 'LIVE_QUOTE', quote.asOf) : pos;
      }
      if (pos.assetType === 'MF') {
        const latest = await getLatestNavByName(pos.name || pos.symbol);
        return latest ? withPrice(pos, latest.nav, 'LIVE_NAV', latest.date) : pos;
      }
      return pos;
    })
  );
};

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
      // Ensure store is ready. Positions come out at cost; the live
      // repricing below marks them to real market quotes (Alpaca paper
      // principle: real prices, simulated fills — no fake fluctuations).
      await initializePaperAccount();
      positions = getVirtualPositions();

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

  // Re-price from live feeds: AMFI NAVs for MFs, market quotes for equities.
  positions = await repriceWithLiveFeeds(positions);

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
