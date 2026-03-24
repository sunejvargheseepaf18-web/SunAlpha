
import { StockData, MarketIndex, FundamentalData, MarketQuote, MarketPulse, OptionRadarItem, FailedSignal, MutualFundData } from '../types';
import { detectRegime } from './regimeEngine';

// Simulating API latency
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Generate realistic looking random walk data for charts
const generateHistory = (startPrice: number, days: number = 30) => {
  const history = [];
  let currentPrice = startPrice;
  const now = new Date();
  
  // Create open, high, low, close data
  for (let i = days; i > 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Daily volatility
    const volatility = startPrice * 0.02;
    const move = (Math.random() - 0.5) * volatility * 2;
    
    const open = parseFloat(currentPrice.toFixed(2));
    const close = parseFloat((open + move).toFixed(2));
    
    // High and Low based on Open/Close
    const high = parseFloat((Math.max(open, close) + Math.random() * volatility).toFixed(2));
    const low = parseFloat((Math.min(open, close) - Math.random() * volatility).toFixed(2));
    
    // Update current price for next day (gap simulation can be added here)
    currentPrice = close;
    
    history.push({
      date: date.toISOString().split('T')[0],
      open,
      high,
      low,
      close,
      volume: Math.floor(Math.random() * 1000000) + 500000
    });
  }
  return history;
};

// Generate smoother line data for Mutual Funds
const generateNAVHistory = (startNAV: number, days: number = 365) => {
    const history = [];
    let current = startNAV;
    const now = new Date();
    
    for (let i = days; i > 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        
        // MFs have lower volatility generally
        const change = (Math.random() - 0.45) * (startNAV * 0.015);
        current += change;
        
        history.push({
            date: date.toISOString().split('T')[0],
            value: parseFloat(current.toFixed(4))
        });
    }
    return history;
};

export const fetchMarketIndices = async (): Promise<MarketIndex[]> => {
  await delay(500); // Simulate network
  return [
    { name: "NIFTY 50", value: 22145.60, change: 124.30, percentChange: 0.56 },
    { name: "SENSEX", value: 73450.20, change: 350.15, percentChange: 0.48 },
    { name: "NASDAQ", value: 16200.45, change: -45.20, percentChange: -0.28 },
    { name: "GOLD", value: 62500.00, change: 120.00, percentChange: 0.19 },
  ];
};

export const fetchStockDetails = async (symbol: string): Promise<StockData> => {
  await delay(800);
  
  // Seedable-ish random based on symbol length
  const basePrice = symbol.length * 50 + 100; 
  const history = generateHistory(basePrice, 90);
  const latest = history[history.length - 1];
  const prev = history[history.length - 2];
  const change = latest.close - prev.close;
  
  return {
    symbol: symbol.toUpperCase(),
    name: getCompanyName(symbol),
    price: latest.close,
    change: parseFloat(change.toFixed(2)),
    changePercent: parseFloat(((change / prev.close) * 100).toFixed(2)),
    volume: 1250400,
    marketCap: "2.4T",
    peRatio: 24.5,
    sector: "Technology",
    history
  };
};

export const fetchMutualFundDetails = async (symbol: string): Promise<MutualFundData> => {
    await delay(600);
    
    // Infer category from name or mock it
    const isSmallCap = symbol.includes('SMALL');
    const isDebt = symbol.includes('DEBT') || symbol.includes('LIQUID');
    
    const baseNav = isSmallCap ? 150 : isDebt ? 45 : 85;
    const history = generateNAVHistory(baseNav, 365);
    const currentNav = history[history.length - 1].value;
    const prevNav = history[history.length - 2].value;
    
    return {
        schemeCode: `MF-${symbol.substring(0, 3)}`,
        fundName: getCompanyName(symbol),
        nav: currentNav,
        change: parseFloat((currentNav - prevNav).toFixed(2)),
        changePercent: parseFloat((((currentNav - prevNav) / prevNav) * 100).toFixed(2)),
        category: isSmallCap ? 'Equity - Small Cap' : isDebt ? 'Debt - Liquid' : 'Equity - Flexi Cap',
        risk: isSmallCap ? 'Very High' : isDebt ? 'Low' : 'High',
        expenseRatio: isSmallCap ? 0.85 : 0.45,
        aum: '12,450 Cr',
        minSip: 500,
        returns: {
            '1Y': isSmallCap ? 35.4 : 8.5,
            '3Y': isSmallCap ? 28.2 : 7.1,
            '5Y': isSmallCap ? 22.5 : 6.8
        },
        history
    };
};

