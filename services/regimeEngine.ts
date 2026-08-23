
import { StockData, MarketRegime } from '../types';
import { detectRegimeFromBars, RegimeReading } from '../domain/regime/regime.engine';
import { BtBar } from '../domain/backtest/backtest.engine';

// Regime detection — delegates to the pure domain classifier (self-relative
// volatility percentile x composite trend score, computed confidence,
// hysteresis). This service only adapts data shapes and remembers each
// symbol's last reading so regimes don't flap between calls.

const lastReading = new Map<string, Pick<RegimeReading, 'volatility' | 'trend'>>();

export const detectRegime = (stock: StockData): MarketRegime => {
  const bars: BtBar[] = stock.history.map(h => ({
    date: h.date,
    open: h.open,
    high: h.high,
    low: h.low,
    close: h.close,
    volume: h.volume
  }));

  const reading = detectRegimeFromBars(bars, lastReading.get(stock.symbol));

  if (!reading) {
    return {
      symbol: stock.symbol,
      volatility: 'NORMAL',
      trend: 'SIDEWAYS',
      summary: 'Insufficient data for regime detection.',
      confidence: 0
    };
  }

  lastReading.set(stock.symbol, { volatility: reading.volatility, trend: reading.trend });

  return {
    symbol: stock.symbol,
    volatility: reading.volatility,
    trend: reading.trend,
    summary: reading.summary,
    confidence: reading.confidence
  };
};
