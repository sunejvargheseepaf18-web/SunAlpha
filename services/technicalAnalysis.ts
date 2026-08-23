
import { StockData, TAReport, TABucket, SignalDirection, TechnicalIndicator, CPRLevels, CPRWidth, CPRRelationship } from '../types';
import {
  macd,
  bollinger,
  stochastic,
  obv,
  superTrend,
  swingLevels
} from '../domain/indicators/indicators.engine';
import { BtBar } from '../domain/backtest/backtest.engine';

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

const directionFor = (score: number): SignalDirection =>
  score > 60 ? 'BULLISH' : score < 40 ? 'BEARISH' : 'NEUTRAL';

export const generateTechnicalReport = (stock: StockData): TAReport => {
  const prices = stock.history.map(h => h.close);
  const bars: BtBar[] = stock.history.map(h => ({
    date: h.date, open: h.open, high: h.high, low: h.low, close: h.close, volume: h.volume
  }));
  const close = prices[prices.length - 1];
  const cpr = getCPR(stock);

  const structure = analyzeStructure(prices, cpr);
  const trend = analyzeTrend(prices);

  // Momentum: RSI + MACD + Stochastic composite
  const rsi = calculateRSI(prices);
  const macdResult = macd(bars);
  const stochResult = stochastic(bars);
  let momentumScore = 50 + (rsi - 50) * 0.6;
  const momentumIndicators: TechnicalIndicator[] = [
    { name: 'RSI (14)', value: rsi.toFixed(1), signal: rsi > 55 ? 'BULLISH' : rsi < 45 ? 'BEARISH' : 'NEUTRAL' }
  ];
  if (macdResult) {
    momentumScore += macdResult.histogram > 0 ? 12 : -12;
    momentumIndicators.push({
      name: 'MACD Histogram',
      value: macdResult.histogram.toFixed(2),
      signal: macdResult.histogram > 0 ? 'BULLISH' : 'BEARISH'
    });
  }
  if (stochResult) {
    momentumIndicators.push({
      name: 'Stochastic %K/%D',
      value: `${stochResult.k}/${stochResult.d}`,
      signal: stochResult.k > stochResult.d ? 'BULLISH' : 'BEARISH'
    });
  }
  momentumScore = Math.max(0, Math.min(100, Math.round(momentumScore)));
  const momentum: TABucket = {
    id: 'momentum', name: 'Momentum',
    score: momentumScore,
    direction: directionFor(momentumScore),
    summary: `RSI ${rsi.toFixed(1)}${macdResult ? `, MACD histogram ${macdResult.histogram >= 0 ? 'positive' : 'negative'}` : ''}.`,
    indicators: momentumIndicators
  };

  // Volatility: Bollinger bandwidth (squeeze/expansion) + %B location
  const boll = bollinger(bars);
  const st = superTrend(bars);
  let volScore = 50;
  const volIndicators: TechnicalIndicator[] = [];
  if (boll) {
    volScore += (boll.percentB - 0.5) * 40;
    volIndicators.push(
      { name: 'Bollinger %B', value: boll.percentB.toFixed(2), signal: boll.percentB > 0.8 ? 'BULLISH' : boll.percentB < 0.2 ? 'BEARISH' : 'NEUTRAL' },
      { name: 'Bandwidth', value: `${boll.bandwidthPct.toFixed(1)}%`, signal: 'NEUTRAL' }
    );
  }
  if (st) {
    volScore += st.trend === 'UP' ? 10 : -10;
    volIndicators.push({ name: 'SuperTrend (10,3)', value: st.value.toFixed(2), signal: st.trend === 'UP' ? 'BULLISH' : 'BEARISH' });
  }
  volScore = Math.max(0, Math.min(100, Math.round(volScore)));
  const volatility: TABucket = {
    id: 'volatility', name: 'Volatility',
    score: volScore,
    direction: directionFor(volScore),
    summary: boll
      ? boll.bandwidthPct < 4
        ? `Bands squeezed (${boll.bandwidthPct.toFixed(1)}% bandwidth) — expect a range expansion.`
        : `Price at ${(boll.percentB * 100).toFixed(0)}% of the Bollinger range.`
      : 'Insufficient history for volatility bands.',
    indicators: volIndicators
  };

  // Support/Resistance: nearest swing levels
  const swings = swingLevels(bars);
  let srScore = 50;
  const srIndicators: TechnicalIndicator[] = [];
  if (swings.support !== null) {
    srIndicators.push({ name: 'Swing Support', value: `${swings.support} (-${swings.supportDistPct}%)`, signal: 'NEUTRAL' });
    if (swings.supportDistPct !== null && swings.supportDistPct < 2) srScore += 10; // sitting on support
  }
  if (swings.resistance !== null) {
    srIndicators.push({ name: 'Swing Resistance', value: `${swings.resistance} (+${swings.resistanceDistPct}%)`, signal: 'NEUTRAL' });
    if (swings.resistanceDistPct !== null && swings.resistanceDistPct < 2) srScore -= 10; // pressed under a ceiling
  } else if (bars.length > 20) {
    srScore += 15; // blue skies: no swing high above
    srIndicators.push({ name: 'Overhead Supply', value: 'None (near highs)', signal: 'BULLISH' });
  }
  srScore = Math.max(0, Math.min(100, srScore));
  const supportResistance: TABucket = {
    id: 'sr', name: 'Support & Resistance',
    score: srScore,
    direction: directionFor(srScore),
    summary:
      swings.resistance === null
        ? 'No overhead swing resistance — price is near its highs.'
        : `Support ${swings.support ?? '—'} · Resistance ${swings.resistance}.`,
    indicators: srIndicators
  };

  // Volume: OBV slope + participation vs 20-day average
  const obvResult = obv(bars);
  const vol20 = bars.length > 21 ? bars.slice(-21, -1).reduce((s, b) => s + b.volume, 0) / 20 : 0;
  const volRatio = vol20 > 0 ? bars[bars.length - 1].volume / vol20 : 1;
  let volumeScore = 50;
  const volumeIndicators: TechnicalIndicator[] = [];
  if (obvResult) {
    volumeScore += obvResult.slope > 0 ? 15 : -15;
    volumeIndicators.push({ name: 'OBV Slope', value: obvResult.slope.toFixed(2), signal: obvResult.slope > 0 ? 'BULLISH' : 'BEARISH' });
  }
  volumeIndicators.push({
    name: 'Volume vs 20d Avg',
    value: `${volRatio.toFixed(1)}x`,
    signal: volRatio >= 1.5 ? (close >= prices[prices.length - 2] ? 'BULLISH' : 'BEARISH') : 'NEUTRAL'
  });
  volumeScore = Math.max(0, Math.min(100, Math.round(volumeScore)));
  const volume: TABucket = {
    id: 'volume', name: 'Volume',
    score: volumeScore,
    direction: directionFor(volumeScore),
    summary: obvResult
      ? `OBV ${obvResult.slope > 0 ? 'accumulating' : 'distributing'}; today's volume ${volRatio.toFixed(1)}x average.`
      : 'Insufficient history for volume analysis.',
    indicators: volumeIndicators
  };

  const buckets = [structure, trend, momentum, volatility, supportResistance, volume];
  const overallScore = Math.round(avg(buckets.map(b => b.score)));
  const overallDirection = directionFor(overallScore);

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
      volatility,
      supportResistance,
      volume
    },
    timestamp: new Date().toISOString()
  };
};
