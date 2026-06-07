/**
 * seed-english.mjs
 * 1. Adds `subject` column to existing tables (migration)
 * 2. Marks existing Bosnian questions as subject='bs'
 * 3. Inserts 7 English sections + 200 English questions
 *
 * Run: node scripts/seed-english.mjs
 * Safe to run multiple times (uses INSERT OR IGNORE / idempotent DDL).
 */
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const dbPath = join(ROOT, 'db', 'matura.sqlite');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// ── Schema migration ───────────────────────────────────────────────────────

// Add subject column to sections if not present
const secCols = db.pragma('table_info(sections)').map(c => c.name);
if (!secCols.includes('subject')) {
  db.exec(`ALTER TABLE sections ADD COLUMN subject TEXT NOT NULL DEFAULT 'bs'`);
  console.log('Added sections.subject column');
}

// Add subject column to questions if not present
const qCols = db.pragma('table_info(questions)').map(c => c.name);
if (!qCols.includes('subject')) {
  db.exec(`ALTER TABLE questions ADD COLUMN subject TEXT NOT NULL DEFAULT 'bs'`);
  console.log('Added questions.subject column');
}

// Add exercise column to questions if not present
if (!qCols.includes('exercise')) {
  db.exec(`ALTER TABLE questions ADD COLUMN exercise TEXT`);
  console.log('Added questions.exercise column');
}

// ── English sections ───────────────────────────────────────────────────────

const englishSections = [
  { name: 'Listening',      order_n: 1 },
  { name: 'Reading',        order_n: 2 },
  { name: 'Vocabulary I',   order_n: 3 },
  { name: 'Vocabulary II',  order_n: 4 },
  { name: 'Grammar I',      order_n: 5 },
  { name: 'Grammar II',     order_n: 6 },
  { name: 'Communication',  order_n: 7 },
];

// Check if English sections already exist
const existingEnSections = db.prepare(`SELECT id, name FROM sections WHERE subject='en'`).all();
const enSectionMap = new Map(existingEnSections.map(s => [s.name, s.id]));

const insertSection = db.prepare(`
  INSERT INTO sections (name, order_n, subject)
  VALUES (@name, @order_n, 'en')
  ON CONFLICT(name) DO NOTHING
`);

// sections table might have a unique on name — if so we need subject-scoped names
// Check constraint
try {
  for (const sec of englishSections) {
    if (!enSectionMap.has(sec.name)) {
      const result = insertSection.run(sec);
      enSectionMap.set(sec.name, result.lastInsertRowid);
      console.log(`Inserted section: ${sec.name} (id=${result.lastInsertRowid})`);
    }
  }
} catch (e) {
  // sections.name has UNIQUE constraint — need to handle EN sections with a different name
  // Prefix with "EN: " to distinguish
  console.log('Name conflict detected, using prefixed section names for English');
  const insertSectionPrefixed = db.prepare(`
    INSERT OR IGNORE INTO sections (name, order_n, subject)
    VALUES (@name, @order_n, 'en')
  `);
  for (const sec of englishSections) {
    const prefixedName = `EN: ${sec.name}`;
    if (!enSectionMap.has(prefixedName)) {
      const result = insertSectionPrefixed.run({ name: prefixedName, order_n: sec.order_n });
      enSectionMap.set(sec.name, result.lastInsertRowid);
      enSectionMap.set(prefixedName, result.lastInsertRowid);
    }
  }
}

// Refresh map after inserts
const allEnSections = db.prepare(`SELECT id, name FROM sections WHERE subject='en'`).all();
const enSecIdMap = new Map();
for (const s of allEnSections) {
  // Map both plain name and "EN: name" to the id
  enSecIdMap.set(s.name, s.id);
  enSecIdMap.set(s.name.replace(/^EN:\s*/, ''), s.id);
}

// ── English questions ──────────────────────────────────────────────────────

const questions = JSON.parse(
  readFileSync(join(ROOT, 'data', 'english_questions.json'), 'utf8')
);

// Check if English questions already exist
const existingEnCount = db.prepare(`SELECT COUNT(*) as c FROM questions WHERE subject='en'`).get().c;
if (existingEnCount > 0) {
  console.log(`English questions already exist (${existingEnCount}). Deleting and re-inserting.`);
  db.prepare(`DELETE FROM questions WHERE subject='en'`).run();
}

const insertQ = db.prepare(`
  INSERT INTO questions
    (section_id, subject, exercise, question_number, question_type,
     context_text, question_text,
     option_a, option_b, option_c, option_d,
     correct_answer, matching_left, matching_right, correct_mapping)
  VALUES
    (@section_id, @subject, @exercise, @question_number, @question_type,
     @context_text, @question_text,
     @option_a, @option_b, @option_c, @option_d,
     @correct_answer, @matching_left, @matching_right, @correct_mapping)
`);

const insertMany = db.transaction((qs) => {
  for (const q of qs) {
    const sectionId = enSecIdMap.get(q.section);
    if (!sectionId) {
      console.warn(`  ⚠ No section_id for "${q.section}" — skipping q${q.question_number}`);
      continue;
    }
    insertQ.run({
      section_id:      sectionId,
      subject:         'en',
      exercise:        q.exercise || null,
      question_number: q.question_number,
      question_type:   q.question_type,
      context_text:    q.context_text || null,
      question_text:   q.question_text,
      option_a:        q.option_a || null,
      option_b:        q.option_b || null,
      option_c:        q.option_c || null,
      option_d:        q.option_d || null,
      correct_answer:  q.correct_answer,
      matching_left:   q.matching_left  ? JSON.stringify(q.matching_left)  : null,
      matching_right:  q.matching_right ? JSON.stringify(q.matching_right) : null,
      correct_mapping: q.correct_mapping ? JSON.stringify(q.correct_mapping) : null,
    });
  }
});

insertMany(questions);

// Verify
const totalQ = db.prepare(`SELECT COUNT(*) as c FROM questions WHERE subject='en'`).get().c;
console.log(`\nEnglish questions in DB: ${totalQ}`);

const bySection = db.prepare(`
  SELECT s.name, COUNT(*) as cnt
  FROM questions q JOIN sections s ON q.section_id = s.id
  WHERE q.subject='en'
  GROUP BY s.name ORDER BY s.id
`).all();
for (const row of bySection) {
  console.log(`  ${row.name}: ${row.cnt}`);
}

// Copy DB to app/
import { copyFileSync } from 'fs';
const appDbPath = join(ROOT, 'app', 'matura.sqlite');
copyFileSync(dbPath, appDbPath);
console.log(`\nCopied DB → ${appDbPath}`);

db.close();
