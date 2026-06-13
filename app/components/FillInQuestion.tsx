"use client";

import React, { useState, useEffect } from "react";
import type { Question } from "@/types/question";

interface Props {
  question: Question;
  value: string;
  onChange: (text: string) => void;
  revealed: boolean;
}

function parseCtx(ctx: string | null): { wordBank: string[] | null; dialogue: string | null } {
  if (!ctx) return { wordBank: null, dialogue: null };
  const lines = ctx.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const isWBLine = (line: string) =>
    /\s{2,}/.test(line) && !/^[A-Z][\w\s]*:/.test(line) && line.length <= 50;
  const toWords = (line: string) =>
    line.split(/\s{2,}/).map(w => w.trim().replace(/\s+/g, " ")).filter(Boolean);

  if (lines.length > 0 && isWBLine(lines[0])) {
    return { wordBank: toWords(lines[0]), dialogue: lines.slice(1).join("\n") || null };
  }
  if (lines.length > 1 && isWBLine(lines[1])) {
    return { wordBank: toWords(lines[1]), dialogue: lines.slice(2).join("\n") || null };
  }
  return { wordBank: null, dialogue: null };
}

// Normalize curly/typographic apostrophes & quotes to ASCII so word-bank
// selections (which carry U+2019 from the PDF) match the answer key (U+0027).
// Char class covers: ‘ ’ ʼ ׳ ′ (single) and “ ” (double).
const norm = (s: string) =>
  s.trim().replace(/\s+/g, " ").replace(/[‘’ʼ׳′]/g, "'").replace(/[“”]/g, '"');

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

// Parse all blank→correct-word entries from "1: word | 2: word | 3: word" format
function getAllCorrectWords(correctAnswer: string): Record<number, string> {
  const result: Record<number, string> = {};
  if (correctAnswer.includes("|") && correctAnswer.includes(":")) {
    for (const part of correctAnswer.split("|")) {
      const m = part.trim().match(/^(\d+):\s*(.+)$/);
      if (m) result[parseInt(m[1])] = norm(m[2]);
    }
  }
  return result;
}

function getActiveBlankNum(questionText: string, questionNumber: number): number {
  const matches = [...questionText.matchAll(/(\d+)\s+_{3,}/g)];
  if (matches.length === 0) return 1;
  if (matches.length === 1) return parseInt(matches[0][1]);
  return questionNumber % 10 || 1;
}

