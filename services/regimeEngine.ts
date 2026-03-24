
import { StockData, MarketRegime, VolatilityRegime, TrendRegime } from '../types';

// Helper: Calculate Standard Deviation
const stdDev = (arr: number[]) => {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
  return Math.sqrt(variance);
};

// Helper: SMA
const sma = (arr: number[], period: number) => {
  return arr.slice(-period).reduce((a, b) => a + b, 0) / period;
};

export const detectRegime = (stock: StockData): MarketRegime => {
  const prices = stock.history.map(h => h.close);
  const len = prices.length;
  
  if (len < 20) {
    return {
      symbol: stock.symbol,
      volatility: 'NORMAL',
      trend: 'SIDEWAYS',
      summary: 'Insufficient data for regime detection.',
      confidence: 0
    };
  }

  // 1. Analyze Volatility using Bollinger Band Width
  // BB Width = (Upper - Lower) / Middle
  const period = 20;
  const subset = prices.slice(-period);
  const mean = sma(subset, period);
  const sd = stdDev(subset);
  const upper = mean + (2 * sd);
  const lower = mean - (2 * sd);
  const bandwidth = (upper - lower) / mean;

  // We need historical bandwidth to know if current is high or low
  // For MVP, we use static thresholds, but ideally this is relative to self
  let volatility: VolatilityRegime = 'NORMAL';
  if (bandwidth < 0.05) volatility = 'LOW_COMPRESSION'; // Very tight squeeze
  else if (bandwidth > 0.15) volatility = 'HIGH_EXPANSION'; // High vol

  // 2. Analyze Trend using SMA Alignment + Price Action
  const sma20 = mean;
  const sma50 = sma(prices.slice(-50), 50);
  const close = prices[len - 1];

  let trend: TrendRegime = 'SIDEWAYS';
  
  if (close > sma20 && sma20 > sma50) {
    // Check slope (simplified by looking at 5 days ago)
    const sma20Prev = sma(prices.slice(-25, -5), 20);
    if (sma20 > sma20Prev * 1.01) trend = 'STRONG_BULL';
    else trend = 'WEAK_BULL';
  } else if (close < sma20 && sma20 < sma50) {
     const sma20Prev = sma(prices.slice(-25, -5), 20);
     if (sma20 < sma20Prev * 0.99) trend = 'STRONG_BEAR';
     else trend = 'WEAK_BEAR';
  }

  // 3. Synthesize Summary
  let summary = '';
  if (volatility === 'LOW_COMPRESSION') {
    summary += `Volatility Squeeze detected. Expect a breakout from ${trend === 'SIDEWAYS' ? 'consolidation' : 'trend'}. `;
  } else if (volatility === 'HIGH_EXPANSION') {
    summary += `Market is volatile. Wide swings expected. `;
  }

  if (trend === 'STRONG_BULL') summary += "Dominant Uptrend.";
  else if (trend === 'STRONG_BEAR') summary += "Dominant Downtrend.";
  else if (trend === 'SIDEWAYS') summary += "Price is range-bound.";
  else summary += `Trend is ${trend.replace('_', ' ').toLowerCase()}.`;

  return {
    symbol: stock.symbol,
    volatility,
    trend,
    summary,
    confidence: 0.85 // Mock confidence for now
  };
};
