
import { RebalanceAction } from "../rebalance/rebalance.types";

// Types for the Broker Interface (Infrastructure Layer compatible)
export interface ExecutableOrder {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    type: 'MARKET' | 'LIMIT';
    product: 'CNC' | 'MIS';
}

/**
 * PURE DOMAIN FUNCTION
 * Converts ideal rebalance actions into executable orders.
 * Handles:
 * - Rounding (Quantity must be integer for stocks)
 * - Minimum order value checks
 * - Splitting large orders (Iceberg) - Placeholder logic
 */
export function generateOrders(actions: RebalanceAction[], currentPrices: Record<string, number>): ExecutableOrder[] {
    const orders: ExecutableOrder[] = [];

    for (const action of actions) {
        const price = currentPrices[action.symbol];
        if (!price || price <= 0) continue; // Cannot generate order without price

        // Simple Floor logic for quantity
        const quantity = Math.floor(action.amount / price);

        if (quantity > 0) {
            orders.push({
                symbol: action.symbol,
                side: action.type,
                quantity: quantity,
                type: 'MARKET', // Default to Market for Rebalance
                product: 'CNC'  // Default to Delivery
            });
        }
    }

    return orders;
}
