
import { TradeIntent, TradeOrder } from '../../types';
import { getPaperCash, updatePaperCash, updatePaperHolding, logPaperOrder, getPaperHoldings } from './paperStore';
import { recordClosedTrade } from '../tradeJournalService';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const executeVirtualTrade = async (intent: TradeIntent): Promise<TradeOrder> => {
    await delay(600); // Simulate processing latency

    const { symbol, side, quantity, price, isDerivative, product } = intent;
    const executionPrice = price || 0; // Market orders would need real-time fetch, assume Limit/Pre-fetched for now
    const totalValue = quantity * executionPrice;
    
    // Charges Simulation (0.1% transaction cost)
    const charges = totalValue * 0.001; 

    // 1. Validation
    const currentCash = getPaperCash();
    const holdings = getPaperHoldings();

    if (side === 'BUY') {
        const requiredCash = totalValue + charges;
        if (currentCash < requiredCash) {
            throw new Error(`Insufficient Virtual Funds. Required: ₹${requiredCash.toFixed(2)}, Available: ₹${currentCash.toFixed(2)}`);
        }
    } else {
        // SELL Check
        const holding = holdings[symbol];
        if (!holding || holding.quantity < quantity) {
            throw new Error(`Insufficient Holdings. Owned: ${holding?.quantity || 0}, Sell: ${quantity}`);
        }
    }

    // 2. Execution (Update Store)
    if (side === 'BUY') {
        updatePaperCash(-(totalValue + charges));
        updatePaperHolding(symbol, quantity, executionPrice, isDerivative ? 'DERIVATIVE' : 'STOCK');
    } else {
        updatePaperCash(totalValue - charges);

        // Auto-journal the closed (part of the) position at its average cost.
        // The paper store keeps no entry date, so holding time starts today —
        // tags (setup/mistakes) can be added later from the journal panel.
        const avgPrice = holdings[symbol]?.avgPrice ?? executionPrice;
        const today = new Date().toISOString().split('T')[0];
        recordClosedTrade({
            id: `PAPER-${symbol}-${Date.now()}`,
            symbol,
            side: 'LONG',
            quantity,
            entryDate: today,
            entryPrice: avgPrice,
            exitDate: today,
            exitPrice: executionPrice,
            fees: charges
        });

        updatePaperHolding(symbol, -quantity, executionPrice, isDerivative ? 'DERIVATIVE' : 'STOCK');
    }

    // 3. Log Order
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
