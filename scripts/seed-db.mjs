/**
 * seed-db.mjs
 * Reads data/questions.json and populates db/matura.sqlite.
 * Run: node scripts/seed-db.mjs
 * Requires: npm install better-sqlite3
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

const questions = JSON.parse(readFileSync(join(PROJECT_ROOT, 'data', 'questions.json'), 'utf8'));
const db = new Database(join(PROJECT_ROOT, 'db', 'matura.sqlite'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ───────────────────────────────────────────────────────────────────
db.exec(`
  DROP TABLE IF EXISTS questions;
  DROP TABLE IF EXISTS sections;

  CREATE TABLE sections (
    id      INTEGER PRIMARY KEY,
    name    TEXT    NOT NULL UNIQUE,
    order_n INTEGER NOT NULL
  );

  CREATE TABLE questions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    section_id      INTEGER NOT NULL REFERENCES sections(id),
    question_number INTEGER NOT NULL,
    question_type   TEXT    NOT NULL CHECK(question_type IN ('mcq','fill_in','matching')),
    context_text    TEXT,
    question_text   TEXT    NOT NULL,
    option_a        TEXT,
    option_b        TEXT,
    option_c        TEXT,
    option_d        TEXT,
    correct_answer  TEXT    NOT NULL,
    matching_left   TEXT,
    matching_right  TEXT,
    correct_mapping TEXT,
    UNIQUE(section_id, question_number)
  );

  CREATE INDEX idx_questions_section ON questions(section_id);
  CREATE INDEX idx_questions_type    ON questions(question_type);
`);

// ─── Sections ─────────────────────────────────────────────────────────────────
const sectionRows = [
  { id: 1,  name: 'Književnost',           order_n: 1 },
  { id: 2,  name: 'Medijska kultura',       order_n: 2 },
  { id: 3,  name: 'Fonetika i fonologija',  order_n: 3 },
  { id: 4,  name: 'Morfologija',            order_n: 4 },
  { id: 5,  name: 'Tvorba riječi',          order_n: 5 },
  { id: 6,  name: 'Sintaksa',               order_n: 6 },
  { id: 7,  name: 'Leksika',                order_n: 7 },
  { id: 8,  name: 'Pravopis',               order_n: 8 },
  { id: 9,  name: 'Historija jezika',       order_n: 9 },
];

const insertSection = db.prepare('INSERT INTO sections (id, name, order_n) VALUES (?, ?, ?)');
for (const s of sectionRows) insertSection.run(s.id, s.name, s.order_n);

// ─── Questions ────────────────────────────────────────────────────────────────
const sectionIdMap = {};
for (const s of sectionRows) sectionIdMap[s.name] = s.id;

const insertQ = db.prepare(`
  INSERT INTO questions
    (section_id, question_number, question_type, context_text, question_text,
     option_a, option_b, option_c, option_d, correct_answer,
     matching_left, matching_right, correct_mapping)
  VALUES
    (@section_id, @question_number, @question_type, @context_text, @question_text,
     @option_a, @option_b, @option_c, @option_d, @correct_answer,
     @matching_left, @matching_right, @correct_mapping)
`);

const insertMany = db.transaction((qs) => {
  for (const q of qs) {
    const sectionId = sectionIdMap[q.section];
    if (!sectionId) { console.warn(`Unknown section: ${q.section}`); continue; }

    insertQ.run({
      section_id:      sectionId,
      question_number: q.question_number,
      question_type:   q.question_type,
      context_text:    q.context_text ?? null,
      question_text:   q.question_text,
      option_a:        q.options?.a ?? null,
      option_b:        q.options?.b ?? null,
      option_c:        q.options?.c ?? null,
      option_d:        q.options?.d ?? null,
      correct_answer:  q.correct_answer ?? '',
      matching_left:   q.matching_left  ? JSON.stringify(q.matching_left)  : null,
      matching_right:  q.matching_right ? JSON.stringify(q.matching_right) : null,
      correct_mapping: q.correct_mapping ? JSON.stringify(q.correct_mapping) : null,
    });
  }
});

insertMany(questions);

// ─── Verify ───────────────────────────────────────────────────────────────────
const total = db.prepare('SELECT COUNT(*) AS n FROM questions').get();
const bySection = db.prepare(`
  SELECT s.name, COUNT(*) AS n
  FROM questions q JOIN sections s ON s.id = q.section_id
  GROUP BY s.name ORDER BY s.order_n
`).all();

console.log(`\nDatabase seeded: ${total.n} questions`);
console.log('By section:');
for (const row of bySection) console.log(`  ${row.name}: ${row.n}`);

// Quick random-question test
const sample = db.prepare(`
  SELECT q.*, s.name AS section_name
  FROM questions q JOIN sections s ON s.id = q.section_id
  ORDER BY RANDOM() LIMIT 3
`).all();
console.log(`\nSample random questions:`);
for (const q of sample) {
  console.log(`  [${q.section_name}] Q${q.question_number} (${q.question_type}) — answer: ${q.correct_answer?.substring(0,30)}`);
}

db.close();
console.log('\nDone. SQLite DB saved to db/matura.sqlite');
