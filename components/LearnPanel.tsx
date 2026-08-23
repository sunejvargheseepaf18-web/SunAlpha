
import React, { useEffect, useState } from 'react';
import { GraduationCap, CheckCircle2, XCircle } from 'lucide-react';
import { LifecycleStage } from '../types';
import { QuizGrade } from '../domain/education/education.engine';
import { getEducationState, submitQuiz, EducationState } from '../services/educationService';

// Rendering + orchestration of the education service. One lesson at a time:
// read the concept, answer the quiz inline, learn from the explanations.

export const LearnPanel: React.FC<{ stage: LifecycleStage }> = ({ stage }) => {
  const [state, setState] = useState<EducationState | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [grade, setGrade] = useState<QuizGrade | null>(null);

  const refresh = () => {
    setState(getEducationState(stage));
    setAnswers({});
    setGrade(null);
  };

  useEffect(refresh, [stage]);

  if (!state) return null;
  const lesson = state.nextLesson;

  return (
    <div className="bg-white rounded-xl border border-indigo-100 shadow-sm p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <GraduationCap size={18} className="text-indigo-600" />
          <h4 className="font-bold text-gray-800">Learn</h4>
        </div>
        <div className="flex gap-2">
          {state.mastery.map(m => (
            <span
              key={m.stage}
              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                m.masteryPct === 100
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-gray-50 text-gray-500 border-gray-200'
              }`}
              title={`${m.passed}/${m.lessons} lessons passed`}
            >
              {m.stage.charAt(0) + m.stage.slice(1).toLowerCase()} {m.passed}/{m.lessons}
            </span>
          ))}
        </div>
      </div>

      {state.readiness.ready && state.readiness.nextStage && (
        <p className="text-xs text-indigo-600 font-medium mb-2">
          You have mastered the {state.readiness.currentStage.toLowerCase()} track — ready to move
          toward {state.readiness.nextStage.toLowerCase()}.
        </p>
      )}

      {!lesson ? (
        <p className="text-xs text-gray-400">All lessons complete — the curriculum will grow with the app.</p>
      ) : (
        <>
          <p className="text-sm font-bold text-gray-800 mt-2">{lesson.title}</p>
          <p className="text-xs text-gray-600 leading-relaxed mt-1 mb-4">{lesson.body}</p>

          <div className="space-y-4">
            {lesson.quiz.map((q, qi) => (
              <div key={qi}>
                <p className="text-xs font-medium text-gray-700 mb-1.5">
                  {qi + 1}. {q.question}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  {q.options.map((opt, oi) => (
                    <button
                      key={oi}
                      disabled={grade !== null}
                      onClick={() => setAnswers(a => ({ ...a, [qi]: oi }))}
                      className={`text-left text-xs px-3 py-2 rounded-lg border transition-all ${
                        answers[qi] === oi
                          ? 'border-indigo-400 bg-indigo-50 text-indigo-800'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      } ${grade !== null && oi === q.answerIndex ? 'border-emerald-400 bg-emerald-50' : ''}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {grade && (
                  <p className={`flex items-start gap-1 text-[11px] mt-1.5 ${grade.perQuestion[qi].correct ? 'text-emerald-600' : 'text-red-600'}`}>
                    {grade.perQuestion[qi].correct ? (
                      <CheckCircle2 size={12} className="mt-0.5 shrink-0" />
                    ) : (
                      <XCircle size={12} className="mt-0.5 shrink-0" />
                    )}
                    {grade.perQuestion[qi].explanation}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4">
            {grade === null ? (
              <button
                disabled={Object.keys(answers).length < lesson.quiz.length}
                onClick={() => setGrade(submitQuiz(lesson, lesson.quiz.map((_, i) => answers[i] ?? -1)))}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg disabled:opacity-40 hover:bg-indigo-700"
              >
                Check Answers
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold ${grade.passed ? 'text-emerald-600' : 'text-red-600'}`}>
                  {grade.correct}/{grade.total} correct — {grade.passed ? 'passed!' : 'below 70%, try again'}
                </span>
                <button
                  onClick={refresh}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-200 text-gray-600 hover:border-gray-300"
                >
                  {grade.passed ? 'Next Lesson' : 'Retry'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
