import { getQuestionStats } from "@/lib/db";
import type { QuestionStat } from "@/lib/db";

export const dynamic = "force-dynamic";

// A question is "suspicious" (possible answer-key error) when a high share of
// students who answered it got it wrong — but only once there's enough data.
const MIN_SAMPLE = 5;
const SUSPICIOUS_WRONG_PCT = 70;

function StatsSection({ title, flag, accent, stats }: {
  title: string;
  flag: string;
  accent: string;
  stats: QuestionStat[];
}) {
  const totalAnswered = stats.reduce((s, q) => s + q.answered_count, 0);
  const suspicious = stats.filter(
    (q) => q.answered_count >= MIN_SAMPLE && q.wrong_pct >= SUSPICIOUS_WRONG_PCT
  );

  return (
    <section className="mb-10">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">{flag}</span>
        <h2 className="text-xl font-bold text-white">{title}</h2>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <div className={`text-3xl font-black ${accent}`}>{stats.length}</div>
          <div className="text-xs text-gray-400 mt-1">Pitanja s podacima</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <div className="text-3xl font-black text-emerald-400">{totalAnswered}</div>
          <div className="text-xs text-gray-400 mt-1">Ukupno odgovora</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <div className="text-3xl font-black text-red-400">{suspicious.length}</div>
          <div className="text-xs text-gray-400 mt-1">
            Sumnjiva (≥{SUSPICIOUS_WRONG_PCT}% netačno, n≥{MIN_SAMPLE})
          </div>
        </div>
      </div>

      {stats.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400">
          Još nema podataka o odgovorima za ovaj predmet.
        </div>
      ) : (
        <>
          {/* Suspicious callout */}
          {suspicious.length > 0 && (
            <div className="bg-red-950/40 border border-red-800 rounded-xl p-4 mb-5">
              <p className="text-sm text-red-300 font-semibold mb-2">
                ⚠️ Pitanja s vrlo visokim postotkom netačnih odgovora — provjeriti tačan odgovor:
              </p>
              <ul className="text-xs text-red-200 space-y-1">
                {suspicious.map((q) => (
                  <li key={q.question_id}>
                    <span className="font-mono">#{q.question_id}</span> [{q.section} Q{q.question_number}] —{" "}
                    <span className="font-bold">{q.wrong_pct}%</span> netačno ({q.wrong_count}/{q.answered_count})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Stats table */}
          <div className="bg-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-700 text-gray-300 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">ID</th>
                    <th className="px-4 py-3 text-left">Oblast</th>
                    <th className="px-4 py-3 text-left">Tip</th>
                    <th className="px-4 py-3 text-left">Pitanje</th>
                    <th className="px-4 py-3 text-left">Tačan odgovor</th>
                    <th className="px-4 py-3 text-right">Odgovora</th>
                    <th className="px-4 py-3 text-right">Tačno</th>
                    <th className="px-4 py-3 text-right">Netačno %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {stats.map((q, i) => {
                    const flagged = q.answered_count >= MIN_SAMPLE && q.wrong_pct >= SUSPICIOUS_WRONG_PCT;
                    const wrongColor =
                      q.wrong_pct >= 70 ? "text-red-400" :
                      q.wrong_pct >= 50 ? "text-amber-400" :
                      q.wrong_pct >= 30 ? "text-yellow-400" : "text-green-400";
                    return (
                      <tr key={q.question_id} className={flagged ? "bg-red-950/30" : i % 2 === 0 ? "bg-gray-800" : "bg-gray-750"}>
                        <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">
                          {flagged && "⚠️ "}{q.question_id}
                        </td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">{q.section} Q{q.question_number}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{q.question_type}</td>
                        <td className="px-4 py-2.5 text-gray-300 text-xs max-w-[320px] truncate" title={q.question_text}>
                          {q.question_text}
                        </td>
                        <td className="px-4 py-2.5 text-emerald-300 text-xs max-w-[160px] truncate" title={q.correct_answer}>
                          {q.correct_answer}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-300 font-mono text-xs">{q.answered_count}</td>
                        <td className="px-4 py-2.5 text-right text-gray-400 font-mono text-xs">{q.correct_count}</td>
                        <td className={`px-4 py-2.5 text-right font-black ${wrongColor}`}>{q.wrong_pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default function AdminQuestionsPage() {
  const all: QuestionStat[] = getQuestionStats();
  const bs = all.filter((q) => q.subject === "bs");
  const en = all.filter((q) => q.subject === "en");

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">📊 Statistika po pitanju — Matura Quiz</h1>
          <p className="text-gray-400 text-sm">
            Postotak netačnih odgovora po pitanju, odvojeno po predmetu · Highest wrong-rate first
          </p>
        </div>

        <StatsSection title="Bosanski / Hrvatski / Srpski" flag="🇧🇦" accent="text-indigo-400" stats={bs} />
        <StatsSection title="English" flag="🇬🇧" accent="text-emerald-400" stats={en} />

        <p className="text-center text-xs text-gray-600 mt-6">
          Stranica nije vidljiva u aplikaciji · Osvježi za nove podatke
        </p>
      </div>
    </div>
  );
}
