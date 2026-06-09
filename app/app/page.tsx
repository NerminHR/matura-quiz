"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Subject = "bs" | "en";

const SUBJECT_CONFIG = {
  bs: {
    label: "Bosanski / Hrvatski / Srpski",
    subtitle: "Jezik i književnost · 200 pitanja · Kanton Sarajevo 2022/23",
    flag: "🇧🇦",
    color: "indigo",
    startLabel: "Počni test 🚀",
    allLabel: "🌐 Sve oblasti (miješano)",
    countLabel: "Broj pitanja",
    areaLabel: "Oblast (izaberite ili ostavite sve)",
    randomNote: "Pitanja se biraju nasumično pri svakom pokretanju.",
    sectionIcons: {
      "Književnost":           "📚",
      "Medijska kultura":      "🎬",
      "Fonetika i fonologija": "🔤",
      "Morfologija":           "📝",
      "Tvorba riječi":         "🔧",
      "Sintaksa":              "🔗",
      "Leksika":               "📖",
      "Pravopis":              "✍️",
      "Historija jezika":      "🏛️",
    } as Record<string, string>,
  },
  en: {
    label: "English Language",
    subtitle: "Exam preparation · 200 questions · Kanton Sarajevo 2022/23",
    flag: "🇬🇧",
    color: "emerald",
    startLabel: "Start quiz 🚀",
    allLabel: "🌐 All topics (mixed)",
    countLabel: "Number of questions",
    areaLabel: "Topic (choose or leave all)",
    randomNote: "Questions are selected randomly each time.",
    sectionIcons: {
      "Listening":     "🎧",
      "Reading":       "📖",
      "Vocabulary I":  "🔤",
      "Vocabulary II": "📝",
      "Grammar I":     "📐",
      "Grammar II":    "🔧",
      "Communication": "💬",
    } as Record<string, string>,
  },
};

