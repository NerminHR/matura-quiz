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

export type LeaderboardEntry = {
  user_name: string;
  best_pct: number;
  best_correct: number;
  best_total: number;
  best_time: number;
  games_played: number;
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
  userRank: number;
  userStats: UserStats | null;
};

export function saveResultAndGetLeaderboard(params: {
  userName: string;
  subject: string;
  sectionFilter: string | null;
  questionCount: number;
  correctCount: number;
  timeSeconds: number;
}): SaveResultResponse {
  const db = getDb();

  const prevRow = db
    .prepare(
      "SELECT MAX(correct_count * 100 / question_count) as best FROM test_results WHERE user_name = ? AND subject = ?"
    )
    .get(params.userName, params.subject) as { best: number | null };

  const previousBestPct = prevRow.best ?? 0;
  const currentPct = Math.round((params.correctCount * 100) / params.questionCount);

  const ins = db
    .prepare(
      `INSERT INTO test_results (user_name, subject, section_filter, question_count, correct_count, time_seconds)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      params.userName,
      params.subject,
      params.sectionFilter ?? null,
      params.questionCount,
      params.correctCount,
      params.timeSeconds
    );

  const { leaderboard, userRank, userStats } = getLeaderboardData(params.subject, params.userName);

  return {
    id: ins.lastInsertRowid as number,
    isPersonalBest: currentPct > previousBestPct,
    previousBestPct,
    leaderboard,
    userRank,
    userStats,
  };
}

function getLeaderboardData(
  subject: string,
  forUser: string
): { leaderboard: LeaderboardEntry[]; userRank: number; userStats: UserStats | null } {
  const db = getDb();

  const rows = db
    .prepare(
      "SELECT user_name, correct_count, question_count, time_seconds FROM test_results WHERE subject = ?"
    )
    .all(subject) as { user_name: string; correct_count: number; question_count: number; time_seconds: number }[];

  const userMap = new Map<string, LeaderboardEntry>();
  for (const row of rows) {
    const pct = Math.round((row.correct_count * 100) / row.question_count);
    const e = userMap.get(row.user_name);
    if (!e) {
      userMap.set(row.user_name, {
        user_name: row.user_name,
        best_pct: pct,
        best_correct: row.correct_count,
        best_total: row.question_count,
        best_time: row.time_seconds,
        games_played: 1,
      });
    } else {
      e.games_played++;
      if (pct > e.best_pct || (pct === e.best_pct && row.time_seconds < e.best_time)) {
        e.best_pct = pct;
        e.best_correct = row.correct_count;
        e.best_total = row.question_count;
        e.best_time = row.time_seconds;
      }
    }
  }

  const sorted = [...userMap.values()].sort(
    (a, b) => b.best_pct - a.best_pct || a.best_time - b.best_time
  );

  const userRank = sorted.findIndex((e) => e.user_name === forUser) + 1;
  const userEntry = userMap.get(forUser);
  const allForUser = rows.filter((r) => r.user_name === forUser);

  let userStats: UserStats | null = null;
  if (userEntry && allForUser.length > 0) {
    const avgPct = Math.round(
      allForUser.reduce((s, r) => s + Math.round((r.correct_count * 100) / r.question_count), 0) /
        allForUser.length
    );
    userStats = {
      totalGames: userEntry.games_played,
      bestPct: userEntry.best_pct,
      avgPct,
      bestTime: userEntry.best_time,
    };
  }

  return { leaderboard: sorted.slice(0, 20), userRank, userStats };
}
