import { PriceAlert } from '../types';

let MOCK_ALERTS: PriceAlert[] = [
    { id: '1', symbol: 'RELIANCE', targetPrice: 2600, condition: 'ABOVE', createdAt: new Date().toISOString() },
    { id: '2', symbol: 'INFY', targetPrice: 1350, condition: 'BELOW', createdAt: new Date().toISOString() }
];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getAlerts = async (symbol?: string): Promise<PriceAlert[]> => {
    await delay(200);
    if (symbol) {
        return MOCK_ALERTS.filter(a => a.symbol === symbol);
    }
    return [...MOCK_ALERTS];
};

export const createAlert = async (symbol: string, targetPrice: number, condition: 'ABOVE' | 'BELOW'): Promise<PriceAlert> => {
    await delay(300);
    const newAlert: PriceAlert = {
        id: Date.now().toString(),
        symbol,
        targetPrice,
        condition,
        createdAt: new Date().toISOString()
    };
    MOCK_ALERTS = [newAlert, ...MOCK_ALERTS];
    return newAlert;
};

export const deleteAlert = async (id: string): Promise<void> => {
    await delay(200);
    MOCK_ALERTS = MOCK_ALERTS.filter(a => a.id !== id);
};
