
import { TradeOrder, PortfolioPosition } from '../../types';

// Virtual ledger — persisted to localStorage so the paper account survives
// reloads (an in-memory-only practice account teaches nothing). Holdings
// remember their first buy date so the trade journal gets real holding
// periods.

export interface PaperHolding {
  quantity: number;
  avgPrice: number;
  type: string;
  firstBuyDate: string; // yyyy-MM-dd of the first lot still held
}

interface PaperState {
  cash: number;
  holdings: Record<string, PaperHolding>;
  orders: TradeOrder[];
  startingCapital: number;
  initialized: boolean;
}

const STORAGE_KEY = 'sunalpha.paper.account';

const DEFAULT_STATE = (): PaperState => ({
  cash: 1000000, // 10 Lakh starting capital
  holdings: {},
  orders: [],
  startingCapital: 1000000,
  initialized: false
});

const load = (): PaperState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_STATE(), ...(JSON.parse(raw) as PaperState) };
  } catch {
    // fall through
  }
  return DEFAULT_STATE();
};

let STATE: PaperState = load();

const persist = (): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE));
  } catch {
    // storage unavailable — session-only ledger
  }
};

// --- Store Accessors ---

export const initializePaperAccount = async (startingCapital: number = 1000000) => {
  if (!STATE.initialized) {
    STATE.cash = startingCapital;
    STATE.startingCapital = startingCapital;
    STATE.holdings = {};
    STATE.orders = [];
    STATE.initialized = true;
    persist();
  }
  return STATE;
};

/** Wipe the practice account back to its starting capital. */
export const resetPaperAccount = (startingCapital: number = 1000000): void => {
  STATE = { ...DEFAULT_STATE(), cash: startingCapital, startingCapital, initialized: true };
  persist();
};

export const getPaperCash = (): number => STATE.cash;

export const getPaperStartingCapital = (): number => STATE.startingCapital;

export const getPaperHoldings = (): Record<string, PaperHolding> => STATE.holdings;

export const getPaperOrders = (): TradeOrder[] => STATE.orders;

export const getVirtualPositions = (): PortfolioPosition[] => {
  return Object.entries(STATE.holdings).map(([symbol, data], idx) => ({
    id: `paper-pos-${idx}`,
    assetType: data.type as any,
    symbol,
    name: symbol, // enriched later
    quantity: data.quantity,
    avgPrice: data.avgPrice,
    currentPrice: data.avgPrice, // placeholder — live repricing overwrites
    investedValue: data.quantity * data.avgPrice,
    currentValue: data.quantity * data.avgPrice,
    pnl: 0,
    pnlPercent: 0
  }));
};

// --- Store Mutators (only the execution engine should call these) ---

export const updatePaperCash = (delta: number) => {
  STATE.cash += delta;
  persist();
};

export const updatePaperHolding = (
  symbol: string,
  quantityDelta: number,
  price: number,
  assetType: string
) => {
  const existing = STATE.holdings[symbol];
  const today = new Date().toISOString().split('T')[0];

  if (!existing) {
    if (quantityDelta > 0) {
      STATE.holdings[symbol] = {
        quantity: quantityDelta,
        avgPrice: price,
        type: assetType,
        firstBuyDate: today
      };
    }
    persist();
    return;
  }

  const newQty = existing.quantity + quantityDelta;

  if (newQty <= 0) {
    delete STATE.holdings[symbol];
  } else {
    if (quantityDelta > 0) {
      const totalValue = existing.quantity * existing.avgPrice + quantityDelta * price;
      existing.avgPrice = totalValue / newQty;
    }
    existing.quantity = newQty;
  }
  persist();
};

export const logPaperOrder = (order: TradeOrder) => {
  STATE.orders.unshift(order);
  STATE.orders = STATE.orders.slice(0, 200); // bounded history
  persist();
};
