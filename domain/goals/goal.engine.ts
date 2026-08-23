
// Goal planning engine (pure domain logic) — goal-based investing math:
// inflate the target to the goal date, project corpus + SIP forward under
// expected returns, and answer the one question that matters: what monthly
// SIP does this goal actually require, and how far off is the current one.
// Deterministic scenario bands (pessimistic/expected/optimistic) instead of
// Monte Carlo — AGENT_RULES domain code stays random-free.

export interface Goal {
  id: string;
  name: string;
  targetAmount: number; // in today's rupees
  targetYears: number;
  monthlySip: number; // what the user currently invests toward this goal
  expectedReturnPct: number; // annual, e.g. 12 for equity-heavy
  inflationPct: number; // annual, e.g. 6
  currentCorpus?: number; // explicit allocation; else a share of the portfolio
}

/** FV of a monthly SIP (annuity-due: invested at month start). */
export const sipFutureValue = (monthly: number, years: number, annualReturnPct: number): number => {
  const n = Math.round(years * 12);
  if (n <= 0 || monthly <= 0) return 0;
  const r = annualReturnPct / 100 / 12;
  if (r === 0) return monthly * n;
  return monthly * (((Math.pow(1 + r, n) - 1) / r) * (1 + r));
};

/** FV of a lump sum. */
export const lumpFutureValue = (amount: number, years: number, annualReturnPct: number): number =>
  amount > 0 ? amount * Math.pow(1 + annualReturnPct / 100, years) : 0;

/** Monthly SIP needed to reach `target` in `years` (given existing corpus). */
export const requiredMonthlySip = (
  target: number,
  years: number,
  annualReturnPct: number,
  currentCorpus = 0
): number => {
  const n = Math.round(years * 12);
  if (n <= 0) return 0;
  const gap = target - lumpFutureValue(currentCorpus, years, annualReturnPct);
  if (gap <= 0) return 0;
  const r = annualReturnPct / 100 / 12;
  const factor = r === 0 ? n : ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
  return parseFloat((gap / factor).toFixed(2));
};

export const inflateTarget = (todayAmount: number, years: number, inflationPct: number): number =>
  parseFloat((todayAmount * Math.pow(1 + inflationPct / 100, years)).toFixed(2));

export interface GoalAssessment {
  goal: Goal;
  inflatedTarget: number;
  projected: { pessimistic: number; expected: number; optimistic: number };
  fundedPct: number; // expected projection vs inflated target, capped 999
  onTrack: boolean;
  requiredSip: number; // to close the gap from here
  sipDelta: number; // requiredSip - current SIP (positive = increase needed)
}

// Scenario haircut on the expected return (deterministic bands)
const SCENARIO_SPREAD_PCT = 3;

export const assessGoal = (goal: Goal, corpus: number): GoalAssessment => {
  const inflatedTarget = inflateTarget(goal.targetAmount, goal.targetYears, goal.inflationPct);

  const projectAt = (returnPct: number): number =>
    parseFloat(
      (
        lumpFutureValue(corpus, goal.targetYears, returnPct) +
        sipFutureValue(goal.monthlySip, goal.targetYears, returnPct)
      ).toFixed(2)
    );

  const projected = {
    pessimistic: projectAt(goal.expectedReturnPct - SCENARIO_SPREAD_PCT),
    expected: projectAt(goal.expectedReturnPct),
    optimistic: projectAt(goal.expectedReturnPct + SCENARIO_SPREAD_PCT)
  };

  const requiredSip = requiredMonthlySip(
    inflatedTarget,
    goal.targetYears,
    goal.expectedReturnPct,
    corpus
  );

  return {
    goal,
    inflatedTarget,
    projected,
    fundedPct: Math.min(999, parseFloat(((projected.expected / inflatedTarget) * 100).toFixed(1))),
    onTrack: projected.expected >= inflatedTarget,
    requiredSip,
    sipDelta: parseFloat((requiredSip - goal.monthlySip).toFixed(2))
  };
};

/**
 * Split a shared portfolio corpus across goals in proportion to their
 * inflated targets; a goal with an explicit currentCorpus keeps it.
 */
export const allocateCorpus = (goals: Goal[], portfolioValue: number): Map<string, number> => {
  const allocation = new Map<string, number>();
  const implicit = goals.filter(g => g.currentCorpus === undefined);
  const explicitSum = goals.reduce((s, g) => s + (g.currentCorpus ?? 0), 0);
  const pool = Math.max(0, portfolioValue - explicitSum);
  const weightSum = implicit.reduce(
    (s, g) => s + inflateTarget(g.targetAmount, g.targetYears, g.inflationPct),
    0
  );

  for (const g of goals) {
    if (g.currentCorpus !== undefined) {
      allocation.set(g.id, g.currentCorpus);
    } else {
      const weight = weightSum > 0 ? inflateTarget(g.targetAmount, g.targetYears, g.inflationPct) / weightSum : 0;
      allocation.set(g.id, parseFloat((pool * weight).toFixed(2)));
    }
  }
  return allocation;
};
