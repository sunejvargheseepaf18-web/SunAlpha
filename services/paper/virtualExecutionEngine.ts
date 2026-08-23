
import { TradeIntent, TradeOrder } from '../../types';
import { getPaperCash, updatePaperCash, updatePaperHolding, logPaperOrder, getPaperHoldings } from './paperStore';
import { recordClosedTrade } from '../tradeJournalService';
import { resolveFill } from '../../domain/execution/fill.engine';
import { getLiveQuote } from '../marketFeed';
import { getCryptoQuotes } from '../cryptoFeed';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Real-time quote for fill simulation (the Alpaca paper-trading contract:
// real quotes, simulated fills). Falls back to the intent's own price when
// every feed is unreachable — a limit price is still an honest fill basis.
const marketPriceFor = async (intent: TradeIntent): Promise<number> => {
  const crypto = await getCryptoQuotes([intent.symbol]);
  const cryptoQuote = crypto.get(intent.symbol);
  if (cryptoQuote) return cryptoQuote.price;
  const quote = await getLiveQuote(intent.symbol);
  if (quote) return quote.price;
  return intent.price ?? 0;
};

export const executeVirtualTrade = async (intent: TradeIntent): Promise<TradeOrder> => {
    await delay(300); // simulate routing latency

    const { symbol, side, quantity, isDerivative, product } = intent;

    // 1. Simulated fill against the live market price
    const marketPrice = await marketPriceFor(intent);
    const fill = resolveFill(
        {
            side,
            type: intent.type,
            limitPrice: intent.price,
            triggerPrice: intent.triggerPrice
        },
        marketPrice
    );
    if (fill.status === 'REJECTED') {
        throw new Error(`Order rejected: ${fill.reason}`);
    }

    const executionPrice = fill.price;
    const totalValue = quantity * executionPrice;
    const charges = totalValue * 0.001; // 0.1% transaction cost

    // 2. Validation
    const currentCash = getPaperCash();
    const holdings = getPaperHoldings();

    if (side === 'BUY') {
        const requiredCash = totalValue + charges;
        if (currentCash < requiredCash) {
            throw new Error(`Insufficient Virtual Funds. Required: ₹${requiredCash.toFixed(2)}, Available: ₹${currentCash.toFixed(2)}`);
        }
    } else {
        const holding = holdings[symbol];
        if (!holding || holding.quantity < quantity) {
            throw new Error(`Insufficient Holdings. Owned: ${holding?.quantity || 0}, Sell: ${quantity}`);
        }
    }

    // 3. Execution (update store)
    if (side === 'BUY') {
        updatePaperCash(-(totalValue + charges));
        updatePaperHolding(symbol, quantity, executionPrice, isDerivative ? 'DERIVATIVE' : 'STOCK');
    } else {
        updatePaperCash(totalValue - charges);

        // Auto-journal the closed slice at its average cost, with the real
        // entry date the store now tracks — holding periods are honest.
        const holding = holdings[symbol];
        recordClosedTrade({
            id: `PAPER-${symbol}-${Date.now()}`,
            symbol,
            side: 'LONG',
            quantity,
            entryDate: holding?.firstBuyDate ?? new Date().toISOString().split('T')[0],
            entryPrice: holding?.avgPrice ?? executionPrice,
            exitDate: new Date().toISOString().split('T')[0],
            exitPrice: executionPrice,
            fees: charges
        });

        updatePaperHolding(symbol, -quantity, executionPrice, isDerivative ? 'DERIVATIVE' : 'STOCK');
    }

    // 4. Log order at its actual simulated fill price
    const order: TradeOrder = {
        id: `PAPER-${Date.now()}`,
        symbol,
        side,
        product,
        type: intent.type,
        quantity,
        price: executionPrice,
        status: 'EXECUTED',
        triggerPrice: intent.triggerPrice,
        timestamp: new Date().toISOString()
    };

    logPaperOrder(order);

    return order;
};
