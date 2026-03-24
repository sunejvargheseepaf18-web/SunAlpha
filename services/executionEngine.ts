
import { BasketItem, ExecutionPreview, OrderSide } from '../types';

/**
 * Calculates how a total cash amount should be split across multiple instruments.
 * Handles rounding (qty flooring) and returns a preview of generated orders.
 */
export const calculateAllocationPreview = (
    amount: number,
    side: OrderSide,
    items: BasketItem[]
): ExecutionPreview => {
    // 1. Normalize weights if they don't sum to 100 (graceful handling)
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    const weightFactor = totalWeight > 0 ? 100 / totalWeight : 0;

    let generatedTotalValue = 0;
    const orderItems = [];

    // 2. Iterate items and calculate quantity
    for (const item of items) {
        // Effective Allocation for this item
        const allocatedAmount = amount * ((item.weight * weightFactor) / 100);
        
        // Calculate Qty (Floor for Buy, Ceiling for Sell? usually floor to be safe)
        // For 'SELL' amount mode, user usually implies "Sell ₹X worth", so logic is same.
        let quantity = 0;
        
        if (item.type === 'STOCK' || item.type === 'ETF') {
             // Equity: Whole numbers only
             quantity = Math.floor(allocatedAmount / item.price);
        } else if (item.type === 'MUTUAL_FUND') {
             // MF: Fractional units allowed conceptually, but usually Amount is sent to API
             // For preview consistency, we show units
             quantity = parseFloat((allocatedAmount / item.price).toFixed(3));
        } else {
             // Derivatives: Lot size logic (Mock: assumes lot size 1 for simplicity here, but would need lot size map)
             quantity = Math.floor(allocatedAmount / item.price);
        }

        if (quantity > 0) {
            const estimatedVal = quantity * item.price;
            generatedTotalValue += estimatedVal;
            orderItems.push({
                symbol: item.symbol,
                action: side,
                quantity,
                estimatedPrice: item.price,
                estimatedTotal: estimatedVal
            });
        }
    }

    // 3. Estimate Charges (Mock: 0.1% for Taxes/Brokerage)
    const estimatedCharges = generatedTotalValue * 0.001;
    
    // 4. Margin Req (Mock: 20% for F&O, 100% for Equity delivery)
    // Simple logic: if any item is DERIVATIVE, assume margin rules apply
    const marginRequired = generatedTotalValue; // Assuming Cash Delivery for now

    return {
        items: orderItems,
        totalValue: generatedTotalValue,
        estimatedCharges,
        marginRequired,
        projectedImpact: {
            equityExposureDelta: side === 'BUY' ? 5.2 : -5.2, // Mock impact
            cashBalanceDelta: side === 'BUY' ? -generatedTotalValue : generatedTotalValue
        }
    };
};
