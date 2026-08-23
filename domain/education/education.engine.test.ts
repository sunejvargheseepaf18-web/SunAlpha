
import { describe, it, expect } from 'vitest';
import {
  gradeQuiz,
  computeMastery,
  assessStageReadiness,
  recommendNextLesson,
  LessonProgress
} from './education.engine';
import { LESSON_CATALOG, GLOSSARY } from './education.content';
import { LifecycleStage } from '../../types';

const lesson = LESSON_CATALOG[0]; // 2-question Explorer lesson

const passed = (id: string): LessonProgress => ({ lessonId: id, scorePct: 100, passedAt: '2026-08-23' });

describe('gradeQuiz', () => {
  it('grades correct answers and passes at/above 70%', () => {
    const grade = gradeQuiz(lesson, lesson.quiz.map(q => q.answerIndex));
    expect(grade.correct).toBe(2);
    expect(grade.scorePct).toBe(100);
    expect(grade.passed).toBe(true);
  });

  it('fails below the threshold and returns explanations per question', () => {
    const grade = gradeQuiz(lesson, [lesson.quiz[0].answerIndex, 99]);
    expect(grade.scorePct).toBe(50);
    expect(grade.passed).toBe(false);
    expect(grade.perQuestion[1].correct).toBe(false);
    expect(grade.perQuestion[1].explanation.length).toBeGreaterThan(10);
  });
});

describe('computeMastery', () => {
  it('reports per-stage mastery from passed lessons', () => {
    const explorer = LESSON_CATALOG.filter(l => l.stage === LifecycleStage.EXPLORER);
    const mastery = computeMastery(LESSON_CATALOG, [passed(explorer[0].id)]);
    const exp = mastery.find(m => m.stage === LifecycleStage.EXPLORER)!;
    expect(exp.lessons).toBe(explorer.length);
    expect(exp.passed).toBe(1);
    expect(exp.masteryPct).toBeCloseTo((1 / explorer.length) * 100, 1);
  });
});

describe('assessStageReadiness', () => {
  it('is ready only when every lesson of the stage is passed', () => {
    const explorer = LESSON_CATALOG.filter(l => l.stage === LifecycleStage.EXPLORER);
    const partial = assessStageReadiness(LESSON_CATALOG, [passed(explorer[0].id)], LifecycleStage.EXPLORER);
    expect(partial.ready).toBe(false);
    expect(partial.remainingLessons.length).toBe(explorer.length - 1);

    const full = assessStageReadiness(
      LESSON_CATALOG,
      explorer.map(l => passed(l.id)),
      LifecycleStage.EXPLORER
    );
    expect(full.ready).toBe(true);
    expect(full.nextStage).toBe(LifecycleStage.LEARNER);
  });
});

describe('recommendNextLesson', () => {
  it('recommends the first unpassed lesson of the own stage, then flows to the next stage', () => {
    const explorer = LESSON_CATALOG.filter(l => l.stage === LifecycleStage.EXPLORER);
    expect(recommendNextLesson(LESSON_CATALOG, [], LifecycleStage.EXPLORER)!.id).toBe(explorer[0].id);
    const afterAll = recommendNextLesson(
      LESSON_CATALOG,
      explorer.map(l => passed(l.id)),
      LifecycleStage.EXPLORER
    );
    expect(afterAll!.stage).toBe(LifecycleStage.LEARNER);
  });
});

describe('curriculum content sanity', () => {
  it('every quiz answerIndex points at a real option', () => {
    for (const l of LESSON_CATALOG) {
      for (const q of l.quiz) {
        expect(q.options.length).toBe(4);
        expect(q.answerIndex).toBeGreaterThanOrEqual(0);
        expect(q.answerIndex).toBeLessThan(4);
      }
    }
  });

  it('glossary covers the analytics tiles the UI shows', () => {
    for (const term of ['Sharpe', 'Sortino', 'Max Drawdown', 'VaR', 'CVaR', 'Beta', 'CAGR', 'Volatility']) {
      expect(GLOSSARY[term]).toBeTruthy();
    }
  });
});
