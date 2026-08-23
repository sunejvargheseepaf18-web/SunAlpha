import { OptionChainRow, OptionContract } from '../types';
import { getLiveChainDetail } from './derivativesFeed';

const generateOptionContract = (
  strike: number, 
  type: 'CE' | 'PE', 
  spotPrice: number, 
  daysToExpiry: number = 5
): OptionContract => {
  // Simple Black-Scholes-ish simulation for plausible data
  const dist = (type === 'CE' ? spotPrice - strike : strike - spotPrice);
  const intrinsic = Math.max(0, dist);
  const timeValue = (spotPrice * 0.02) * (daysToExpiry / 30); // Rough approximation
  const price = intrinsic + timeValue * (Math.random() * 0.2 + 0.9);
  
  const isATM = Math.abs(strike - spotPrice) < spotPrice * 0.01;
  
  return {
    strike,
    type,
    price: parseFloat(price.toFixed(2)),
    change: parseFloat(((Math.random() - 0.5) * 10).toFixed(2)),
    oi: Math.floor(Math.random() * 500000) + (isATM ? 1000000 : 100000),
    oiChange: Math.floor((Math.random() - 0.3) * 50000),
    volume: Math.floor(Math.random() * 1000000),
    iv: 15 + Math.random() * 5,
    greeks: {
      delta: type === 'CE' ? 0.5 + (dist/spotPrice) : -0.5 + (dist/spotPrice),
      gamma: 0.002,
      theta: -2.5,
      vega: 5.4
    }
  };
};

export interface OptionChainView {
  rows: OptionChainRow[];
  expiry: string; // NSE expiry label, '' when simulated
  asOf: string; // NSE's data timestamp, '' when simulated
  source: 'LIVE' | 'SIMULATED'; // the UI must say which one it is
}

export const fetchOptionChainView = async (
  symbol: string,
  spotPrice: number
): Promise<OptionChainView> => {
  // Live path: real NSE chain (true OI/IV/volume, Black-Scholes greeks
  // computed from NSE's implied volatility), with its real expiry and
  // NSE's own data timestamp. Falls through to a clearly-labeled
  // simulated chain when NSE is unreachable.
  const live = await getLiveChainDetail(symbol);
  if (live && live.rows.length > 0) {
    return { rows: live.rows, expiry: live.expiry, asOf: live.asOf, source: 'LIVE' };
  }

  // Generate strikes around spot
  const step = symbol === 'NIFTY' ? 50 : symbol === 'BANKNIFTY' ? 100 : spotPrice * 0.02;
  const roundedSpot = Math.round(spotPrice / step) * step;

  const chain: OptionChainRow[] = [];

  // 5 strikes ITM and 5 OTM
  for (let i = -5; i <= 5; i++) {
    const strike = roundedSpot + (i * step);
    chain.push({
      strike,
      ce: generateOptionContract(strike, 'CE', spotPrice),
      pe: generateOptionContract(strike, 'PE', spotPrice)
    });
  }

  return { rows: chain, expiry: '', asOf: '', source: 'SIMULATED' };
};

/** Rows-only view (existing callers). */
export const fetchOptionChain = async (symbol: string, spotPrice: number): Promise<OptionChainRow[]> =>
  (await fetchOptionChainView(symbol, spotPrice)).rows;
