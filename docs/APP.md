# Matura Quiz – Application Guide

## Quick start

```bash
cd matura-quiz/app
npm install
npm run dev        # http://localhost:3000
```

The SQLite database (`app/matura.sqlite`) is already included in the repo.  
If you need to regenerate it, see [DATA_MIGRATION.md](../docs/DATA_MIGRATION.md).

## Production build

```bash
cd matura-quiz/app
npm run build
npm start
```

## Project structure

```
app/
├── app/
│   ├── page.tsx            Home page – section selector + start button
│   ├── quiz/page.tsx       Quiz page – 20 questions, one at a time
│   ├── results/page.tsx    Score + per-question review
│   └── api/
│       ├── questions/route.ts   GET /api/questions?count=20[&section=...]
│       └── sections/route.ts    GET /api/sections
├── components/
│   ├── QuizShell.tsx       Progress bar + navigation wrapper
│   ├── MCQQuestion.tsx     Radio-button MCQ with auto-reveal on selection
│   ├── FillInQuestion.tsx  Text input + "Reveal answer" button
│   └── MatchingQuestion.tsx  4 dropdowns + reveal with correct/incorrect highlights
├── lib/
│   └── db.ts               better-sqlite3 singleton; getRandomQuestions()
├── types/
│   └── question.ts         TypeScript interfaces: Question, UserAnswer, QuizResult
└── matura.sqlite           SQLite database (200 questions)
```

## API reference

### `GET /api/questions`

Returns random questions from the database.

| Param | Default | Description |
|-------|---------|-------------|
| `count` | 20 | Number of questions to return (1–50) |
| `section` | — | If set, filter by section name (exact match) |

**Example:**
```
GET /api/questions?count=20
GET /api/questions?count=10&section=Pravopis
```

**Response:**
```json
{ "questions": [ ...Question[] ] }
```

### `GET /api/sections`

Returns the list of all section names in order.

```json
{ "sections": ["Književnost", "Medijska kultura", ...] }
```

## Quiz flow

1. **Home** — user picks question count (10/20/30) and optionally selects sections
2. **Quiz** — 200 pool is fetched and filtered client-side when sections are selected; one question shown at a time
   - **MCQ**: clicking an answer reveals correct/wrong immediately (auto-reveal)
   - **Fill-in**: user types an answer, then taps "Provjeri" to see the correct text
   - **Matching**: user selects dropdowns, then taps "Provjeri" to see which pairs were right
3. **Results** — score card (`X / N` for MCQ + matching), per-question review with correct answers highlighted

## Scoring

- **MCQ**: 1 point if the selected letter matches `correct_answer`
- **Matching**: 1 point only if ALL 4 pairs are correct
- **Fill-in**: not auto-graded — shown for student self-assessment
- **Max score** = number of MCQ + matching questions in the quiz

## Adding questions manually

Insert a row into `questions` via any SQLite browser or with a script:

```js
import Database from 'better-sqlite3';
const db = new Database('app/matura.sqlite');
db.prepare(`
  INSERT INTO questions (section_id, question_number, question_type,
    question_text, option_a, option_b, option_c, option_d, correct_answer)
  VALUES (8, 25, 'mcq', 'Pitanje?', 'Odg A', 'Odg B', 'Odg C', 'Odg D', 'b')
`).run();
```

Section IDs: 1=Književnost, 2=Medijska kultura, 3=Fonetika, 4=Morfologija,
5=Tvorba, 6=Sintaksa, 7=Leksika, 8=Pravopis, 9=Historija

## Deployment (Vercel)

1. Push the `app/` directory (or the whole monorepo with root pointing at `app/`)
2. Add `matura.sqlite` to the repository (it's only ~200 KB)
3. Set environment variable if the DB path changes:

```
DB_PATH=/var/task/matura.sqlite
```

> **Note:** Vercel serverless functions have a 50 MB limit and read-only filesystem. The SQLite file must be bundled with the deployment. For production with frequent writes, switch to a hosted SQLite service (Turso, Neon + libSQL) or PostgreSQL.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_PATH` | `./matura.sqlite` (relative to `process.cwd()`) | Path to the SQLite database file |

## Tech stack

| Layer | Package | Version |
|-------|---------|---------|
| Framework | Next.js (App Router) | 16.x |
| Database | better-sqlite3 | latest |
| Styling | Tailwind CSS | v4 |
| Language | TypeScript | 5.x |
| Node.js | Node.js | ≥20 |