// Batch fetch for Watchlists
export const fetchQuotes = async (symbols: string[]): Promise<MarketQuote[]> => {
    await delay(300);
    return symbols.map(sym => {
        // Consistent-ish random data
        const seed = sym.length; 
        const basePrice = seed * 150 + 50;
        const volatility = (seed % 3) + 1;
        const change = (Math.random() - 0.45) * volatility * 10;
        const price = basePrice + change;
        const changePercent = (change / basePrice) * 100;

        return {
            symbol: sym,
            price: parseFloat(price.toFixed(2)),
            change: parseFloat(change.toFixed(2)),
            changePercent: parseFloat(changePercent.toFixed(2)),
            exchange: 'NSE'
        };
    });
};

export const fetchFundamentalDetails = async (symbol: string): Promise<FundamentalData> => {
  await delay(600);

  // Generate plausible fundamental data based on symbol
  const isTech = ['INFY', 'TCS', 'AAPL', 'MSFT', 'GOOGL'].includes(symbol);
  
  return {
    symbol,
    roe: isTech ? 25 + Math.random() * 10 : 12 + Math.random() * 8,
    roce: isTech ? 30 + Math.random() * 10 : 15 + Math.random() * 5,
    npm: isTech ? 18 + Math.random() * 5 : 8 + Math.random() * 4,
    revenueGrowth3Y: 10 + Math.random() * 15,
    profitGrowth3Y: 12 + Math.random() * 20,
    debtToEquity: isTech ? 0.05 : 0.8 + Math.random() * 0.5,
    interestCoverage: isTech ? 40 : 4 + Math.random() * 5,
    currentRatio: 1.5 + Math.random(),
    freeCashFlowConversion: 0.8 + Math.random() * 0.4, // 80-120%
    peHistory: 25 + Math.random() * 10,
    currentPe: 25 + Math.random() * 15, // Might be higher or lower than history
    pegRatio: 0.8 + Math.random() * 1.5,
    promoterHolding: 40 + Math.random() * 30,
    pledgedShares: Math.random() > 0.8 ? Math.random() * 5 : 0 // Small chance of pledging
  };
};

// --- Situation Awareness Data ---

export const fetchMarketPulse = async (): Promise<MarketPulse> => {
    const nifty = await fetchStockDetails('NIFTY 50');
    const regime = detectRegime(nifty);
    
    return {
        regime,
        advanceDeclineRatio: 1.4, // 1.4 stocks up for every 1 down
        topSector: 'Auto',
        laggardSector: 'IT',
        vix: 13.5
    };
};

export const fetchOptionRadar = async (): Promise<OptionRadarItem[]> => {
    return [
        { id: '1', symbol: 'ADANIENT', insight: 'High IV Spike', value: 'IV 65%', sentiment: 'BEARISH' },
        { id: '2', symbol: 'NIFTY', insight: 'Long Buildup', value: 'OI +12%', sentiment: 'BULLISH' },
        { id: '3', symbol: 'BANKNIFTY', insight: 'PCR Oversold', value: 'PCR 0.55', sentiment: 'BULLISH' }
    ];
};

export const fetchFailedSignals = async (): Promise<FailedSignal[]> => {
    return [
        { id: '1', symbol: 'TCS', signal: 'Volume Breakout', failureReason: 'Price rejected at R1 resistance' },
        { id: '2', symbol: 'SBIN', signal: 'Golden Cross', failureReason: 'Lack of follow-through volume' }
    ];
};


const getCompanyName = (symbol: string) => {
  const map: Record<string, string> = {
    'AAPL': 'Apple Inc.',
    'MSFT': 'Microsoft Corp.',
    'GOOGL': 'Alphabet Inc.',
    'RELIANCE': 'Reliance Industries',
    'INFY': 'Infosys Ltd.',
    'TCS': 'Tata Consultancy Svcs',
    'HDFCBANK': 'HDFC Bank Ltd',
    'ICICIBANK': 'ICICI Bank Ltd',
    'TATAMOTORS': 'Tata Motors',
    'M&M': 'Mahindra & Mahindra',
    'MARUTI': 'Maruti Suzuki',
    'EICHERMOT': 'Eicher Motors',
    'QUANT-SMALL-CAP': 'Quant Small Cap Fund Direct Growth',
    'HDFC-BALANCED': 'HDFC Balanced Advantage Fund Direct',
    'PARAG-FLEXI': 'Parag Parikh Flexi Cap Fund Direct'
  };
  return map[symbol] || `${symbol} Corp`;
};
