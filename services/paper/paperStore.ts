
import { TradeOrder, PortfolioPosition } from '../../types';

// In-Memory Virtual Ledger (replaces database for MVP)
interface PaperState {
    cash: number;
    holdings: Record<string, { quantity: number, avgPrice: number, type: string }>; // symbol -> details
    orders: TradeOrder[];
    initialized: boolean;
}

let STATE: PaperState = {
    cash: 1000000, // 10 Lakh Starting Capital
    holdings: {},
    orders: [],
    initialized: false
};

// --- Store Accessors ---

export const initializePaperAccount = async (startingCapital: number = 1000000) => {
    // Only init if not already (persist across session navigations if possible)
    if (!STATE.initialized) {
        STATE.cash = startingCapital;
        STATE.holdings = {};
        STATE.orders = [];
        STATE.initialized = true;
    }
    return STATE;
};

export const getPaperCash = (): number => STATE.cash;

export const getPaperHoldings = (): Record<string, { quantity: number, avgPrice: number, type: string }> => STATE.holdings;

export const getPaperOrders = (): TradeOrder[] => STATE.orders;

export const getVirtualPositions = (): PortfolioPosition[] => {
    return Object.entries(STATE.holdings).map(([symbol, data], idx) => {
        // We need current price. For now, assume price hasn't moved much from avg or fetch fresh.
        // In a real implementation, we'd pass current market prices here.
        // For simplicity in this mock store, we'll return structure and let Portfolio Engine enrich prices.
        return {
            id: `paper-pos-${idx}`,
            assetType: data.type as any,
            symbol: symbol,
            name: symbol, // Will be enriched later
            quantity: data.quantity,
            avgPrice: data.avgPrice,
            currentPrice: data.avgPrice, // Placeholder, engine updates this
            investedValue: data.quantity * data.avgPrice,
            currentValue: data.quantity * data.avgPrice,
            pnl: 0,
            pnlPercent: 0
        };
    });
};

// --- Store Mutators (Only accessible via Execution Engine ideally) ---

export const updatePaperCash = (delta: number) => {
    STATE.cash += delta;
};

export const updatePaperHolding = (symbol: string, quantityDelta: number, price: number, assetType: string) => {
    const existing = STATE.holdings[symbol];
    
    if (!existing) {
        if (quantityDelta > 0) {
            STATE.holdings[symbol] = { quantity: quantityDelta, avgPrice: price, type: assetType };
        }
        return;
    }

    const newQty = existing.quantity + quantityDelta;
    
    if (newQty <= 0) {
        delete STATE.holdings[symbol];
    } else {
        // Average Price Calculation (Only for Buys)
        if (quantityDelta > 0) {
            const totalValue = (existing.quantity * existing.avgPrice) + (quantityDelta * price);
            existing.avgPrice = totalValue / newQty;
        }
        existing.quantity = newQty;
        // Keep type same
    }
};

export const logPaperOrder = (order: TradeOrder) => {
    STATE.orders.unshift(order);
};
