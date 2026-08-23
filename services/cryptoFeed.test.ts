
import { describe, it, expect } from 'vitest';
import { toCoinGeckoId, parseCoinGeckoPrices, CoinGeckoPriceResponse } from './cryptoFeed';

describe('toCoinGeckoId', () => {
  it('maps known symbols case-insensitively and rejects unknowns', () => {
    expect(toCoinGeckoId('BTC')).toBe('bitcoin');
    expect(toCoinGeckoId('eth')).toBe('ethereum');
    expect(toCoinGeckoId('DOGECOIN?')).toBeNull();
  });
});

describe('parseCoinGeckoPrices', () => {
  const res: CoinGeckoPriceResponse = {
    bitcoin: { inr: 8250000, inr_24h_change: 2.4 },
    ethereum: { inr: 0 }, // invalid price — dropped
    solana: { inr: 14500 } // no change field — defaults to 0
  };

  it('builds INR quotes with 24h change and derived absolute change', () => {
    const quotes = parseCoinGeckoPrices(['BTC', 'ETH', 'SOL'], res);
    const btc = quotes.get('BTC')!;
    expect(btc.price).toBe(8250000);
    expect(btc.changePercent).toBe(2.4);
    // change = price * pct / (100 + pct): consistent with prev = price - change
    const prev = btc.price - btc.change;
    expect(((btc.price - prev) / prev) * 100).toBeCloseTo(2.4, 1);
    expect(btc.exchange).toBe('CRYPTO');
  });

  it('drops invalid prices and defaults missing change to zero', () => {
    const quotes = parseCoinGeckoPrices(['BTC', 'ETH', 'SOL'], res);
    expect(quotes.has('ETH')).toBe(false);
    expect(quotes.get('SOL')!.changePercent).toBe(0);
  });

  it('ignores symbols with no CoinGecko mapping', () => {
    const quotes = parseCoinGeckoPrices(['UNKNOWN'], res);
    expect(quotes.size).toBe(0);
  });
});
