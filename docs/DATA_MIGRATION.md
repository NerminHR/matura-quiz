# Data Migration – PDF to SQLite

## Overview

The PDF (`bjk_hjk_sjk_katalog_eksterna_matura_2022_2023.pdf`) is processed by three scripts in the `scripts/` folder. Run them once in order to populate `db/matura.sqlite`.

## Prerequisites

```bash
cd matura-quiz       # project root (NOT the app/ sub-folder)
npm install pdfjs-dist better-sqlite3
```

## Step 1 — Extract PDF text

```bash
node scripts/extract-pdf.mjs
```

**Output:** `data/output_full.txt` (≈133 KB, 89 pages of raw text)

**Notes:**
- Uses `pdfjs-dist` in Node.js mode (`disableWorker: true`)
- Each page is delimited with `--- PAGE N ---` markers
- The font-warning messages from pdfjs are harmless

## Step 2 — Parse questions

```bash
node scripts/parse-questions.mjs
```

**Output:** `data/questions.json` — 200 question objects

**How the parser works:**

The document has two zones:
1. **Questions** (pages 9–58) — questions are grouped under section headers `5.1. KNJIŽEVNOST` through `5.9. HISTORIJA JEZIKA`
2. **Answers** (pages 59–71) — answers under matching section headers

**Pass A** — questions zone:
- Section headers are detected using the **last** regex match (skips the table-of-contents entries at the top, which use the same pattern)
- Questions are split by `^\d{1,2}\s*\.` (allows for PDF artifacts like `"9 ."` with a space before the period)
- Each question is classified by its content:
  - `Zaokruži slovo` or 4 `a)…d)` options → **MCQ**
  - `Poveži` / `Spoji` → **Matching**
  - Everything else → **Fill-in**

**Pass B** — answers zone:
- Matching answer blocks that start with `"N. a) text __d__ text"` (inline format) are parsed before simple MCQ lines to avoid mis-classification
- Fill-in answers accept any text after `N.` (single space is enough)

**After running:** Open `data/questions.json` and spot-check a few entries per section, especially literature questions with long context passages.

### JSON schema (one question)

```json
{
  "section": "Morfologija",
  "section_order": 4,
  "question_number": 25,
  "question_type": "matching",
  "context_text": null,
  "question_text": "Poveži rečenicu sa padežom imenice…",
  "options": null,
  "correct_answer": "{\"a\":\"d\",\"b\":\"a\",\"c\":\"c\",\"d\":\"b\"}",
  "matching_left":  [{ "key": "a", "text": "Odavno se spustio sumrak." }, …],
  "matching_right": [{ "key": "d", "text": "dativ" }, …],
  "correct_mapping": { "a": "d", "b": "a", "c": "c", "d": "b" }
}
```

## Step 3 — Seed database

```bash
node scripts/seed-db.mjs
```

**Output:** `db/matura.sqlite`

The script creates two tables:
- `sections` — 9 rows, one per subject area
- `questions` — 200 rows; `matching_left`, `matching_right`, `correct_mapping` stored as JSON strings

## Sections and question counts

| Section                | Questions | Types                  |
|------------------------|-----------|------------------------|
| Književnost            | 48        | MCQ 32, fill_in 16     |
| Medijska kultura       | 12        | MCQ 11, fill_in 1      |
| Fonetika i fonologija  | 25        | fill_in 17, matching 4, MCQ 4 |
| Morfologija            | 33        | MCQ 24, matching 9     |
| Tvorba riječi          | 10        | matching 8, MCQ 1, fill_in 1 |
| Sintaksa               | 30        | MCQ 16, matching 2, fill_in 12 |
| Leksika                | 10        | fill_in 1, MCQ 1, matching 8 |
| Pravopis               | 24        | MCQ 24                 |
| Historija jezika       | 8         | MCQ 8                  |

## Known quirks

- **Space before period**: PDF extracts some question numbers as `"9 ."` instead of `"9."` — the parser handles `\d{1,2}\s*\.` to cover both.
- **Fill-in Q40 (Književnost)**: The answer text repeats the question sentence with the blank filled. Displayed as-is.
- **Historija answers** show 20 parsed (vs 8 questions) — 12 extra come from the post-Historija reform section. They are ignored since no Q9–Q20 questions exist for that section.

## Re-running after changes

To re-extract from the PDF (e.g. if the PDF changes):

```bash
node scripts/extract-pdf.mjs   # → data/output_full.txt
node scripts/parse-questions.mjs  # → data/questions.json  (review manually)
node scripts/seed-db.mjs        # → db/matura.sqlite
cp db/matura.sqlite app/matura.sqlite
```
