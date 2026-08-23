
// Education service — localStorage progress over the pure education engine.

import { LifecycleStage } from '../types';
import {
  gradeQuiz,
  computeMastery,
  assessStageReadiness,
  recommendNextLesson,
  LessonDef,
  LessonProgress,
  QuizGrade,
  StageMastery,
  StageReadiness
} from '../domain/education/education.engine';
import { LESSON_CATALOG } from '../domain/education/education.content';

const STORAGE_KEY = 'sunalpha.education.progress';

const load = (): LessonProgress[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LessonProgress[]) : [];
  } catch {
    return [];
  }
};

const save = (progress: LessonProgress[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // best-effort
  }
};

export interface EducationState {
  nextLesson: LessonDef | null;
  mastery: StageMastery[];
  readiness: StageReadiness;
}

export const getEducationState = (stage: LifecycleStage): EducationState => {
  const progress = load();
  return {
    nextLesson: recommendNextLesson(LESSON_CATALOG, progress, stage),
    mastery: computeMastery(LESSON_CATALOG, progress),
    readiness: assessStageReadiness(LESSON_CATALOG, progress, stage)
  };
};

/** Grade an attempt and persist the best result. Returns the grade. */
export const submitQuiz = (lesson: LessonDef, answers: number[]): QuizGrade => {
  const grade = gradeQuiz(lesson, answers);
  const progress = load();
  const existing = progress.find(p => p.lessonId === lesson.id);
  const entry: LessonProgress = {
    lessonId: lesson.id,
    scorePct: Math.max(existing?.scorePct ?? 0, grade.scorePct),
    passedAt: grade.passed ? new Date().toISOString() : existing?.passedAt ?? null
  };
  save([...progress.filter(p => p.lessonId !== lesson.id), entry]);
  return grade;
};
