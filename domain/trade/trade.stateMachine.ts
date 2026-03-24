
export type TradeState =
  | "IDLE"
  | "PROPOSED"
  | "VALIDATED"
  | "APPROVED"
  | "EXECUTING"
  | "SETTLED"
  | "COMPLETED"
  | "REJECTED"
  | "FAILED";

export const TradeTransitions: Record<TradeState, TradeState[]> = {
  IDLE: ["PROPOSED"],
  PROPOSED: ["VALIDATED", "REJECTED"],
  VALIDATED: ["APPROVED", "REJECTED"],
  APPROVED: ["EXECUTING", "REJECTED"], // Can still be rejected manually before exec
  EXECUTING: ["SETTLED", "FAILED"],
  SETTLED: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  REJECTED: [],
  FAILED: []
};

export function canTransition(current: TradeState, next: TradeState): boolean {
  return TradeTransitions[current].includes(next);
}
