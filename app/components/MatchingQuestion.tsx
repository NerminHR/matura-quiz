"use client";

import type { Question, MatchingItem } from "@/types/question";

interface Props {
  question: Question;
  userMapping: Record<string, string>;
  onChange: (mapping: Record<string, string>) => void;
  revealed: boolean;
}

const LETTERS = ["a", "b", "c", "d"] as const;

export default function MatchingQuestion({ question: q, userMapping, onChange, revealed }: Props) {
  const leftItems: MatchingItem[] = q.matching_left ?? [];
  const rightItems: MatchingItem[] = q.matching_right ?? [];

  // Build right-side choices. If right items are present use them, else derive from correct_mapping
  const rightChoices: MatchingItem[] = rightItems.length > 0
    ? rightItems
    : Object.entries(q.correct_mapping ?? {}).map(([, v]) => ({ key: v, text: v }));

  function handleSelect(leftKey: string, rightKey: string) {
    onChange({ ...userMapping, [leftKey]: rightKey });
  }

  return (
    <div className="space-y-2">
      {leftItems.map((item) => {
        const correctRight = q.correct_mapping?.[item.key] ?? "";
        const userRight    = userMapping[item.key] ?? "";
        const isCorrect    = revealed && userRight === correctRight;
        const isWrong      = revealed && userRight !== "" && userRight !== correctRight;

        let rowBg = "bg-white border-gray-200";
        if (revealed) {
          if (userRight === correctRight) rowBg = "bg-green-50 border-green-400";
          else if (userRight)             rowBg = "bg-red-50 border-red-300";
        }

        return (
          <div
            key={item.key}
            className={`flex items-center gap-3 p-3 rounded-lg border-2 ${rowBg} transition-colors`}
          >
            {/* Left label */}
            <span className="min-w-[140px] text-sm font-medium text-gray-800">
              <span className="font-bold mr-1">{item.key.toUpperCase()})</span>
              {item.text}
            </span>

            <span className="text-gray-400">→</span>

            {/* Right dropdown */}
            <select
              value={userRight}
              onChange={(e) => !revealed && handleSelect(item.key, e.target.value)}
              disabled={revealed}
              className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500 bg-white disabled:bg-gray-50"
            >
              <option value="">— Odaberite —</option>
              {rightChoices.map((rc, i) => (
                <option key={rc.key} value={LETTERS[i]}>
                  {rc.text}
                </option>
              ))}
            </select>

            {/* Result indicator */}
            {revealed && (
              <span className={`text-lg font-bold flex-shrink-0 ${isCorrect ? "text-green-600" : isWrong ? "text-red-500" : "text-gray-300"}`}>
                {isCorrect ? "✓" : isWrong ? "✗" : "—"}
              </span>
            )}

            {/* Correct answer hint when wrong */}
            {revealed && isWrong && (
              <span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded flex-shrink-0">
                Tačno: {rightChoices[LETTERS.indexOf(correctRight as typeof LETTERS[number])]?.text ?? correctRight}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
