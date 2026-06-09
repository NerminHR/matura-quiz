"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Question, UserAnswer } from "@/types/question";
import type { LeaderboardEntry, UserStats } from "@/lib/db";

interface StoredResult {
  questions: Question[];
  userAnswers: UserAnswer[];
  timeSeconds: number;
  subject: string;
  sectionFilter: string | null;
  userName: string;
}

const LETTERS = ["a", "b", "c", "d"] as const;

function fmt(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const RANK_MEDAL = ["🥇", "🥈", "🥉"];

const SUBJECT_LABEL: Record<string, string> = {
  bs: "🇧🇦 Bosanski",
  en: "🇬🇧 English",
};

export default function ResultsPage() {
  const router = useRouter();
  const savedRef = useRef(false);

  const [result,        setResult]        = useState<StoredResult | null>(null);
  const [isPersonalBest,     setIsPersonalBest]     = useState(false);
  const [leaderboard,        setLeaderboard]        = useState<LeaderboardEntry[]>([]);
  const [userStats,          setUserStats]          = useState<UserStats | null>(null);
  const [currentResultRank,  setCurrentResultRank]  = useState(0);
  const [currentResultId,    setCurrentResultId]    = useState(0);
  const [saving,             setSaving]             = useState(true);

  useEffect(() => {
    const raw = sessionStorage.getItem("quizResult");
    if (!raw) return;
    const parsed: StoredResult = JSON.parse(raw);
    setResult(parsed);

    if (savedRef.current) return;
    savedRef.current = true;

    const gradable = parsed.questions.filter((q) => q.question_type !== "fill_in");
    const correct  = gradable.filter((q) => {
      const ua = parsed.userAnswers.find((a) => a.questionId === q.id);
      return ua?.isCorrect === true;
    }).length;

    fetch("/api/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userName:      parsed.userName || "Anonimni",
        subject:       parsed.subject ?? "bs",
        sectionFilter: parsed.sectionFilter ?? null,
        questionCount: gradable.length,
        correctCount:  correct,
        timeSeconds:   parsed.timeSeconds ?? 0,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        setIsPersonalBest(data.isPersonalBest ?? false);
        setLeaderboard(data.leaderboard ?? []);
        setUserStats(data.userStats ?? null);
        setCurrentResultRank(data.currentResultRank ?? 0);
        setCurrentResultId(data.id ?? 0);
        setSaving(false);
      })
      .catch(() => setSaving(false));
  }, []);

  if (!result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm">
          <p className="text-gray-600 mb-4">Nema rezultata. Pokrenite test ponovo.</p>
          <button onClick={() => router.push("/")} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold">
            Početna
          </button>
        </div>
      </div>
    );
  }

  const { questions, userAnswers, timeSeconds, subject, userName } = result;
  const answerMap = new Map(userAnswers.map((a) => [a.questionId, a]));
  const gradable  = questions.filter((q) => q.question_type !== "fill_in");
  const correct   = gradable.filter((q) => answerMap.get(q.id)?.isCorrect === true).length;
  const pct       = gradable.length > 0 ? Math.round((correct / gradable.length) * 100) : 0;

  const grade =
    pct >= 90 ? "Savršeno!" :
    pct >= 75 ? "Odličan" :
    pct >= 55 ? "Dobar" :
    pct >= 40 ? "Dovoljan" : "Vrijedi ponoviti";

  const gradeColor =
    pct >= 90 ? "text-yellow-500" :
    pct >= 75 ? "text-green-600" :
    pct >= 55 ? "text-blue-600" :
    pct >= 40 ? "text-amber-600" : "text-red-600";

  const scoreEmoji =
    pct >= 90 ? "🏆" :
    pct >= 75 ? "🌟" :
    pct >= 55 ? "👍" :
    pct >= 40 ? "📚" : "💪";

  // Percentile based on individual result rank in the full leaderboard
  const totalResults = leaderboard.length;
  const playersBeaten = totalResults > 0 && currentResultRank > 0
    ? Math.round(((totalResults - currentResultRank) / totalResults) * 100)
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* ── Score banner ── */}
        <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
          {isPersonalBest && (
            <div className="bg-yellow-400 text-yellow-900 text-sm font-bold py-2 px-4 rounded-xl mb-4 animate-pulse">
              🎉 Novi rekord! / New personal best!
            </div>
          )}

          <div className="text-4xl mb-2">{scoreEmoji}</div>
          <div className={`text-5xl font-black mb-1 ${gradeColor}`}>
            {correct} / {gradable.length}
          </div>
          <div className="text-lg font-semibold text-gray-500 mb-1">{pct}% tačnih</div>
          <div className={`text-xl font-bold mb-3 ${gradeColor}`}>{grade}</div>

          <div className="flex items-center justify-center gap-6 text-sm text-gray-500 border-t pt-3 mt-1">
            <span>⏱ {fmt(timeSeconds ?? 0)}</span>
            {userName && <span>👤 {userName}</span>}
            <span>{SUBJECT_LABEL[subject] ?? subject}</span>
          </div>

          {questions.length - gradable.length > 0 && (
            <p className="text-xs text-gray-400 mt-2">
              + {questions.length - gradable.length} pitanje(a) tipa dopuni-rečenicu (samo prikaz)
            </p>
          )}
        </div>

        {/* ── Personal stats ── */}
        {userStats && !saving && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
              📊 Tvoje statistike · Your stats
            </h2>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-indigo-50 rounded-xl p-3">
                <div className="text-2xl font-black text-indigo-600">{userStats.bestPct}%</div>
                <div className="text-xs text-gray-500 mt-0.5">Rekord</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <div className="text-2xl font-black text-blue-600">{userStats.avgPct}%</div>
                <div className="text-xs text-gray-500 mt-0.5">Prosjek</div>
              </div>
              <div className="bg-purple-50 rounded-xl p-3">
                <div className="text-2xl font-black text-purple-600">{userStats.totalGames}</div>
                <div className="text-xs text-gray-500 mt-0.5">Testova</div>
              </div>
            </div>
            {currentResultRank > 0 && totalResults > 0 && (
              <p className="text-center text-sm text-gray-500 mt-3">
                {currentResultRank === 1
                  ? "🏆 Ovaj test je #1 na rang listi!"
                  : playersBeaten !== null && playersBeaten > 0
                  ? `Ovaj test je #${currentResultRank} — bolji od ${playersBeaten}% rezultata`
                  : `Rang ovog testa: #${currentResultRank}`}
              </p>
            )}
          </div>
        )}

        {/* ── Leaderboard ── */}
        {!saving && leaderboard.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
              🏅 Rang lista · Leaderboard — {SUBJECT_LABEL[subject] ?? subject}
            </h2>

            <div className="space-y-1.5">
              {leaderboard.map((entry, i) => {
                const isCurrentResult = entry.id === currentResultId;
                const isMyResult = entry.user_name === userName;
                const rank = i + 1;
                const dt = entry.completed_at
                  ? (() => {
                      const d = new Date(entry.completed_at.replace(" ", "T") + "Z");
                      return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}. ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
                    })()
                  : "";
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${
                      isCurrentResult
                        ? "bg-yellow-50 border-2 border-yellow-300 font-semibold"
                        : isMyResult
                        ? "bg-blue-50 border border-blue-200"
                        : "bg-gray-50"
                    }`}
                  >
                    <span className="w-6 text-center font-bold text-gray-400 shrink-0">
                      {rank <= 3 ? RANK_MEDAL[rank - 1] : `#${rank}`}
                    </span>
                    <span className={`flex-1 truncate min-w-0 ${isCurrentResult ? "text-yellow-800" : isMyResult ? "text-blue-800" : "text-gray-700"}`}>
                      {entry.user_name}{isCurrentResult ? " ★" : ""}
                    </span>
                    <span className={`font-black w-10 text-right shrink-0 ${
                      entry.pct >= 90 ? "text-yellow-500" :
                      entry.pct >= 75 ? "text-green-600" :
                      entry.pct >= 55 ? "text-blue-600" : "text-gray-500"
                    }`}>
                      {entry.pct}%
                    </span>
                    <span className="text-gray-400 font-mono text-xs w-10 text-right shrink-0">
                      {fmt(entry.time_seconds)}
                    </span>
                    <span className="text-gray-400 text-xs w-20 text-right shrink-0 hidden sm:block">
                      {dt}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-gray-400 text-center mt-3">
              Svaki test · Sorted by accuracy — ★ = ovaj test
            </p>
          </div>
        )}

        {saving && (
          <div className="bg-white rounded-2xl shadow-sm p-5 text-center text-sm text-gray-400">
            Čuvanje rezultata...
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex gap-3">
          <button
            onClick={() => router.push("/")}
            className="flex-1 py-3 bg-white border-2 border-gray-200 text-gray-600 font-semibold rounded-xl hover:border-indigo-400 transition-colors"
          >
            ← Početna
          </button>
          <button
            onClick={() => {
              sessionStorage.removeItem("quizResult");
              router.push("/");
            }}
            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-md"
          >
            Novi test 🚀
          </button>
        </div>

        {/* ── Per-question review ── */}
        <details className="bg-white rounded-2xl shadow-sm">
          <summary className="p-5 font-bold text-gray-700 cursor-pointer select-none list-none flex items-center justify-between">
            <span>📋 Pregled pitanja ({questions.length})</span>
            <span className="text-gray-400 text-sm">▼ razvij</span>
          </summary>

          <div className="px-5 pb-5 space-y-4 border-t pt-4">
            {questions.map((q, idx) => {
              const ua        = answerMap.get(q.id);
              const isCorrect = ua?.isCorrect;

              return (
                <div
                  key={q.id}
                  className={`rounded-xl shadow-sm p-5 border-l-4 ${
                    isCorrect === true  ? "border-green-400 bg-green-50/30" :
                    isCorrect === false ? "border-red-400 bg-red-50/30" :
                    "border-amber-300 bg-amber-50/30"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 font-medium">
                      {idx + 1}. {q.section}
                    </span>
                    <span className="ml-auto text-lg">
                      {isCorrect === true ? "✅" : isCorrect === false ? "❌" : "📝"}
                    </span>
                  </div>

                  {q.context_text && (
                    <details className="mb-2">
                      <summary className="text-xs text-indigo-600 cursor-pointer">Prikaži kontekst</summary>
                      <p className="mt-2 text-xs text-gray-600 italic whitespace-pre-line border-l-2 border-indigo-200 pl-3 leading-relaxed">
                        {q.context_text}
                      </p>
                    </details>
                  )}

                  <p className="text-sm font-medium text-gray-800 mb-3 leading-relaxed">{q.question_text}</p>

                  {q.question_type === "mcq" && (
                    <div className="space-y-1.5">
                      {LETTERS.map((letter) => {
                        const text = q[`option_${letter}` as keyof Question] as string | null;
                        if (!text) return null;
                        const isUserAnswer = ua?.answer === letter;
                        const isRight = q.correct_answer === letter;
                        let cls = "text-gray-500";
                        if (isRight) cls = "text-green-700 font-semibold";
                        if (isUserAnswer && !isRight) cls = "text-red-600 line-through";
                        return (
                          <p key={letter} className={`text-xs ${cls}`}>
                            <span className="font-bold">{letter.toUpperCase()})</span> {text}
                            {isRight && " ✓"}
                          </p>
                        );
                      })}
                      {!ua?.answer && <p className="text-xs text-gray-400 italic">Nije odgovoreno</p>}
                    </div>
                  )}

                  {q.question_type === "fill_in" && (
                    <div className="space-y-1">
                      {ua?.answer && (
                        <p className="text-xs text-gray-600">
                          <span className="font-semibold">Vaš odgovor:</span> {ua.answer as string}
                        </p>
                      )}
                      <p className="text-xs text-green-700">
                        <span className="font-semibold">Tačan odgovor:</span> {q.correct_answer}
                      </p>
                    </div>
                  )}

                  {q.question_type === "matching" && q.matching_left && q.correct_mapping && (
                    <div className="space-y-1">
                      {q.matching_left.map((item) => {
                        const userVal    = typeof ua?.answer === "object" ? (ua.answer as Record<string,string>)[item.key] : undefined;
                        const correctVal = q.correct_mapping![item.key];
                        const ri         = q.matching_right ?? [];
                        const L          = ["a","b","c","d"];
                        const correctText = ri[L.indexOf(correctVal)]?.text ?? correctVal;
                        const userText    = userVal ? (ri[L.indexOf(userVal)]?.text ?? userVal) : "—";
                        const ok          = userVal === correctVal;
                        return (
                          <p key={item.key} className={`text-xs ${ok ? "text-green-700" : "text-red-600"}`}>
                            <span className="font-bold">{item.key.toUpperCase()})</span> {item.text} →{" "}
                            {ok ? (
                              <span className="font-semibold">{correctText} ✓</span>
                            ) : (
                              <>
                                <span className="line-through">{userText}</span>{" "}
                                <span className="text-green-700 font-semibold">(Tačno: {correctText})</span>
                              </>
                            )}
                          </p>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </details>

        <div className="pb-8" />
      </div>
    </div>
  );
}
