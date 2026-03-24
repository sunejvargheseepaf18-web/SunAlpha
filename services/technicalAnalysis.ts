
import { StockData, TAReport, TABucket, SignalDirection, TechnicalIndicator, CPRLevels, CPRWidth, CPRRelationship } from '../types';

// --- Helpers ---
const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

const calculateRSI = (prices: number[], period: number = 14): number => {
  if (prices.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
};

export const calculateEMASeries = (data: {date: string, close: number}[], period: number) => {
  const k = 2 / (period + 1);
  let ema = data[0].close;
  const series = [];
  for (const item of data) {
    ema = item.close * k + ema * (1 - k);
    series.push({ time: item.date, value: ema });
  }
  return series;
};

// --- KSG CPR Logic ---
const calculateRawCPR = (high: number, low: number, close: number) => {
  const pivot = (high + low + close) / 3;
  const bc = (high + low) / 2;
  let tc = (pivot * 2) - bc;
  return { pivot, top: Math.max(tc, bc), bottom: Math.min(tc, bc) };
};

const determineCPRRelationship = (curr: {top: number, bottom: number}, prev: {top: number, bottom: number}): CPRRelationship => {
  if (curr.bottom > prev.top) return 'HIGHER_VALUE';
  if (curr.top < prev.bottom) return 'LOWER_VALUE';
  if (curr.bottom > prev.bottom && curr.top < prev.top) return 'INSIDE_VALUE'; // Narrower inside
  if (curr.bottom < prev.bottom && curr.top > prev.top) return 'OUTSIDE_VALUE'; // Engulfing
  if (curr.bottom > prev.bottom && curr.bottom < prev.top) return 'OVERLAPPING_HIGHER';
  if (curr.top < prev.top && curr.top > prev.bottom) return 'OVERLAPPING_LOWER';
  return 'UNCHANGED';
};

const getCPR = (stock: StockData): CPRLevels | null => {
  if (stock.history.length < 3) return null;

  // Current CPR is calculated based on Yesterday's OHLC
  const yesterday = stock.history[stock.history.length - 2];
  const dayBefore = stock.history[stock.history.length - 3];

  const curr = calculateRawCPR(yesterday.high, yesterday.low, yesterday.close);
  const prev = calculateRawCPR(dayBefore.high, dayBefore.low, dayBefore.close);

  // Width Classification (Simplified percentage based)
  const range = curr.top - curr.bottom;
  const widthPercent = (range / curr.pivot) * 100;
  let width: CPRWidth = 'AVERAGE';
  if (widthPercent < 0.25) width = 'NARROW';
  else if (widthPercent > 0.6) width = 'WIDE';

  // Relationship
  const relationship = determineCPRRelationship(curr, prev);

  return {
    pivot: curr.pivot,
    tc: curr.top,
    bc: curr.bottom,
    width,
    relationship
  };
};

// --- Bucket Analyzers ---

const analyzeStructure = (prices: number[], cpr: CPRLevels | null): TABucket => {
  let score = 50;
  let direction: SignalDirection = 'NEUTRAL';
  let summary = "Market structure is balanced.";
  const indicators: TechnicalIndicator[] = [];

  if (cpr) {
    indicators.push({ name: 'CPR Relationship', value: cpr.relationship?.replace('_', ' ') || 'N/A', signal: 'NEUTRAL' });
    
    const close = prices[prices.length - 1];
    
    if (cpr.relationship === 'HIGHER_VALUE') {
      score += 20;
      summary = "Higher Value CPR indicates bullish structure.";
      direction = 'BULLISH';
    } else if (cpr.relationship === 'LOWER_VALUE') {
      score -= 20;
      summary = "Lower Value CPR indicates bearish structure.";
      direction = 'BEARISH';
    }

    if (close > cpr.tc) {
      score += 10;
      indicators.push({ name: 'Location', value: 'Above TC', signal: 'BULLISH' });
    } else if (close < cpr.bc) {
      score -= 10;
      indicators.push({ name: 'Location', value: 'Below BC', signal: 'BEARISH' });
    }
  }

  return { id: 'structure', name: 'Structure (CPR)', score, direction, summary, indicators };
};

const analyzeTrend = (prices: number[]): TABucket => {
  const close = prices[prices.length - 1];
  const sma20 = avg(prices.slice(-20));
  const sma50 = avg(prices.slice(-50));
  const sma200 = avg(prices.slice(-200)); // Need more data for this typically

  let score = 50;
  if (close > sma20) score += 10;
  if (sma20 > sma50) score += 20;
  if (close > sma50) score += 10;
  
  let direction: SignalDirection = 'NEUTRAL';
  if (score > 60) direction = 'BULLISH';
  if (score < 40) direction = 'BEARISH';

  return {
    id: 'trend', name: 'Trend', score, direction,
    summary: direction === 'BULLISH' ? "Uptrend confirmed by Moving Averages." : "Trend is weak or bearish.",
    indicators: [
      { name: 'SMA 20', value: sma20.toFixed(2), signal: close > sma20 ? 'BULLISH' : 'BEARISH' },
      { name: 'SMA 50', value: sma50.toFixed(2), signal: close > sma50 ? 'BULLISH' : 'BEARISH' }
    ]
  };
};

// --- Main Generation ---

export const generateTechnicalReport = (stock: StockData): TAReport => {
  const prices = stock.history.map(h => h.close);
  const cpr = getCPR(stock);
  
  const structure = analyzeStructure(prices, cpr);
  const trend = analyzeTrend(prices);
  
  // Reuse existing logic for Momentum (simplified import/implementation)
  // For brevity, using simplified momentum logic here
  const rsi = calculateRSI(prices);
  const momentum: TABucket = {
    id: 'momentum', name: 'Momentum', 
    score: rsi > 50 ? 70 : 30, 
    direction: rsi > 50 ? 'BULLISH' : 'BEARISH',
    summary: `RSI is ${rsi.toFixed(1)}`,
    indicators: [{ name: 'RSI', value: rsi.toFixed(1), signal: rsi > 50 ? 'BULLISH' : 'BEARISH' }]
  };

  const buckets = [structure, trend, momentum];
  const overallScore = Math.round(avg(buckets.map(b => b.score)));
  
  let overallDirection: SignalDirection = 'NEUTRAL';
  if (overallScore > 60) overallDirection = 'BULLISH';
  if (overallScore < 40) overallDirection = 'BEARISH';

  return {
    symbol: stock.symbol,
    overallScore,
    overallDirection,
    summary: structure.summary,
    cpr,
    buckets: {
      trend,
      momentum,
      marketStructure: structure,
      // Placeholders for others to keep type compatibility if needed or fully implement
      volatility: { id: 'vol', name: 'Vol', score: 50, direction: 'NEUTRAL', summary: 'N/A', indicators: [] },
      supportResistance: { id: 'sr', name: 'S&R', score: 50, direction: 'NEUTRAL', summary: 'N/A', indicators: [] },
      volume: { id: 'vol', name: 'Vol', score: 50, direction: 'NEUTRAL', summary: 'N/A', indicators: [] }
    },
    timestamp: new Date().toISOString()
  };
};
