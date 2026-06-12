import Database from "better-sqlite3";
import path from "path";
import type { Question } from "@/types/question";

// ─── Questions DB (matura.sqlite) — tracked in git, read-only at runtime ─────
let _questionsDb: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_questionsDb) {
    const dbPath = path.join(process.cwd(), "matura.sqlite");
    _questionsDb = new Database(dbPath);
    _questionsDb.pragma("journal_mode = WAL");
  }
  return _questionsDb;
}

// ─── Results DB (results.sqlite) — NOT in git, persisted on Railway volume ───
// Set RESULTS_DB_PATH env var on Railway to a volume path, e.g. /data/results.sqlite
// Locally it defaults to results.sqlite next to matura.sqlite
let _resultsDb: Database.Database | null = null;

function getResultsDb(): Database.Database {
  if (!_resultsDb) {
    const dbPath =
      process.env.RESULTS_DB_PATH ??
      path.join(process.cwd(), "results.sqlite");
    _resultsDb = new Database(dbPath);
    _resultsDb.pragma("journal_mode = WAL");
    _resultsDb.exec(`
      CREATE TABLE IF NOT EXISTS test_results (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        user_name       TEXT    NOT NULL,
        subject         TEXT    NOT NULL,
        section_filter  TEXT,
        question_count  INTEGER NOT NULL,
        correct_count   INTEGER NOT NULL,
        time_seconds    INTEGER NOT NULL,
        completed_at    TEXT    NOT NULL DEFAULT (datetime('now')),
        ip_address      TEXT,
        user_agent      TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_res_user_subj ON test_results(user_name, subject);

      CREATE TABLE IF NOT EXISTS question_stats (
        question_id   INTEGER NOT NULL,
        subject       TEXT    NOT NULL,
        answered_count INTEGER NOT NULL DEFAULT 0,
        correct_count  INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (question_id)
      );
    `);
  }
  return _resultsDb;
}

// ─── Question types ───────────────────────────────────────────────────────────

type DbRow = {
  id: number;
  section_name: string;
  section_order: number;
  question_number: number;
  question_type: string;
  context_text: string | null;
  question_text: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_answer: string;
  matching_left: string | null;
  matching_right: string | null;
  correct_mapping: string | null;
};

function rowToQuestion(row: DbRow): Question {
  return {
    id: row.id,
    section: row.section_name,
    section_order: row.section_order,
    question_number: row.question_number,
    question_type: row.question_type as Question["question_type"],
    context_text: row.context_text,
    question_text: row.question_text,
    option_a: row.option_a,
    option_b: row.option_b,
    option_c: row.option_c,
    option_d: row.option_d,
    correct_answer: row.correct_answer,
    matching_left: row.matching_left ? JSON.parse(row.matching_left) : null,
    matching_right: row.matching_right ? JSON.parse(row.matching_right) : null,
    correct_mapping: row.correct_mapping ? JSON.parse(row.correct_mapping) : null,
  };
}

const BASE_QUERY = `
  SELECT q.id, s.name AS section_name, s.order_n AS section_order,
         q.question_number, q.question_type, q.context_text, q.question_text,
         q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer,
         q.matching_left, q.matching_right, q.correct_mapping
  FROM questions q
  JOIN sections s ON s.id = q.section_id
`;

export function getRandomQuestions(count: number, section?: string, subject = "bs"): Question[] {
  const db = getDb();
  if (section && section !== "all") {
    const stmt = db.prepare(`${BASE_QUERY} WHERE q.subject = ? AND s.name = ? ORDER BY RANDOM() LIMIT ?`);
    return (stmt.all(subject, section, count) as DbRow[]).map(rowToQuestion);
  }
  const stmt = db.prepare(`${BASE_QUERY} WHERE q.subject = ? ORDER BY RANDOM() LIMIT ?`);
  return (stmt.all(subject, count) as DbRow[]).map(rowToQuestion);
}

