"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Question, UserAnswer } from "@/types/question";
import QuizShell from "@/components/QuizShell";
import MCQQuestion from "@/components/MCQQuestion";
import FillInQuestion from "@/components/FillInQuestion";
import MatchingQuestion from "@/components/MatchingQuestion";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function QuizContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [questions,    setQuestions]    = useState<Question[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers,      setAnswers]      = useState<Map<number, UserAnswer>>(new Map());
  const [revealed,     setRevealed]     = useState<Set<number>>(new Set());
  const [elapsed,      setElapsed]      = useState(0);

  const startTimeRef = useRef<number>(Date.now());

  // Live timer
  useEffect(() => {
    startTimeRef.current = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const count    = parseInt(searchParams.get("count") ?? "20", 10);
    const sections = searchParams.get("sections");
    const subject  = searchParams.get("subject") ?? "bs";
    const sel      = sections ? sections.split(",") : null;
    const fetchCount = sel ? 200 : count;

    fetch(`/api/questions?count=${fetchCount}&subject=${subject}`)
      .then((r) => r.json())
      .then((data: { questions?: Question[]; error?: string }) => {
        if (data.error) throw new Error(data.error);
        let qs = data.questions ?? [];
        if (sel && sel.length > 0) {
          qs = qs.filter((q) => sel.includes(q.section)).slice(0, count);
        }
        if (qs.length === 0) throw new Error("Nema pitanja za odabrane oblasti.");
        setQuestions(qs);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentQuestion = questions[currentIndex];

  function parseWordBankFromCtx(ctx: string | null): string[] | null {
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

  function getWBCorrectWord(correctAnswer: string, questionNumber: number): string {
    const n = (s: string) => s.trim().replace(/\s+/g, " ").replace(/['']/g, "'").replace(/[""]/g, '"');
    if (correctAnswer.includes("|") && correctAnswer.includes(":")) {
      const activeBlank = questionNumber % 10 || 1;
      for (const part of correctAnswer.split("|")) {
        const m = part.trim().match(/^(\d+):\s*(.+)$/);
        if (m && parseInt(m[1]) === activeBlank) return n(m[2]);
      }
    }
    return n(correctAnswer);
  }

  function computeCorrect(q: Question, value: string | Record<string, string>): boolean | null {
    if (q.question_type === "mcq") {
      return typeof value === "string" && value === q.correct_answer;
    }
    if (q.question_type === "matching" && q.correct_mapping) {
      if (typeof value !== "object") return false;
      return Object.entries(q.correct_mapping).every(([k, v]) => (value as Record<string,string>)[k] === v);
    }
    if (q.question_type === "fill_in" && typeof value === "string" && value !== "") {
      // Dropdown fill_in: option_a present → auto-grade by text match
      const nq = (s: string) => s.trim().replace(/\s+/g, " ").replace(/['']/g, "'").replace(/[""]/g, '"');
      if (q.option_a) {
        return nq(value) === nq(q.correct_answer);
      }
      const wb = parseWordBankFromCtx(q.context_text);
      if (wb) {
        const correct = getWBCorrectWord(q.correct_answer, q.question_number);
        return nq(value) === correct;
      }
    }
    return null;
  }

  function recordAnswer(q: Question, value: string | Record<string, string>) {
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(q.id, { questionId: q.id, answer: value, isCorrect: computeCorrect(q, value) });
      return next;
    });
  }

  function revealCurrent() {
    const id = currentQuestion.id;
    setRevealed((prev) => new Set([...prev, id]));
    if (currentQuestion.question_type === "mcq" && !answers.has(id)) {
      setAnswers((prev) => {
        const next = new Map(prev);
        next.set(id, { questionId: id, answer: "", isCorrect: false });
        return next;
      });
    }
  }

  function handleFinish() {
    const timeSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const subject     = searchParams.get("subject") ?? "bs";
    const sections    = searchParams.get("sections") ?? null;
    const userName    = typeof window !== "undefined" ? (localStorage.getItem("matura_user") ?? "") : "";

    const result = {
      questions,
      userAnswers: questions.map(
        (q) => answers.get(q.id) ?? { questionId: q.id, answer: "", isCorrect: null }
      ),
      timeSeconds,
      subject,
      sectionFilter: sections,
      userName,
    };
    sessionStorage.setItem("quizResult", JSON.stringify(result));
    router.push("/results");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">📚</div>
          <p className="text-gray-600 font-medium">Učitavanje pitanja...</p>
        </div>
      </div>
    );
  }

  if (error || questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm shadow-lg">
          <div className="text-4xl mb-4">😕</div>
          <p className="text-red-600 font-semibold mb-4">{error ?? "Nema pitanja."}</p>
          <button
            onClick={() => router.push("/")}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700"
          >
            Nazad na početak
          </button>
        </div>
      </div>
    );
  }

  const isRevealed = revealed.has(currentQuestion.id);
  const userAnswer = answers.get(currentQuestion.id);

  return (
    <QuizShell
      currentIndex={currentIndex}
      total={questions.length}
      question={currentQuestion}
      onNext={() => setCurrentIndex((i) => Math.min(i + 1, questions.length - 1))}
      onPrev={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
      onFinish={handleFinish}
      canAdvance={!!userAnswer}
      revealed={isRevealed}
      onReveal={revealCurrent}
      timer={formatTime(elapsed)}
    >
      {currentQuestion.question_type === "mcq" && (
        <MCQQuestion
          question={currentQuestion}
          selectedAnswer={typeof userAnswer?.answer === "string" ? userAnswer.answer : null}
          onChange={(letter) => {
            recordAnswer(currentQuestion, letter);
            setRevealed((prev) => new Set([...prev, currentQuestion.id]));
          }}
          revealed={isRevealed}
        />
      )}
      {currentQuestion.question_type === "fill_in" && (
        <FillInQuestion
          question={currentQuestion}
          value={typeof userAnswer?.answer === "string" ? userAnswer.answer : ""}
          onChange={(text) => {
            recordAnswer(currentQuestion, text);
            // Auto-reveal for word-bank and grammar MCQ dropdowns (not free-text)
            const isAutoReveal =
              (currentQuestion.context_text && parseWordBankFromCtx(currentQuestion.context_text)) ||
              (!currentQuestion.context_text && currentQuestion.option_a);
            if (isAutoReveal && text !== "") {
              setRevealed((prev) => new Set([...prev, currentQuestion.id]));
            }
          }}
          revealed={isRevealed}
        />
      )}
      {currentQuestion.question_type === "matching" && (
        <MatchingQuestion
          question={currentQuestion}
          userMapping={
            userAnswer && typeof userAnswer.answer === "object"
              ? (userAnswer.answer as Record<string, string>)
              : {}
          }
          onChange={(mapping) => recordAnswer(currentQuestion, mapping)}
          revealed={isRevealed}
        />
      )}
    </QuizShell>
  );
}

export default function QuizPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl mb-4 animate-bounce">📚</div>
            <p className="text-gray-600 font-medium">Učitavanje...</p>
          </div>
        </div>
      }
    >
      <QuizContent />
    </Suspense>
  );
}
