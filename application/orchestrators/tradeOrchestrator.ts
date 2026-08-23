
import { TradeState, canTransition } from "../../domain/trade/trade.stateMachine";
import { rebalancePortfolio } from "../../domain/rebalance/rebalance.engine";
import { validateTradeRisk } from "../../domain/risk/risk.engine";
import { generateOrders, ExecutableOrder } from "../../domain/execution/execution.engine";
import { TradeProposal, TradeResult } from "../../domain/trade/trade.types";

/**
 * APPLICATION SERVICE
 * Coordinates domain logic.
 * Holds the source of truth for the current trade session state.
 */
export class TradeOrchestrator {
  private state: TradeState = "IDLE";
  private currentOrders: ExecutableOrder[] = [];

  getState(): TradeState {
    return this.state;
  }

  private transition(next: TradeState) {
    if (!canTransition(this.state, next)) {
      throw new Error(`Invalid trade transition ${this.state} -> ${next}`);
    }
    console.log(`[TradeOrchestrator] Transition: ${this.state} -> ${next}`);
    this.state = next;
  }

  /**
   * Orchestrates the entire lifecycle from Proposal to Readiness.
   * Note: Actual execution IO should be injected or handled by Infrastructure service consuming this result.
   */
  proposeTrade(proposal: TradeProposal, currentPrices: Record<string, number>): { result: TradeResult, orders?: ExecutableOrder[] } {
    try {
        this.transition("PROPOSED");

        // 1. Compute rebalance intent (Domain: Rebalance)
        const actions = rebalancePortfolio({
            holdings: proposal.holdings,
            totalValue: proposal.totalValue,
            targetAllocations: proposal.targetAllocations
        });

        this.transition("VALIDATED");

        // 2. Risk & constraint validation (Domain: Risk)
        const riskResult = validateTradeRisk({
            actions,
            constraints: proposal.constraints,
            portfolioValue: proposal.totalValue,
            portfolioState: proposal.portfolioState
        });

        if (!riskResult.approved) {
            this.transition("REJECTED");
            return { 
                result: { status: "REJECTED", reason: riskResult.reason } 
            };
        }

        this.transition("APPROVED");

        // 3. Generate executable orders (Domain: Execution)
        this.currentOrders = generateOrders(actions, currentPrices);

        if (this.currentOrders.length === 0) {
             this.transition("COMPLETED"); // Nothing to do
             return { result: { status: "COMPLETED", reason: "No actionable orders generated." } };
        }

        // Stop here. Execution is an Infrastructure concern.
        // The UI or Agent receives these orders and confirms execution.
        return { 
            result: { status: "COMPLETED" },
            orders: this.currentOrders
        };

    } catch (e: any) {
        this.state = "FAILED";
        return { 
            result: { status: "FAILED", reason: e.message } 
        };
    }
  }
}
