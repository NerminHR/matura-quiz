"use client";

import React from "react";
import type { Question } from "@/types/question";

interface Props {
  question: Question;
  value: string;
  onChange: (text: string) => void;
  revealed: boolean;
}

// Same detection logic as QuizShell's parseContext
function parseWordBank(ctx: string | null): string[] | null {
  if (!ctx) return null;
  const lines = ctx.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const isWBLine = (line: string) =>
    /\s{2,}/.test(line) && !/^[A-Z][\w\s]*:/.test(line) && line.length <= 50;
  const toWords = (line: string) =>
    line.split(/\s{2,}/).map(w => w.trim().replace(/\s+/g, " ")).filter(Boolean);
  if (lines.length > 0 && isWBLine(lines[0])) return toWords(lines[0]);
  if (lines.length > 1 && isWBLine(lines[1])) return toWords(lines[1]);
  return null;
}

// Normalize whitespace for comparison
const norm = (s: string) => s.trim().replace(/\s+/g, " ");

// For dialogue questions correct_answer is "1: word | 2: word | 3: word"
// For sentence questions it's just the word
function getCorrectWord(correctAnswer: string, questionNumber: number): string {
  if (correctAnswer.includes("|") && correctAnswer.includes(":")) {
    const activeBlank = questionNumber % 10 || 1;
    for (const part of correctAnswer.split("|")) {
      const m = part.trim().match(/^(\d+):\s*(.+)$/);
      if (m && parseInt(m[1]) === activeBlank) return norm(m[2]);
    }
  }
  return norm(correctAnswer);
}

// Which blank number is this question asking about?
// Single numbered blank → read from text; multiple blanks → use questionNumber % 10
function getActiveBlankNum(text: string, questionNumber: number): number {
  const matches = [...text.matchAll(/(\d+)\s+_{3,}/g)];
  if (matches.length === 0) return 1;           // unnumbered single blank
  if (matches.length === 1) return parseInt(matches[0][1]);
  return questionNumber % 10 || 1;             // multiple blanks → use Q# suffix
}

function renderWithDropdown(
  text: string,
  wordBank: string[],
  activeBlankNum: number,
  selected: string,
  onChange: (w: string) => void,
  revealed: boolean,
  correctWord: string,
): React.ReactNode {
  // Capture "optional-digit(s)+spaces+underscores" or "bare underscores"
  const parts = text.split(/((?:\d+\s+)?_{3,})/g);

  return parts.map((part, i) => {
    if (!/_{3,}/.test(part)) return <span key={i}>{part}</span>;

    const numMatch = part.match(/^(\d+)/);
    const blankNum = numMatch ? parseInt(numMatch[1]) : activeBlankNum;
    const isActive = blankNum === activeBlankNum;

    if (!isActive) {
      return <span key={i} className="inline text-gray-400 mx-0.5">____________</span>;
    }

    const isCorrect = revealed && norm(selected) === norm(correctWord);
    const isWrong   = revealed && selected !== "" && norm(selected) !== norm(correctWord);

    return (
      <span key={i} className="inline-flex items-center mx-1 gap-1 align-baseline">
        <select
          value={selected}
          onChange={e => !revealed && onChange(e.target.value)}
          disabled={revealed}
          className={`border-2 rounded-md px-1.5 py-0.5 text-sm font-medium focus:outline-none ${
            isCorrect ? "border-green-400 bg-green-50 text-green-800" :
            isWrong   ? "border-red-400   bg-red-50   text-red-800"   :
                        "border-indigo-400 bg-white   text-gray-800"
          }`}
        >
          <option value="">— odaberi —</option>
          {wordBank.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
        {revealed && isCorrect && (
          <span className="text-green-600 font-bold text-sm">✓</span>
        )}
        {revealed && isWrong && (
          <span className="text-xs font-semibold text-green-700 bg-green-100 px-1 rounded">
            ✓ {correctWord}
          </span>
        )}
      </span>
    );
  });
}

export default function FillInQuestion({ question: q, value, onChange, revealed }: Props) {
  const wordBank = parseWordBank(q.context_text);

  // Word-bank fill_in: render question_text with inline dropdown
  if (wordBank) {
    const correctWord    = getCorrectWord(q.correct_answer, q.question_number);
    const activeBlankNum = getActiveBlankNum(q.question_text, q.question_number);

    return (
      <div>
        <p className="text-gray-900 font-medium leading-relaxed">
          {renderWithDropdown(
            q.question_text,
            wordBank,
            activeBlankNum,
            value,
            onChange,
            revealed,
            correctWord,
          )}
        </p>
      </div>
    );
  }

  // Regular fill_in: free-text input
  return (
    <div className="space-y-3">
      <input
        type="text"
        value={value}
        onChange={e => !revealed && onChange(e.target.value)}
        disabled={revealed}
        placeholder="Upišite odgovor..."
        className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
      />
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