export default function HomePage() {
  const router = useRouter();

  const [userName, setUserName]                 = useState<string | null>(null);
  const [nameInput, setNameInput]               = useState("");
  const [subject, setSubject]                   = useState<Subject | null>(null);
  const [sections, setSections]                 = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [allSelected, setAllSelected]           = useState(true);
  const [questionCount, setQuestionCount]       = useState(20);

  // Read persisted name on mount
  useEffect(() => {
    const saved = localStorage.getItem("matura_user");
    if (saved) setUserName(saved);
  }, []);

  // Fetch sections when subject changes
  useEffect(() => {
    if (!subject) return;
    setSections([]);
    setSelectedSections([]);
    setAllSelected(true);
    fetch(`/api/sections?subject=${subject}`)
      .then((r) => r.json())
      .then((d) => setSections(d.sections ?? []));
  }, [subject]);

  function saveName() {
    const name = nameInput.trim();
    if (!name) return;
    localStorage.setItem("matura_user", name);
    setUserName(name);
  }

  function logout() {
    localStorage.removeItem("matura_user");
    setUserName(null);
    setNameInput("");
    setSubject(null);
  }

  function toggleSection(section: string) {
    setSelectedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
    setAllSelected(false);
  }

  function toggleAll() {
    const next = !allSelected;
    setAllSelected(next);
    if (next) setSelectedSections([]);
  }

  function startQuiz() {
    if (!subject || !userName) return;
    const params = new URLSearchParams();
    params.set("count", String(questionCount));
    params.set("subject", subject);
    params.set("user", userName);
    if (!allSelected && selectedSections.length > 0) {
      params.set("sections", selectedSections.join(","));
    }
    router.push(`/quiz?${params.toString()}`);
  }

  const canStart = !!subject && (allSelected || selectedSections.length > 0);
  const cfg = subject ? SUBJECT_CONFIG[subject] : null;
  const isEn = subject === "en";
  const accentBg      = isEn ? "bg-emerald-600"    : "bg-indigo-600";
  const accentHover   = isEn ? "hover:bg-emerald-700" : "hover:bg-indigo-700";
  const accentBorder  = isEn ? "border-emerald-600"   : "border-indigo-600";
  const accentText    = isEn ? "text-emerald-800"     : "text-indigo-800";
  const accentBg2     = isEn ? "bg-emerald-50"        : "bg-indigo-50";
  const accentBorder2 = isEn ? "border-emerald-300"   : "border-indigo-300";
  const accentAccent  = isEn ? "accent-emerald-600"   : "accent-indigo-600";

  const cornerLabel = (
    <span className="fixed top-3 right-4 text-xs font-semibold text-gray-400 tracking-wide z-50 select-none">
      MMB IX<span className="text-[10px]">1</span>
    </span>
  );

  // ── Login screen ─────────────────────────────────────────────────────────
  if (!userName) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        {cornerLabel}
        <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8">
          <div className="text-center mb-8">
            <div className="text-6xl mb-3">🎓</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Eksterna matura</h1>
            <p className="text-sm text-gray-500">Kanton Sarajevo 2022/23</p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Vaše ime / Your name
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              placeholder="Upišite ime..."
              maxLength={50}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-indigo-500 transition-colors"
              autoFocus
            />
          </div>

          <button
            onClick={saveName}
            disabled={!nameInput.trim()}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base rounded-xl transition-colors shadow-md"
          >
            Nastavi / Continue →
          </button>

          <p className="text-center text-xs text-gray-400 mt-4">
            Ime se pamti automatski · Name is saved automatically
          </p>
        </div>
      </main>
    );
  }

  // ── Subject picker ────────────────────────────────────────────────────────
  if (!subject) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        {cornerLabel}
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
          {/* User header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-xs text-gray-400">Prijavljeni kao / Logged in as</p>
              <p className="font-bold text-gray-900">👋 {userName}</p>
            </div>
            <button
              onClick={logout}
              className="text-xs text-gray-400 hover:text-red-500 border border-gray-200 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              Odjava / Logout
            </button>
          </div>

          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-gray-900 mb-1">Odaberite predmet</h1>
            <p className="text-sm text-gray-500">Choose a subject</p>
          </div>

          <div className="flex flex-col gap-4">
            <button
              onClick={() => setSubject("bs")}
              className="flex items-center gap-4 p-5 rounded-xl border-2 border-indigo-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left"
            >
              <span className="text-4xl">🇧🇦</span>
              <div>
                <div className="font-bold text-gray-900">Bosanski / Hrvatski / Srpski</div>
                <div className="text-sm text-gray-500">Jezik i književnost · 200 pitanja</div>
              </div>
            </button>

            <button
              onClick={() => setSubject("en")}
              className="flex items-center gap-4 p-5 rounded-xl border-2 border-emerald-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left"
            >
              <span className="text-4xl">🇬🇧</span>
              <div>
                <div className="font-bold text-gray-900">English Language</div>
                <div className="text-sm text-gray-500">Exam preparation · 200 questions</div>
              </div>
            </button>
          </div>

          {/* Note and PDF links */}
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
            <p className="mb-3 leading-relaxed">
              <span className="font-semibold">Napomena:</span> Ovo su samo testovi za provjeru znanja iz bosanskog i engleskog jezika za eksternu maturu. Za pripremu koristite zvanične ispitne kataloge koji se nalaze na linkovima ispod.
            </p>
            <div className="flex flex-col gap-2">
              <a
                href="/bjk_hjk_sjk_katalog_eksterna_matura_2022_2023.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-indigo-700 hover:text-indigo-900 font-medium underline underline-offset-2"
              >
                📄 Ispitni katalog — Bosanski / Hrvatski / Srpski jezik
              </a>
              <a
                href="/engleski_jezik_-ispitni_katalog_pitanja.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-emerald-700 hover:text-emerald-900 font-medium underline underline-offset-2"
              >
                📄 Ispitni katalog — Engleski jezik
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ── Quiz config ───────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      {cornerLabel}
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8">
        {/* Header with back + user */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setSubject(null)}
            className="text-gray-400 hover:text-gray-700 transition-colors text-lg"
          >
            ←
          </button>
          <div className="text-center flex-1">
            <div className="text-3xl mb-1">{cfg!.flag}</div>
            <h1 className="text-xl font-bold text-gray-900">{cfg!.label}</h1>
            <p className="text-xs text-gray-500">{cfg!.subtitle}</p>
          </div>
          <button
            onClick={logout}
            className="text-xs text-gray-400 hover:text-red-500 border border-gray-200 hover:border-red-300 px-2 py-1 rounded-lg transition-colors"
            title="Odjava / Logout"
          >
            ⎋
          </button>
        </div>

        {/* Question count */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            {cfg!.countLabel}
          </label>
          <div className="flex gap-2">
            {[10, 20, 30, 200].map((n) => (
              <button
                key={n}
                onClick={() => setQuestionCount(n)}
                className={`flex-1 py-2 rounded-lg border-2 text-sm font-bold transition-colors ${
                  questionCount === n
                    ? `${accentBg} ${accentBorder} text-white`
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Section filter */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            {cfg!.areaLabel}
          </label>

          <label className={`flex items-center gap-3 p-3 rounded-lg border-2 mb-2 cursor-pointer transition-colors ${accentBorder2} ${accentBg2}`}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className={`w-4 h-4 ${accentAccent}`}
            />
            <span className={`text-sm font-bold ${accentText}`}>{cfg!.allLabel}</span>
          </label>

          <div className="grid grid-cols-1 gap-1.5 max-h-52 overflow-y-auto pr-1">
            {sections.map((section) => {
              const active = !allSelected && selectedSections.includes(section);
              return (
                <label
                  key={section}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border-2 cursor-pointer transition-colors ${
                    allSelected
                      ? "opacity-50 border-gray-100 bg-gray-50 cursor-default"
                      : active
                      ? `${accentBorder2} ${accentBg2}`
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => !allSelected && toggleSection(section)}
                    disabled={allSelected}
                    className={`w-4 h-4 ${accentAccent}`}
                  />
                  <span className="text-sm text-gray-700">
                    {(cfg!.sectionIcons[section] ?? "📋")} {section}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <button
          onClick={startQuiz}
          disabled={!canStart}
          className={`w-full py-4 ${accentBg} ${accentHover} disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl transition-colors shadow-md`}
        >
          {cfg!.startLabel}
        </button>

        <p className="text-center text-xs text-gray-400 mt-4">{cfg!.randomNote}</p>
      </div>
    </main>
  );
}
