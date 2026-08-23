
import { Allocation, Holding } from "../rebalance/rebalance.types";
import { PortfolioRiskState, RiskConstraints } from "../risk/risk.types";

export type TradeProposal = {
  id: string;
  holdings: Holding[];
  totalValue: number;
  targetAllocations: Allocation[];
  constraints: RiskConstraints;
  // Live loss state for the risk circuit breaker (optional)
  portfolioState?: PortfolioRiskState;
};

export type TradeResult = {
  status: "COMPLETED" | "REJECTED" | "FAILED";
  reason?: string;
  transactionIds?: string[];
};
