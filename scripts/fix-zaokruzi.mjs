import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import path from "path";

const db = new Database(path.join(path.dirname(fileURLToPath(import.meta.url)), "../app/matura.sqlite"));

// Matches "Zaokruži slovo ispred tačnog odgovora." with any whitespace/newlines
// between words and optional space before period, plus any trailing whitespace/newlines
const RE = /Zaokruži\s+slovo\s+ispred\s+tačnog\s+odgovora\s*\.\s*/g;
const REPLACEMENT = "Označi tačan odgovor. ";

const rows = db.prepare("SELECT id, question_text FROM questions WHERE question_text LIKE '%Zaokruži%'").all();

const update = db.prepare("UPDATE questions SET question_text = ? WHERE id = ?");

const run = db.transaction(() => {
  let changed = 0;
  for (const row of rows) {
    const newText = row.question_text.replace(RE, REPLACEMENT).trimEnd();
    if (newText !== row.question_text) {
      update.run(newText, row.id);
      console.log(`  ID ${row.id}: ✓`);
      changed++;
    }
  }
  console.log(`\nUpdated ${changed} / ${rows.length} rows.`);
});

run();
db.pragma("wal_checkpoint(TRUNCATE)");
db.close();