export function getSections(subject = "bs"): string[] {
  const db = getDb();
  return (
    db.prepare("SELECT name FROM sections WHERE subject = ? ORDER BY order_n").all(subject) as { name: string }[]
  ).map((r) => r.name);
}

// ─── Results & Leaderboard ───────────────────────────────────────────────────

export type LeaderboardEntry = {
  id: number;
  user_name: string;
  pct: number;
  correct_count: number;
  question_count: number;
  time_seconds: number;
  completed_at: string;
  section_filter: string | null;
};

export type UserStats = {
  totalGames: number;
  bestPct: number;
  avgPct: number;
  bestTime: number;
};

export type SaveResultResponse = {
  id: number;
  isPersonalBest: boolean;
  previousBestPct: number;
  leaderboard: LeaderboardEntry[];
  currentResultRank: number;
  userStats: UserStats | null;
};

export function saveResultAndGetLeaderboard(params: {
  userName: string;
  subject: string;
  sectionFilter: string | null;
  questionCount: number;
  correctCount: number;
  timeSeconds: number;
  ipAddress?: string;
  userAgent?: string;
  answers?: { questionId: number; isCorrect: boolean }[];
}): SaveResultResponse {
  const db = getResultsDb();

  const prevRow = db
    .prepare(
      "SELECT MAX(ROUND(correct_count * 100 / question_count)) as best FROM test_results WHERE user_name = ? AND subject = ?"
    )
    .get(params.userName, params.subject) as { best: number | null };

  const previousBestPct = prevRow.best ?? 0;
  const currentPct = Math.round((params.correctCount * 100) / params.questionCount);

  const ins = db
    .prepare(
      `INSERT INTO test_results (user_name, subject, section_filter, question_count, correct_count, time_seconds, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      params.userName,
      params.subject,
      params.sectionFilter ?? null,
      params.questionCount,
      params.correctCount,
      params.timeSeconds,
      params.ipAddress ?? null,
      params.userAgent ?? null,
    );

  // Per-question statistics — upsert each answered gradable question
  if (params.answers && params.answers.length > 0) {
    const upsert = db.prepare(
      `INSERT INTO question_stats (question_id, subject, answered_count, correct_count)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(question_id) DO UPDATE SET
         answered_count = answered_count + 1,
         correct_count  = correct_count + excluded.correct_count`
    );
    const tx = db.transaction((rows: { questionId: number; isCorrect: boolean }[]) => {
      for (const a of rows) upsert.run(a.questionId, params.subject, a.isCorrect ? 1 : 0);
    });
    tx(params.answers);
  }

  const newId = ins.lastInsertRowid as number;
  const { leaderboard, currentResultRank, userStats } = getLeaderboardData(params.subject, params.userName, newId);

  return {
    id: newId,
    isPersonalBest: currentPct > previousBestPct,
    previousBestPct,
    leaderboard,
    currentResultRank,
    userStats,
  };
}

type RawRow = { id: number; user_name: string; correct_count: number; question_count: number; time_seconds: number; completed_at: string; ip_address?: string | null; section_filter: string | null };

function getLeaderboardData(
  subject: string,
  forUser: string,
  currentResultId: number,
): { leaderboard: LeaderboardEntry[]; currentResultRank: number; userStats: UserStats | null } {
  const db = getResultsDb();

  const rows = (db
    .prepare(
      `SELECT id, user_name, correct_count, question_count, time_seconds, completed_at, ip_address, section_filter
       FROM test_results
       WHERE subject = ?
       ORDER BY ROUND(correct_count * 100 / question_count) DESC, time_seconds ASC, id DESC`
    )
    .all(subject) as RawRow[])
    .filter(r => !(r.ip_address === "77.238.217.185" && r.user_name.toLowerCase() !== "gandalf"));

  const toEntry = (r: RawRow): LeaderboardEntry => ({
    id: r.id,
    user_name: r.user_name.replace(/^seronja/i, "").trim() || r.user_name.trim(),
    pct: Math.round((r.correct_count * 100) / r.question_count),
    correct_count: r.correct_count,
    question_count: r.question_count,
    time_seconds: r.time_seconds,
    completed_at: r.completed_at,
    section_filter: r.section_filter,
  });

  const all = rows.map(toEntry);
  const currentResultRank = all.findIndex((e) => e.id === currentResultId) + 1;

  const userRows = all.filter((r) => r.user_name === forUser);
  let userStats: UserStats | null = null;
  if (userRows.length > 0) {
    const bestPct = Math.max(...userRows.map((r) => r.pct));
    const bestTime = Math.min(...userRows.filter((r) => r.pct === bestPct).map((r) => r.time_seconds));
    const avgPct = Math.round(userRows.reduce((s, r) => s + r.pct, 0) / userRows.length);
    userStats = { totalGames: userRows.length, bestPct, avgPct, bestTime };
  }

  return { leaderboard: all, currentResultRank, userStats };
}

// ─── Admin log access ─────────────────────────────────────────────────────────

export type LogEntry = {
  id: number;
  user_name: string;
  subject: string;
  section_filter: string | null;
  question_count: number;
  correct_count: number;
  pct: number;
  time_seconds: number;
  completed_at: string;
  ip_address: string | null;
  user_agent: string | null;
};

export function getAllLogs(): LogEntry[] {
  const db = getResultsDb();
  const rows = db.prepare(`
    SELECT id, user_name, subject, section_filter,
           question_count, correct_count,
           ROUND(correct_count * 100 / question_count) AS pct,
           time_seconds, completed_at, ip_address, user_agent
    FROM test_results
    ORDER BY id DESC
  `).all() as LogEntry[];
  return rows.map(r => ({ ...r, user_name: r.user_name.replace(/^seronja/i, "").trim() || r.user_name.trim() }));
}

// ─── Per-question statistics ────────────────────────────────────────────────

export type QuestionStat = {
  question_id: number;
  subject: string;
  section: string;
  question_number: number;
  question_type: string;
  question_text: string;
  correct_answer: string;
  answered_count: number;
  correct_count: number;
  wrong_count: number;
  wrong_pct: number;
};

export function getQuestionStats(): QuestionStat[] {
  const stats = getResultsDb()
    .prepare(`SELECT question_id, subject, answered_count, correct_count FROM question_stats WHERE answered_count > 0`)
    .all() as { question_id: number; subject: string; answered_count: number; correct_count: number }[];

  if (stats.length === 0) return [];

  // Pull question details from the questions DB and merge by id
  const qdb = getDb();
  const detailStmt = qdb.prepare(`
    SELECT q.id, s.name AS section, q.question_number, q.question_type, q.question_text, q.correct_answer
    FROM questions q JOIN sections s ON s.id = q.section_id
    WHERE q.id = ?
  `);

  const merged: QuestionStat[] = stats.map((st) => {
    const d = detailStmt.get(st.question_id) as
      | { section: string; question_number: number; question_type: string; question_text: string; correct_answer: string }
      | undefined;
    const wrong = st.answered_count - st.correct_count;
    return {
      question_id: st.question_id,
      subject: st.subject,
      section: d?.section ?? "—",
      question_number: d?.question_number ?? 0,
      question_type: d?.question_type ?? "—",
      question_text: d?.question_text ?? "(nepoznato pitanje)",
      correct_answer: d?.correct_answer ?? "—",
      answered_count: st.answered_count,
      correct_count: st.correct_count,
      wrong_count: wrong,
      wrong_pct: Math.round((wrong / st.answered_count) * 100),
    };
  });

  // Highest wrong-rate first; tie-break by sample size
  return merged.sort((a, b) => b.wrong_pct - a.wrong_pct || b.answered_count - a.answered_count);
}
