
// Order fill simulation (pure domain logic) — the Alpaca paper-trading
// contract: real-time market price in, simulated fill out. Market orders
// fill at market plus slippage; limit orders fill at limit-or-better when
// marketable and are rejected when not (immediate-or-cancel — this simple
// simulator holds no book); stop orders convert to market once triggered.

export interface FillIntent {
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
  limitPrice?: number;
  triggerPrice?: number;
}

export type FillResult =
  | { status: 'FILLED'; price: number }
  | { status: 'REJECTED'; reason: string };

const DEFAULT_SLIPPAGE_PCT = 0.05;

export const resolveFill = (
  intent: FillIntent,
  marketPrice: number,
  slippagePct: number = DEFAULT_SLIPPAGE_PCT
): FillResult => {
  if (!(marketPrice > 0)) return { status: 'REJECTED', reason: 'No market price available.' };
  const slip = slippagePct / 100;
  const slippedMarket = intent.side === 'BUY' ? marketPrice * (1 + slip) : marketPrice * (1 - slip);

  switch (intent.type) {
    case 'MARKET':
      return { status: 'FILLED', price: parseFloat(slippedMarket.toFixed(2)) };

    case 'LIMIT': {
      const limit = intent.limitPrice;
      if (!limit || limit <= 0) return { status: 'REJECTED', reason: 'LIMIT order needs a price.' };
      // Marketable when the limit crosses the market; fill at limit-or-better.
      if (intent.side === 'BUY') {
        if (marketPrice > limit)
          return { status: 'REJECTED', reason: `Limit ₹${limit} below market ₹${marketPrice.toFixed(2)} — not marketable.` };
        return { status: 'FILLED', price: parseFloat(Math.min(slippedMarket, limit).toFixed(2)) };
      }
      if (marketPrice < limit)
        return { status: 'REJECTED', reason: `Limit ₹${limit} above market ₹${marketPrice.toFixed(2)} — not marketable.` };
      return { status: 'FILLED', price: parseFloat(Math.max(slippedMarket, limit).toFixed(2)) };
    }

    case 'SL':
    case 'SL-M': {
      const trigger = intent.triggerPrice;
      if (!trigger || trigger <= 0) return { status: 'REJECTED', reason: 'Stop order needs a trigger price.' };
      // Stop-buy triggers when market rises to the trigger; stop-sell when it falls.
      const triggered = intent.side === 'BUY' ? marketPrice >= trigger : marketPrice <= trigger;
      if (!triggered)
        return { status: 'REJECTED', reason: `Trigger ₹${trigger} not reached (market ₹${marketPrice.toFixed(2)}).` };
      return { status: 'FILLED', price: parseFloat(slippedMarket.toFixed(2)) };
    }
  }
};
