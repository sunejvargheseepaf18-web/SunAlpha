
export type Allocation = {
  symbol: string;
  targetWeight: number; // 0.0 to 1.0
};

export type Holding = {
  symbol: string;
  value: number;
};

export type RebalanceInput = {
  holdings: Holding[];
  totalValue: number;
  targetAllocations: Allocation[];
};

export type RebalanceAction =
  | { type: "BUY"; symbol: string; amount: number }
  | { type: "SELL"; symbol: string; amount: number };
