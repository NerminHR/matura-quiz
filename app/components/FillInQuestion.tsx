"use client";

import type { Question } from "@/types/question";

interface Props {
  question: Question;
  value: string;
  onChange: (text: string) => void;
  revealed: boolean;
}

export default function FillInQuestion({ question: q, value, onChange, revealed }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <input
          type="text"
          value={value}
          onChange={(e) => !revealed && onChange(e.target.value)}
          disabled={revealed}
          placeholder="Upišite odgovor..."
          className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
        />
      </div>

      {revealed && (
        <div className="bg-green-50 border-2 border-green-400 rounded-lg p-3">
          <p className="text-xs font-semibold text-green-700 mb-1">Tačan odgovor:</p>
          <p className="text-sm text-green-900 leading-relaxed">{q.correct_answer}</p>
        </div>
      )}

      {revealed && (
        <p className="text-xs text-gray-500 italic">
          Ovo pitanje se ne boduje u quizu, ali se boduje na eksternoj maturi!
        </p>
      )}
    </div>
  );
}
