
// Goal service — localStorage goals over the pure planning engine. Seeds
// two sensible starter goals on first run so the panel demonstrates itself;
// the user edits SIPs (and later, goals) from the UI.

import {
  Goal,
  GoalAssessment,
  assessGoal,
  allocateCorpus
} from '../domain/goals/goal.engine';

export type { Goal, GoalAssessment };

const STORAGE_KEY = 'sunalpha.goals';

const DEFAULT_GOALS: Goal[] = [
  {
    id: 'goal-retirement',
    name: 'Retirement Corpus',
    targetAmount: 20000000, // ₹2 Cr in today's rupees
    targetYears: 25,
    monthlySip: 15000,
    expectedReturnPct: 12,
    inflationPct: 6
  },
  {
    id: 'goal-house',
    name: 'House Down Payment',
    targetAmount: 3000000, // ₹30L today
    targetYears: 7,
    monthlySip: 10000,
    expectedReturnPct: 11,
    inflationPct: 6
  }
];

export const loadGoals = (): Goal[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Goal[];
  } catch {
    // fall through to seed
  }
  saveGoals(DEFAULT_GOALS);
  return DEFAULT_GOALS;
};

export const saveGoals = (goals: Goal[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  } catch {
    // best-effort
  }
};

export const updateGoalSip = (id: string, monthlySip: number): void => {
  const goals = loadGoals().map(g => (g.id === id ? { ...g, monthlySip: Math.max(0, monthlySip) } : g));
  saveGoals(goals);
};

/** Assess every goal against a shared portfolio corpus. */
export const getGoalPlans = (portfolioValue: number): GoalAssessment[] => {
  const goals = loadGoals();
  const corpus = allocateCorpus(goals, Math.max(0, portfolioValue));
  return goals.map(g => assessGoal(g, corpus.get(g.id) ?? 0));
};
