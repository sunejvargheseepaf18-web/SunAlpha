
// Built-in backtest strategies (pure). Each returns a Strategy closure whose
// signal at index i may only use bars[0..i] — the engine enforces next-open
// execution, these enforce no peeking in the math itself.

import { BtBar, Strategy, StrategySignal } from './backtest.engine';

export const sma = (bars: BtBar[], period: number, index: number): number | null => {
  if (index + 1 < period) return null;
  let sum = 0;
  for (let i = index - period + 1; i <= index; i++) sum += bars[i].close;
  return sum / period;
};

// Wilder's RSI over closes up to `index`.
export const rsi = (bars: BtBar[], period: number, index: number): number | null => {
  if (index < period) return null;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = bars[i].close - bars[i - 1].close;
    if (change > 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period + 1; i <= index; i++) {
    const change = bars[i].close - bars[i - 1].close;
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
};

/** Golden-cross style trend following: long while fast SMA > slow SMA. */
export const smaCrossover = (fast = 10, slow = 30): Strategy => {
  return (bars: BtBar[], index: number): StrategySignal => {
    const f = sma(bars, fast, index);
    const s = sma(bars, slow, index);
    if (f === null || s === null) return 'FLAT';
    return f > s ? 'LONG' : 'FLAT';
  };
};

/** Mean reversion: buy oversold (RSI < buyBelow), exit once RSI > exitAbove. */
export const rsiMeanReversion = (period = 14, buyBelow = 30, exitAbove = 55): Strategy => {
  return (bars: BtBar[], index: number): StrategySignal => {
    const value = rsi(bars, period, index);
    if (value === null) return 'HOLD';
    if (value < buyBelow) return 'LONG';
    if (value > exitAbove) return 'FLAT';
    return 'HOLD'; // hysteresis band: keep whatever position exists
  };
};

/** Always invested — the cost-aware baseline. */
export const buyAndHold = (): Strategy => () => 'LONG';

export interface StrategyDef {
  id: string;
  name: string;
  description: string;
  build: () => Strategy;
}

export const STRATEGY_CATALOG: StrategyDef[] = [
  {
    id: 'sma-cross',
    name: 'SMA 10/30 Crossover',
    description: 'Long while the 10-day SMA is above the 30-day SMA.',
    build: () => smaCrossover(10, 30)
  },
  {
    id: 'rsi-mr',
    name: 'RSI Mean Reversion',
    description: 'Buy when RSI(14) < 30, exit when RSI > 55.',
    build: () => rsiMeanReversion(14, 30, 55)
  }
];