// Single-blank rendering: active blank → dropdown, other blanks → static underscores
function renderLine(
  text: string,
  wordBank: string[],
  activeBlankNum: number,
  selected: string,
  onChange: (w: string) => void,
  revealed: boolean,
  correctWord: string,
  keyBase: number,
): React.ReactNode {
  const parts = text.split(/((?:\d+\s+)?_{3,})/g);
  return parts.map((part, i) => {
    if (!/_{3,}/.test(part)) return <span key={keyBase + i}>{part}</span>;
    const numMatch = part.match(/^(\d+)/);
    const blankNum = numMatch ? parseInt(numMatch[1]) : activeBlankNum;
    const isActive = blankNum === activeBlankNum;
    if (!isActive) {
      return (
        <span key={keyBase + i} className="text-gray-400 mx-0.5">
          {numMatch ? `${numMatch[1]} ` : ""}____________
        </span>
      );
    }
    const isCorrect = revealed && norm(selected) === norm(correctWord);
    const isWrong   = revealed && selected !== "" && norm(selected) !== norm(correctWord);
    return (
      <span key={keyBase + i} className="inline-flex items-center gap-1 mx-1 align-baseline">
        {numMatch && <span className="text-indigo-500 font-bold text-xs">{numMatch[1]}</span>}
        <select value={selected} onChange={e => !revealed && onChange(e.target.value)} disabled={revealed}
          className={`border-2 rounded-md px-1.5 py-0.5 text-sm font-medium not-italic focus:outline-none ${
            isCorrect ? "border-green-400 bg-green-50 text-green-800" :
            isWrong   ? "border-red-400   bg-red-50   text-red-800"   :
                        "border-indigo-400 bg-white   text-gray-800"
          }`}>
          <option value="">— odaberi —</option>
          {wordBank.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
        {revealed && isCorrect && <span className="text-green-600 font-bold text-sm not-italic">✓</span>}
        {revealed && isWrong && (
          <span className="text-xs font-semibold text-green-700 bg-green-100 px-1 rounded not-italic">✓ {correctWord}</span>
        )}
      </span>
    );
  });
}

// Multi-blank rendering: ALL blanks → dropdowns with independent state
function renderLineMulti(
  text: string,
  wordBank: string[],
  allSelected: Record<number, string>,
  onChange: (blankNum: number, word: string) => void,
  revealed: boolean,
  allCorrectWords: Record<number, string>,
  keyBase: number,
): React.ReactNode {
  const parts = text.split(/((?:\d+\s+)?_{3,})/g);
  return parts.map((part, i) => {
    if (!/_{3,}/.test(part)) return <span key={keyBase + i}>{part}</span>;
    const numMatch = part.match(/^(\d+)/);
    const blankNum = numMatch ? parseInt(numMatch[1]) : 1;
    const selected    = allSelected[blankNum] ?? "";
    const correctWord = allCorrectWords[blankNum] ?? "";
    const isCorrect   = revealed && correctWord !== "" && norm(selected) === norm(correctWord);
    const showHint    = revealed && !isCorrect && correctWord !== "";
    return (
      <span key={keyBase + i} className="inline-flex items-center gap-1 mx-1 align-baseline">
        {numMatch && <span className="text-indigo-500 font-bold text-xs">{numMatch[1]}</span>}
        <select value={selected} onChange={e => !revealed && onChange(blankNum, e.target.value)} disabled={revealed}
          className={`border-2 rounded-md px-1.5 py-0.5 text-sm font-medium not-italic focus:outline-none ${
            isCorrect ? "border-green-400 bg-green-50 text-green-800" :
            showHint  ? "border-red-400   bg-red-50   text-red-800"   :
                        "border-indigo-400 bg-white   text-gray-800"
          }`}>
          <option value="">— odaberi —</option>
          {wordBank.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
        {revealed && isCorrect && <span className="text-green-600 font-bold text-sm not-italic">✓</span>}
        {revealed && showHint && (
          <span className="text-xs font-semibold text-green-700 bg-green-100 px-1 rounded not-italic">✓ {correctWord}</span>
        )}
      </span>
    );
  });
}

export default function FillInQuestion({ question: q, value, onChange, revealed }: Props) {
  const { wordBank, dialogue } = parseCtx(q.context_text);

  // Determine active blank number up-front (needed for useState initialiser)
  const activeBlankNum = wordBank && dialogue
    ? getActiveBlankNum(q.question_text, q.question_number)
    : 1;

  // Local state for ALL blank selections in dialogue questions
  const [dialogueAnswers, setDialogueAnswers] = useState<Record<number, string>>(() => ({
    [activeBlankNum]: value,
  }));

  // Keep active blank in sync with parent value (e.g. after navigating back)
  useEffect(() => {
    setDialogueAnswers(prev => ({ ...prev, [activeBlankNum]: value }));
  }, [value, activeBlankNum]);

  // Dropdown fill_in: option_a present (never has context_text/wordBank in current data)
  if (!wordBank && q.option_a) {
    const options = [q.option_a!, q.option_b!, q.option_c!, q.option_d!].filter(Boolean);
    const correctWord = norm(q.correct_answer);
    return (
      <div>
        <p className="text-gray-900 font-medium leading-relaxed">
          {renderLine(q.question_text, options, 1, value, onChange, revealed, correctWord, 0)}
        </p>
      </div>
    );
  }

  if (wordBank) {
    const correctWord = getCorrectWord(q.correct_answer, q.question_number);

    if (dialogue) {
      const allCorrectWords = getAllCorrectWords(q.correct_answer);

      const handleDialogueChange = (blankNum: number, word: string) => {
        setDialogueAnswers(prev => ({ ...prev, [blankNum]: word }));
        // Only the active blank's selection propagates to the parent for grading
        if (blankNum === activeBlankNum) onChange(word);
      };

      return (
        <div className="border-l-4 border-indigo-200 bg-indigo-50 p-4 rounded-r-lg text-sm text-gray-700 italic leading-relaxed">
          {dialogue.split("\n").map((line, lineIdx) => (
            <React.Fragment key={lineIdx}>
              {lineIdx > 0 && <br />}
              {renderLineMulti(line, wordBank, dialogueAnswers, handleDialogueChange, revealed, allCorrectWords, lineIdx * 200)}
            </React.Fragment>
          ))}
        </div>
      );
    }

    // Sentence-type (no dialogue): single active blank
    return (
      <div>
        <p className="text-gray-900 font-medium leading-relaxed">
          {renderLine(q.question_text, wordBank, activeBlankNum, value, onChange, revealed, correctWord, 0)}
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
