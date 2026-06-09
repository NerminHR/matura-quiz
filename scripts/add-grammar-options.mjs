// Adds 4 multiple-choice options to single-blank grammar conjugation fill-in questions.
// Double-blank questions (IDs 314, 318, 320, 336) are left as free-text.
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import path from "path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(dir, "../app/matura.sqlite"));

// Each row: { id, a, b, c, d, correct } where correct = exact text of the correct option
const updates = [
  // ── Present simple ────────────────────────────────────────────────────────
  { id: 311, a: "tells",          b: "told",           c: "is telling",        d: "will tell",          correct: "tells" },
  { id: 312, a: "has",            b: "had",            c: "is having",         d: "has had",            correct: "has" },
  { id: 313, a: "studied",        b: "studies",        c: "is studying",       d: "has studied",        correct: "studies" },

  // ── Present continuous ────────────────────────────────────────────────────
  { id: 315, a: "sent",           b: "have sent",      c: "send",              d: "are sending",        correct: "are sending" },
  { id: 316, a: "doesn't mow",    b: "isn't mowing",   c: "didn't mow",        d: "hasn't mowed",       correct: "isn't mowing" },
  { id: 317, a: "comes",          b: "came",           c: "is coming",         d: "has come",           correct: "is coming" },

  // ── Past simple ───────────────────────────────────────────────────────────
  { id: 319, a: "loses",          b: "has lost",       c: "is losing",         d: "lost",               correct: "lost" },
  { id: 321, a: "takes",          b: "took",           c: "has taken",         d: "is taking",          correct: "took" },
  { id: 325, a: "were reaching",  b: "have reached",   c: "reach",             d: "reached",            correct: "reached" },
  { id: 328, a: "have seen",      b: "had seen",       c: "see",               d: "saw",                correct: "saw" },

  // ── Past continuous ───────────────────────────────────────────────────────
  { id: 322, a: "painted",        b: "has painted",    c: "was painting",      d: "paints",             correct: "was painting" },
  { id: 323, a: "waited",         b: "have waited",    c: "wait",              d: "were waiting",       correct: "were waiting" },
  { id: 324, a: "walked",         b: "have walked",    c: "was walking",       d: "walk",               correct: "was walking" },
  { id: 326, a: "puts",           b: "has put",        c: "was putting",       d: "had put",            correct: "was putting" },
  { id: 327, a: "swept",          b: "have swept",     c: "were sweeping",     d: "sweep",              correct: "were sweeping" },

  // ── Future will / going to ────────────────────────────────────────────────
  { id: 329, a: "isn't",          b: "wasn't",         c: "won't be",          d: "hasn't been",        correct: "won't be" },
  { id: 330, a: "recycle",        b: "recycled",       c: "have recycled",     d: "will recycle",       correct: "will recycle" },
  { id: 331, a: "don't keep",     b: "didn't keep",    c: "won't keep",        d: "haven't kept",       correct: "won't keep" },
  { id: 332, a: "visit",          b: "visited",        c: "am going to visit", d: "had visited",        correct: "am going to visit" },
  { id: 333, a: "is",             b: "was",            c: "will be",           d: "has been",           correct: "will be" },
  { id: 334, a: "make",           b: "made",           c: "am going to make",  d: "have made",          correct: "am going to make" },

  // ── Present perfect ───────────────────────────────────────────────────────
  { id: 335, a: "cuts",           b: "is cutting",     c: "was cutting",       d: "has cut",            correct: "has cut" },
  { id: 337, a: "has",            b: "had",            c: "has had",           d: "is having",          correct: "has had" },
  { id: 338, a: "don't do",       b: "didn't do",      c: "wasn't doing",      d: "haven't done",       correct: "haven't done" },
  { id: 339, a: "know",           b: "knew",           c: "have known",        d: "had known",          correct: "have known" },
  { id: 340, a: "don't give",     b: "didn't give",    c: "hadn't given",      d: "haven't given",      correct: "haven't given" },
];

const stmt = db.prepare(`
  UPDATE questions
  SET option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_answer = ?
  WHERE id = ?
`);

const run = db.transaction(() => {
  for (const u of updates) {
    const info = stmt.run(u.a, u.b, u.c, u.d, u.correct, u.id);
    console.log(`  ID ${u.id}: ${info.changes ? "✓" : "NO CHANGE"} — correct: "${u.correct}"`);
  }
});

run();
db.pragma("wal_checkpoint(TRUNCATE)");
console.log(`\nDone. Updated ${updates.length} questions.`);
db.close();
