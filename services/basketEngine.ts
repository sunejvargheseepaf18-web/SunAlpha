
import { Basket } from '../types';

const MOCK_BASKETS: Basket[] = [
    {
        id: 'basket-1',
        name: 'Momentum Kings',
        description: 'High-momentum stocks showing strong relative strength vs Nifty.',
        cagr: 24.5,
        minAmount: 15000,
        volatility: 'HIGH',
        stocks: [
            { symbol: 'TRENT', weight: 15 },
            { symbol: 'HAL', weight: 15 },
            { symbol: 'BEL', weight: 10 },
            { symbol: 'RELIANCE', weight: 20 },
            { symbol: 'TATAMOTORS', weight: 20 },
            { symbol: 'ZOMATO', weight: 20 }
        ]
    },
    {
        id: 'basket-2',
        name: 'Dividend Aristocrats',
        description: 'Companies with consistent dividend payouts and stable cash flows.',
        cagr: 14.2,
        minAmount: 25000,
        volatility: 'LOW',
        stocks: [
            { symbol: 'ITC', weight: 25 },
            { symbol: 'COALINDIA', weight: 20 },
            { symbol: 'ONGC', weight: 15 },
            { symbol: 'POWERGRID', weight: 20 },
            { symbol: 'NTPC', weight: 20 }
        ]
    },
    {
        id: 'basket-3',
        name: 'Bank Beaters',
        description: 'Top private and PSU banks poised for credit growth.',
        cagr: 18.8,
        minAmount: 12000,
        volatility: 'MEDIUM',
        stocks: [
            { symbol: 'HDFCBANK', weight: 30 },
            { symbol: 'ICICIBANK', weight: 30 },
            { symbol: 'SBIN', weight: 20 },
            { symbol: 'AXISBANK', weight: 20 }
        ]
    }
];

export const fetchBaskets = async (): Promise<Basket[]> => {
    await new Promise(r => setTimeout(r, 500));
    return MOCK_BASKETS;
};
