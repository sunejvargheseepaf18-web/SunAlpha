
import { Allocation, Holding } from "../rebalance/rebalance.types";
import { RiskConstraints } from "../risk/risk.types";

export type TradeProposal = {
  id: string;
  holdings: Holding[];
  totalValue: number;
  targetAllocations: Allocation[];
  constraints: RiskConstraints;
};

export type TradeResult = {
  status: "COMPLETED" | "REJECTED" | "FAILED";
  reason?: string;
  transactionIds?: string[];
};
