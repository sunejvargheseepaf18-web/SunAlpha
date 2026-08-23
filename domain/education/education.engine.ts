
// Education engine (pure domain logic) — the Duolingo/QuestEd pattern:
// a staged lesson path, quiz gating with explanations, mastery per stage,
// and readiness assessment for advancing the user's lifecycle stage.
// Content lives in education.content.ts; this file only computes.

import { LifecycleStage } from '../../types';

export interface QuizQuestion {
  question: string;
  options: string[]; // exactly 4
  answerIndex: number;
  explanation: string; // shown after answering — teach on the miss
}

export interface LessonDef {
  id: string;
  stage: LifecycleStage;
  topic: string;
  title: string;
  summary: string; // one-liner for the card
  body: string; // the lesson itself, a few sentences
  quiz: QuizQuestion[];
}

export interface LessonProgress {
  lessonId: string;
  scorePct: number;
  passedAt: string | null; // ISO when passed, null if only attempted
}

export const PASS_THRESHOLD_PCT = 70;

export interface QuizGrade {
  correct: number;
  total: number;
  scorePct: number;
  passed: boolean;
  perQuestion: { correct: boolean; explanation: string }[];
}

export const gradeQuiz = (lesson: LessonDef, answers: number[]): QuizGrade => {
  const perQuestion = lesson.quiz.map((q, i) => ({
    correct: answers[i] === q.answerIndex,
    explanation: q.explanation
  }));
  const correct = perQuestion.filter(p => p.correct).length;
  const scorePct = lesson.quiz.length
    ? parseFloat(((correct / lesson.quiz.length) * 100).toFixed(1))
    : 0;
  return {
    correct,
    total: lesson.quiz.length,
    scorePct,
    passed: scorePct >= PASS_THRESHOLD_PCT,
    perQuestion
  };
};

const STAGE_ORDER: LifecycleStage[] = [
  LifecycleStage.EXPLORER,
  LifecycleStage.LEARNER,
  LifecycleStage.BUILDER,
  LifecycleStage.OPTIMIZER,
  LifecycleStage.PROTECTOR
];

export interface StageMastery {
  stage: LifecycleStage;
  lessons: number;
  passed: number;
  masteryPct: number;
}

export const computeMastery = (
  catalog: LessonDef[],
  progress: LessonProgress[]
): StageMastery[] => {
  const passedIds = new Set(progress.filter(p => p.passedAt).map(p => p.lessonId));
  return STAGE_ORDER.map(stage => {
    const lessons = catalog.filter(l => l.stage === stage);
    const passed = lessons.filter(l => passedIds.has(l.id)).length;
    return {
      stage,
      lessons: lessons.length,
      passed,
      masteryPct: lessons.length ? parseFloat(((passed / lessons.length) * 100).toFixed(1)) : 0
    };
  }).filter(m => m.lessons > 0);
};

export interface StageReadiness {
  currentStage: LifecycleStage;
  nextStage: LifecycleStage | null;
  ready: boolean; // all lessons of the current stage passed
  remainingLessons: string[]; // titles still to pass in the current stage
}

export const assessStageReadiness = (
  catalog: LessonDef[],
  progress: LessonProgress[],
  currentStage: LifecycleStage
): StageReadiness => {
  const passedIds = new Set(progress.filter(p => p.passedAt).map(p => p.lessonId));
  const stageLessons = catalog.filter(l => l.stage === currentStage);
  const remaining = stageLessons.filter(l => !passedIds.has(l.id));
  const idx = STAGE_ORDER.indexOf(currentStage);
  return {
    currentStage,
    nextStage: idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null,
    ready: stageLessons.length > 0 && remaining.length === 0,
    remainingLessons: remaining.map(l => l.title)
  };
};

/**
 * Next lesson to take: first unpassed lesson of the user's own stage; once
 * the stage is complete, the next stage's first unpassed lesson.
 */
export const recommendNextLesson = (
  catalog: LessonDef[],
  progress: LessonProgress[],
  currentStage: LifecycleStage
): LessonDef | null => {
  const passedIds = new Set(progress.filter(p => p.passedAt).map(p => p.lessonId));
  const startIdx = Math.max(0, STAGE_ORDER.indexOf(currentStage));
  for (let i = startIdx; i < STAGE_ORDER.length; i++) {
    const next = catalog.find(l => l.stage === STAGE_ORDER[i] && !passedIds.has(l.id));
    if (next) return next;
  }
  return null;
};
