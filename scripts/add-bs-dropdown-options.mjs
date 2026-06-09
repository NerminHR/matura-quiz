/**
 * Migration: convert 29 BS free-text fill_in questions to dropdown (Grammar MCQ style).
 * For questions with "/" variants in correct_answer, we normalise to the primary canonical form.
 * Positions are deliberately shuffled so the correct option appears in all 4 slots.
 */

import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "../app/matura.sqlite");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// Each entry: [id, correct_answer (canonical), option_a, option_b, option_c, option_d]
const questions = [
  // ── Književnost – literary figures ─────────────────────────────────────────
  // ID 33 – slavenska antiteza (correct in pos a)
  [33, "slavenska antiteza",
    "slavenska antiteza", "gradacija", "apostrofa", "alegorija"],

  // ID 34 – frkće (onomatopoeic verb from the verse; correct in pos b)
  [34, "frkće",
    "grabi", "frkće", "vabi", "stoji"],

  // ID 35 – aliteracija (repetition of consonants; correct in pos a)
  [35, "aliteracija",
    "aliteracija", "asonanca", "onomatopeja", "eufemizam"],

  // ID 36 – asonanca (repetition of vowels; correct in pos c)
  [36, "asonanca",
    "aliteracija", "onomatopeja", "asonanca", "hiperbola"],

  // ID 37 – rumenijem (stalni epitet from the verse; correct in pos b)
  [37, "rumenijem",
    "mrtvoga", "rumenijem", "živoga", "dragoga"],

  // ID 38 – metafora (correct in pos a)
  [38, "metafora",
    "metafora", "poređenje", "personifikacija", "hiperbola"],

  // ID 39 – personifikacija (correct in pos d)
  [39, "personifikacija",
    "metafora", "apostrofa", "poređenje", "personifikacija"],

  // ID 41 – anafora (correct in pos b)
  [41, "anafora",
    "epifora", "anafora", "simbol", "refren"],

  // ID 42 – inverzija (correct in pos a)
  [42, "inverzija",
    "inverzija", "elipsa", "gradacija", "asindet"],

  // ── Strofa / rima ────────────────────────────────────────────────────────
  // ID 43 – tercina (3-line stanza; correct in pos c)
  [43, "tercina",
    "katren", "distih", "tercina", "kvinta"],

  // ID 44 – katren (4-line stanza; correct in pos a)
  [44, "katren",
    "katren", "tercina", "distih", "sekstina"],

  // ID 45 – ukrštena rima (ABAB; correct in pos b)
  [45, "ukrštena rima",
    "obgrljena rima", "ukrštena rima", "parna rima", "slobodan stih"],

  // ID 46 – obgrljena rima (ABBA; correct in pos a)
  [46, "obgrljena rima",
    "obgrljena rima", "ukrštena rima", "parna rima", "naizmjenična rima"],

  // ID 47 – katren (4-line stanza; correct in pos b)
  [47, "katren",
    "tercina", "katren", "distih", "oktava"],

  // ID 48 – tercina (3-line stanza; correct in pos d)
  [48, "tercina",
    "katren", "distih", "monostih", "tercina"],

  // ── Medijska kultura ─────────────────────────────────────────────────────
  // ID 60 – kulisa (correct in pos a)
  [60, "kulisa",
    "kulisa", "scena", "dekor", "rekvizita"],

  // ── Fonetika ─────────────────────────────────────────────────────────────
  // ID 61 – fonetika (correct in pos b)
  [61, "fonetika",
    "morfologija", "fonetika", "sintaksa", "fonologija"],

  // ── Sintaksa – sentence functions ────────────────────────────────────────
  // ID 147 – objekat (correct in pos a)
  [147, "objekat",
    "objekat", "subjekat", "atribut", "priloška odredba"],

  // ID 148 – subjekat (correct in pos c)
  [148, "subjekat",
    "predikat", "objekat", "subjekat", "atribut"],

  // ID 149 – atribut (correct in pos b)
  [149, "atribut",
    "subjekat", "atribut", "priloška odredba", "objekat"],

  // ── Sintaksa – clause types ───────────────────────────────────────────────
  // ID 151 – suprotna (correct in pos a)
  [151, "suprotna",
    "suprotna", "sastavna", "rastavna", "zaključna"],

  // ID 152 – zaključna (correct in pos c)
  [152, "zaključna",
    "suprotna", "uzročna", "zaključna", "sastavna"],

  // ID 153 – atributska (correct in pos a)
  [153, "atributska",
    "atributska", "uzročna", "vremenska", "namjerna"],

  // ID 154 – vremenska (correct in pos b)
  [154, "vremenska",
    "uzročna", "vremenska", "namjerna", "pogodbena"],

  // ID 155 – načinska (correct in pos d)
  [155, "načinska",
    "uzročna", "pogodbena", "namjerna", "načinska"],

  // ID 156 – pogodbena (correct in pos a)
  [156, "pogodbena",
    "pogodbena", "uzročna", "namjerna", "vremenska"],

  // ID 157 – uzročna (correct in pos c)
  [157, "uzročna",
    "pogodbena", "namjerna", "uzročna", "načinska"],

  // ID 158 – namjerna (correct in pos a)
  [158, "namjerna",
    "namjerna", "uzročna", "pogodbena", "atributska"],

  // ── Leksika ──────────────────────────────────────────────────────────────
  // ID 159 – sinonimi (correct in pos b)
  [159, "sinonimi",
    "antonimi", "sinonimi", "homonimi", "paronimi"],
];

const stmt = db.prepare(`
  UPDATE questions
  SET correct_answer = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?
  WHERE id = ?
`);

const run = db.transaction(() => {
  let updated = 0;
  for (const [id, correct, a, b, c, d] of questions) {
    const result = stmt.run(correct, a, b, c, d, id);
    if (result.changes === 0) {
      console.warn(`  WARNING: ID ${id} not found or unchanged`);
    } else {
      console.log(`  ✓ ID ${id}: correct="${correct}" | options: ${a} / ${b} / ${c} / ${d}`);
      updated++;
    }
  }
  return updated;
});

const count = run();
db.pragma("wal_checkpoint(TRUNCATE)");
db.close();

console.log(`\nDone. Updated ${count} / ${questions.length} questions.`);
