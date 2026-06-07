"use client";

import type { Question } from "@/types/question";

interface Props {
  question: Question;
  selectedAnswer: string | null;
  onChange: (letter: string) => void;
  revealed: boolean;
}

const LETTERS = ["a", "b", "c", "d"] as const;
const OPTION_LABELS: Record<string, string | null | undefined> = {};

export default function MCQQuestion({ question, selectedAnswer, onChange, revealed }: Props) {
  const options: Record<string, string | null | undefined> = {
    a: question.option_a,
    b: question.option_b,
    c: question.option_c,
    d: question.option_d,
  };

  return (
    <div className="space-y-3">
      {LETTERS.map((letter) => {
        const text = options[letter];
        if (!text) return null;

        const isSelected = selectedAnswer === letter;
        const isCorrect  = question.correct_answer === letter;

        let bg = "bg-white border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer";
        if (revealed) {
          if (isCorrect)                     bg = "bg-green-50 border-green-500 text-green-900";
          else if (isSelected && !isCorrect) bg = "bg-red-50 border-red-400 text-red-900";
          else                               bg = "bg-white border-gray-200 opacity-60";
        } else if (isSelected) {
          bg = "bg-blue-50 border-blue-500 cursor-pointer";
        }

        return (
          <label
            key={letter}
            className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-colors select-none ${bg}`}
          >
            <input
              type="radio"
              name={`q-${question.id}`}
              value={letter}
              checked={isSelected}
              onChange={() => !revealed && onChange(letter)}
              className="mt-0.5 accent-blue-600 flex-shrink-0"
              disabled={revealed}
            />
            <span className="text-sm leading-relaxed">
              <span className="font-semibold mr-1">{letter.toUpperCase()})</span>
              {text}
            </span>
            {revealed && isCorrect && (
              <span className="ml-auto text-green-600 font-bold text-lg flex-shrink-0">✓</span>
            )}
            {revealed && isSelected && !isCorrect && (
              <span className="ml-auto text-red-500 font-bold text-lg flex-shrink-0">✗</span>
            )}
          </label>
        );
      })}
    </div>
  );
}
