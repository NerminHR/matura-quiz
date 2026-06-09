import Database from "better-sqlite3";
import path from "path";
import type { Question } from "@/types/question";

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    const dbPath = path.join(process.cwd(), "matura.sqlite");
    _db = new Database(dbPath);
    _db.pragma("journal_mode = WAL");
    _db.exec(`
      CREATE TABLE IF NOT EXISTS test_results (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        user_name       TEXT    NOT NULL,
        subject         TEXT    NOT NULL,
        section_filter  TEXT,
        question_count  INTEGER NOT NULL,
        correct_count   INTEGER NOT NULL,
        time_seconds    INTEGER NOT NULL,
        completed_at    TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_res_user_subj ON test_results(user_name, subject);
    `);
    // Add extra columns if they don't exist yet (ALTER TABLE ignores errors)
    for (const col of [
      "ALTER TABLE test_results ADD COLUMN ip_address TEXT",
      "ALTER TABLE test_results ADD COLUMN user_agent TEXT",
    ]) {
      try { _db.exec(col); } catch { /* column already exists */ }
    }
  }
  return _db;
}

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

// Each row = one individual test result
export type LeaderboardEntry = {
  id: number;
  user_name: string;
  pct: number;
  correct_count: number;
  question_count: number;
  time_seconds: number;
  completed_at: string; // "YYYY-MM-DD HH:MM:SS" UTC
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
}): SaveResultResponse {
  const db = getDb();

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

type RawRow = { id: number; user_name: string; correct_count: number; question_count: number; time_seconds: number; completed_at: string };

function getLeaderboardData(
  subject: string,
  forUser: string,
  currentResultId: number,
): { leaderboard: LeaderboardEntry[]; currentResultRank: number; userStats: UserStats | null } {
  const db = getDb();

  // All individual results for this subject, sorted best first
  const rows = db
    .prepare(
      `SELECT id, user_name, correct_count, question_count, time_seconds, completed_at
       FROM test_results
       WHERE subject = ?
       ORDER BY ROUND(correct_count * 100 / question_count) DESC, time_seconds ASC, id DESC`
    )
    .all(subject) as RawRow[];

  const toEntry = (r: RawRow): LeaderboardEntry => ({
    id: r.id,
    user_name: r.user_name,
    pct: Math.round((r.correct_count * 100) / r.question_count),
    correct_count: r.correct_count,
    question_count: r.question_count,
    time_seconds: r.time_seconds,
    completed_at: r.completed_at,
  });

  const all = rows.map(toEntry);

  // Rank of the just-saved result in the overall list
  const currentResultRank = all.findIndex((e) => e.id === currentResultId) + 1;

  // Top 20 for leaderboard display; always include current result if outside top 20
  const top20 = all.slice(0, 20);
  const currentInTop = top20.some((e) => e.id === currentResultId);
  const leaderboard = currentInTop ? top20 : [...top20, all[currentResultRank - 1]].filter(Boolean);

  // Personal stats aggregated for this user
  const userRows = all.filter((r) => r.user_name === forUser);
  let userStats: UserStats | null = null;
  if (userRows.length > 0) {
    const bestPct = Math.max(...userRows.map((r) => r.pct));
    const bestTime = Math.min(...userRows.filter((r) => r.pct === bestPct).map((r) => r.time_seconds));
    const avgPct = Math.round(userRows.reduce((s, r) => s + r.pct, 0) / userRows.length);
    userStats = { totalGames: userRows.length, bestPct, avgPct, bestTime };
  }

  return { leaderboard, currentResultRank, userStats };
}

// ─── Admin log access ────────────────────────────────────────────────────────

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
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, user_name, subject, section_filter,
           question_count, correct_count,
           ROUND(correct_count * 100 / question_count) AS pct,
           time_seconds, completed_at, ip_address, user_agent
    FROM test_results
    ORDER BY id DESC
  `).all() as LogEntry[];
  return rows;
}
