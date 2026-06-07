"use client";

import type { Question } from "@/types/question";

interface Props {
  currentIndex: number;
  total: number;
  question: Question;
  children: React.ReactNode;
  onNext: () => void;
  onPrev: () => void;
  onFinish: () => void;
  canAdvance: boolean;
  revealed: boolean;
  onReveal: () => void;
  timer?: string;
}

const SECTION_LABELS: Record<string, string> = {
  "Književnost":           "📚 Književnost",
  "Medijska kultura":      "🎬 Medijska kultura",
  "Fonetika i fonologija": "🔤 Fonetika",
  "Morfologija":           "📝 Morfologija",
  "Tvorba riječi":         "🔧 Tvorba riječi",
  "Sintaksa":              "🔗 Sintaksa",
  "Leksika":               "📖 Leksika",
  "Pravopis":              "✍️ Pravopis",
  "Historija jezika":      "🏛️ Historija jezika",
  "Listening":     "🎧 Listening",
  "Reading":       "📖 Reading",
  "Vocabulary I":  "🔤 Vocabulary I",
  "Vocabulary II": "📝 Vocabulary II",
  "Grammar I":     "📐 Grammar I",
  "Grammar II":    "🔧 Grammar II",
  "Communication": "💬 Communication",
};

export default function QuizShell({
  currentIndex,
  total,
  question,
  children,
  onNext,
  onPrev,
  onFinish,
  canAdvance,
  revealed,
  onReveal,
  timer,
}: Props) {
  const progress = ((currentIndex + 1) / total) * 100;
  const isLast   = currentIndex === total - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-6 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <span className="text-sm text-gray-500 font-medium">
            Pitanje {currentIndex + 1} od {total}
          </span>
          {timer && (
            <span className="text-sm font-mono font-semibold text-gray-400 tabular-nums">
              ⏱ {timer}
            </span>
          )}
          <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold px-3 py-1 rounded-full whitespace-nowrap">
            {SECTION_LABELS[question.section] ?? question.section}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
          <div
            className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Question card */}
        <div className="bg-white rounded-2xl shadow-md p-6 mb-4">
          {question.context_text && (
            <div className="border-l-4 border-indigo-200 bg-indigo-50 p-4 rounded-r-lg mb-5 text-sm text-gray-700 italic leading-relaxed whitespace-pre-line">
              {question.context_text}
            </div>
          )}
          <p className="text-gray-900 font-medium leading-relaxed mb-5 whitespace-pre-line">
            {question.question_text}
          </p>
          {children}
          {!revealed && (question.question_type === "fill_in" || question.question_type === "matching") && (
            <button
              onClick={onReveal}
              className="mt-4 w-full py-2 px-4 text-sm bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold rounded-lg transition-colors"
            >
              Provjeri / Prikaži tačan odgovor
            </button>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <button
            onClick={onPrev}
            disabled={currentIndex === 0}
            className="flex-1 py-3 bg-white border-2 border-gray-200 text-gray-600 font-semibold rounded-xl hover:border-gray-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← Nazad
          </button>
          {isLast ? (
            <button
              onClick={onFinish}
              className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors shadow-md"
            >
              Završi test ✓
            </button>
          ) : (
            <button
              onClick={onNext}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-md"
            >
              Sljedeće →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
