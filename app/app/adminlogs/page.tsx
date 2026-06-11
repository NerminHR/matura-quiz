import { getAllLogs } from "@/lib/db";
import type { LogEntry } from "@/lib/db";

export const dynamic = "force-dynamic";

const SUBJECT: Record<string, string> = { bs: "🇧🇦 Bosanski", en: "🇬🇧 English" };

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function fmtDate(raw: string) {
  const d = new Date(raw.replace(" ", "T") + "Z");
  return d.toLocaleString("bs-BA", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZone: "Europe/Sarajevo",
  });
}

function isVisible(l: { user_name: string; pct: number; time_seconds: number }) {
  const name = l.user_name.trim();
  if (name === "") return false;
  if (!/[a-zA-ZšđžćčŠĐŽĆČ]/.test(name)) return false;
  if (l.pct === 100 && l.time_seconds < 15) return false;
  return true;
}

export default function AdminLogsPage() {
  const logs: LogEntry[] = getAllLogs();
  const visibleLogs = logs.filter(isVisible);

  const totalTests  = logs.length;
  const uniqueUsers = new Set(logs.map(l => l.user_name)).size;
  const avgPct = totalTests > 0
    ? Math.round(logs.reduce((s, l) => s + l.pct, 0) / totalTests)
    : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">📋 Admin Log — Matura Quiz</h1>
          <p className="text-gray-400 text-sm">Sve aktivnosti · Newest first</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <div className="text-3xl font-black text-indigo-400">{totalTests}</div>
            <div className="text-xs text-gray-400 mt-1">Ukupno testova</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <div className="text-3xl font-black text-emerald-400">{uniqueUsers}</div>
            <div className="text-xs text-gray-400 mt-1">Jedinstvenih korisnika</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <div className="text-3xl font-black text-amber-400">{avgPct}%</div>
            <div className="text-xs text-gray-400 mt-1">Prosječna tačnost</div>
          </div>
        </div>

        {/* Log table */}
        {visibleLogs.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400">
            Nema zabilježenih testova.
          </div>
        ) : (
          <div className="bg-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-700 text-gray-300 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Korisnik</th>
                    <th className="px-4 py-3 text-left">Predmet</th>
                    <th className="px-4 py-3 text-left">Oblast</th>
                    <th className="px-4 py-3 text-right">Tačnost</th>
                    <th className="px-4 py-3 text-right">Rezultat</th>
                    <th className="px-4 py-3 text-right">Vrijeme</th>
                    <th className="px-4 py-3 text-left">Datum i vrijeme</th>
                    <th className="px-4 py-3 text-left">IP adresa</th>
                    <th className="px-4 py-3 text-left">Browser</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {visibleLogs.map((log, i) => {
                    const pctColor =
                      log.pct >= 90 ? "text-yellow-400" :
                      log.pct >= 75 ? "text-green-400" :
                      log.pct >= 55 ? "text-blue-400" :
                      log.pct >= 40 ? "text-amber-400" : "text-red-400";
                    const browser = log.user_agent
                      ? log.user_agent.length > 60
                        ? log.user_agent.slice(0, 60) + "…"
                        : log.user_agent
                      : "—";
                    return (
                      <tr key={log.id} className={i % 2 === 0 ? "bg-gray-800" : "bg-gray-750"}>
                        <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{log.id}</td>
                        <td className="px-4 py-2.5 font-semibold text-white">{log.user_name}</td>
                        <td className="px-4 py-2.5 text-gray-300 whitespace-nowrap">{SUBJECT[log.subject] ?? log.subject}</td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs max-w-[140px] truncate">
                          {log.section_filter
                            ? log.section_filter.split(",").join(", ")
                            : <span className="italic text-gray-600">Sve oblasti</span>}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-black ${pctColor}`}>{log.pct}%</td>
                        <td className="px-4 py-2.5 text-right text-gray-300 font-mono text-xs">
                          {log.correct_count}/{log.question_count}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-300 font-mono text-xs">{fmt(log.time_seconds)}</td>
                        <td className="px-4 py-2.5 text-gray-300 text-xs whitespace-nowrap">{fmtDate(log.completed_at)}</td>
                        <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{log.ip_address ?? "—"}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs max-w-[200px] truncate" title={log.user_agent ?? ""}>
                          {browser}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-600 mt-6">
          Stranica nije vidljiva u aplikaciji · Osvježi za nove podatke
        </p>
      </div>
    </div>
  );
}
