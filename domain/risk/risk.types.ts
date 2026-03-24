
import { RebalanceAction } from "../rebalance/rebalance.types";

export type RiskConstraints = {
  maxSingleTradePct: number; // e.g. 0.05 for 5%
  maxTotalTurnoverPct: number; // e.g. 0.20 for 20%
  allowedSymbols?: string[];
  minSafetyScore?: number; // e.g. 0-100
};

export type RiskValidationInput = {
  actions: RebalanceAction[];
  constraints: RiskConstraints;
  portfolioValue: number;
};

export type RiskValidationResult = {
  approved: boolean;
  reason?: string;
};
