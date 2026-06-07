/**
 * parse-english.mjs
 * Parses the extracted English PDF text into structured question objects.
 * Run: node scripts/parse-english.mjs
 * Input:  C:/Users/Nermin Symphony/Downloads/english_output.txt
 * Output: data/english_questions.json
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const raw = readFileSync('C:/Users/Nermin Symphony/Downloads/english_output.txt', 'utf8');

// Strip repeated page headers
const text = raw
  .replace(/--- PAGE \d+ ---/g, '\n')
  .replace(/EKSTERNA MATURA\s+Engleski jezik[^\n]*/g, '')
  .replace(/Ministarstvo za odgoj i obrazovanje Kantona Sarajevo\s+\d+\s*/g, '')
  .replace(/\r\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function lastIndexOf(haystack, re) {
  let last = -1, m;
  const g = new RegExp(re.source, 'gm');
  while ((m = g.exec(haystack)) !== null) last = m.index;
  return last;
}

function tfToMcq(answer) {
  // 'T' → correct_answer 'a' (option_a = True), 'F' → 'b'
  return answer === 'T' ? 'a' : 'b';
}

const questions = [];
let qId = 0;
function addQ(obj) {
  questions.push({ id: ++qId, ...obj });
}

// ─────────────────────────────────────────────
// ANSWERS SECTION  (pages 51–55)
// ─────────────────────────────────────────────

const answersStart = lastIndexOf(text, /RJEŠENJA ZADATAKA/);
const answersText = answersStart >= 0 ? text.slice(answersStart) : '';

// answers map: "4.1.1" → { 1: 'F', 2: 'T', ... }  or  { 1: 'A', ... }
// For vocab/grammar/comm, also keyed per question number
const answers = {};

function setAns(key, num, val) {
  if (!answers[key]) answers[key] = {};
  answers[key][num] = val;
}

// ── 4.1 Listening ─────────────────────────────
// Pattern: 4.1.1.   STOP WASTING TIME   1   F   2   T ...
for (const m of answersText.matchAll(/4\.1\.(\d+)\.\s+[A-Z].+?(?=\n|$)/g)) {
  const exNum = m[1];
  const rest = m[0];
  for (const [, n, ans] of rest.matchAll(/(\d)\s+([TF]|[ABC])/g)) {
    setAns(`4.1.${exNum}`, parseInt(n), ans);
  }
}

// ── 4.2 Reading ───────────────────────────────
for (const m of answersText.matchAll(/4\.2\.(\d+)\.\s+[A-Z].+?(?=\n|$)/g)) {
  const exNum = m[1];
  const rest = m[0];
  // Answers may be multiline (4.2.9, 4.2.10 span two lines)
  // But we can get them from single-line capture mostly
  for (const [, n, ans] of rest.matchAll(/(\d)\s+([TF]|[ABC])/g)) {
    setAns(`4.2.${exNum}`, parseInt(n), ans);
  }
}
// Fix multiline reading answers (4.2.9, 4.2.10)
{
  const m29 = answersText.match(/4\.2\.9\..*?\n(.+)/s);
  if (m29) {
    const combined = m29[0].replace(/\n/g, ' ');
    for (const [, n, ans] of combined.matchAll(/(\d)\s+([ABC])/g)) {
      setAns('4.2.9', parseInt(n), ans);
    }
  }
  const m210 = answersText.match(/4\.2\.10\..*?\n(.+)/s);
  if (m210) {
    const combined = m210[0].replace(/\n/g, ' ');
    for (const [, n, ans] of combined.matchAll(/(\d)\s+([ABC])/g)) {
      setAns('4.2.10', parseInt(n), ans);
    }
  }
}

// ── 4.3 Vocabulary I ──────────────────────────
{
  const v1Start = answersText.indexOf('4.3. VOCABULARY I');
  const v1End   = answersText.indexOf('4.4. VOCABULARY II');
  const v1Text  = v1Start >= 0 ? answersText.slice(v1Start, v1End >= 0 ? v1End : undefined) : '';
  for (const [, n, ans] of v1Text.matchAll(/4\.3(?:10|\.\d+)\.\s+([ABC])/g)) {
    // n is the exercise number captured in group 1
  }
  // Simpler: just match all "4.3.N.\n   A/B/C" patterns
  for (const [, full, ans] of v1Text.matchAll(/4\.3(\d+)\.\s*\n\s*([ABC])\s/g)) {
    setAns('4.3', parseInt(full), ans);
  }
  // Also inline: "4.3.1.   C"
  for (const [, n, ans] of v1Text.matchAll(/4\.3\.?(\d+)\.\s+([ABC])\s*\n/g)) {
    setAns('4.3', parseInt(n), ans);
  }
}

// ── 4.4 Vocabulary II ─────────────────────────
{
  const v2Start = answersText.indexOf('4.4. VOCABULARY II');
  const v2End   = answersText.indexOf('4.5. GRAMMAR I');
  const v2Text  = v2Start >= 0 ? answersText.slice(v2Start, v2End >= 0 ? v2End : undefined) : '';

  // 4.4.1–4.4.10: single word answers, one per line
  for (const line of v2Text.split('\n')) {
    const m = line.match(/^4\.4\.(\d+)\.\s+(.+)$/);
    if (!m) continue;
    const num = parseInt(m[1]);
    if (num <= 10) setAns('4.4', num, m[2].trim());
  }
  // Manually parse 4.4.11–4.4.15 multi-sub-answers
  // Pattern: "4.4.11.   1   take part in   2   take up"
  for (const [, n, rest] of v2Text.matchAll(/4\.4\.(\d+)\.\s+1\s+(.+?)(?=\n4\.4\.|$)/gs)) {
    const exNum = parseInt(n);
    if (exNum < 11) continue;
    const combined = rest.replace(/\n/g, ' ');
    const sub1m = combined.match(/^(.+?)\s+2\s+(.+?)(?:\s+3\s+(.+))?$/);
    if (sub1m) {
      setAns(`4.4.${exNum}`, 1, sub1m[1].trim());
      setAns(`4.4.${exNum}`, 2, sub1m[2].trim());
      if (sub1m[3]) setAns(`4.4.${exNum}`, 3, sub1m[3].trim());
    }
  }
}

// ── 4.5 Grammar I ─────────────────────────────
{
  const g1Start = answersText.indexOf('4.5. GRAMMAR I');
  const g1End   = answersText.indexOf('4.6. GRAMMAR II');
  const g1Text  = g1Start >= 0 ? answersText.slice(g1Start, g1End >= 0 ? g1End : undefined) : '';

  // Each answer is the full corrected sentence after "4.5.N."
  for (const [, n, sentence] of g1Text.matchAll(/4\.5\.(\d+)\.\s+(.+?)(?=\n4\.5\.|\n4\.6\.|$)/gs)) {
    // The correct word is bolded in italic in the PDF — but extracted as plain text
    // The full sentence IS the answer; we'll use it directly
    setAns('4.5', parseInt(n), sentence.replace(/\n/g, ' ').trim());
  }
}

// ── 4.6 Grammar II ────────────────────────────
{
  const g2Start = answersText.indexOf('4.6. GRAMMAR II');
  const g2End   = answersText.indexOf('4.7. COMMUNICATION');
  const g2Text  = g2Start >= 0 ? answersText.slice(g2Start, g2End >= 0 ? g2End : undefined) : '';

  for (const [, n, sentence] of g2Text.matchAll(/4\.6\.(\d+)\.\s+(.+?)(?=\n4\.6\.|\n4\.7\.|$)/gs)) {
    setAns('4.6', parseInt(n), sentence.replace(/\n/g, ' ').trim());
  }
}

// ── 4.7 Communication ─────────────────────────
{
  const cStart = answersText.indexOf('4.7. COMMUNICATION');
  const cText  = cStart >= 0 ? answersText.slice(cStart) : '';

  // Parse line by line — each exercise is on one line
  // Patterns: "4.7.1.   FREE TIME 1   1   holiday   2   camp   3   sleeping"
  // or:       "4.7.10   FUN   1   What about   2   don't   3   Let's"
  for (const line of cText.split('\n')) {
    const hm = line.match(/^4\.7\.(\d+)\.?\s+/);
    if (!hm) continue;
    const exNum = parseInt(hm[1]);
    // Everything after the "4.7.N.   " prefix
    const rest = line.slice(hm[0].length);
    // Strip the exercise title (uppercase words + optional digit) from the front
    // Then find the answer block: "1   ans1   2   ans2   3   ans3"
    const ansBlock = rest.match(/\b1\s+(.+?)\s+2\s+(.+?)\s+3\s+(.+?)\s*$/);
    if (!ansBlock) continue;
    // ansBlock[1] might still start with extra "1   " if title ends with digit
    let a1 = ansBlock[1].replace(/^1\s+/, '').trim();
    const a2 = ansBlock[2].trim();
    const a3 = ansBlock[3].trim();
    setAns(`4.7.${exNum}`, 1, a1);
    setAns(`4.7.${exNum}`, 2, a2);
    setAns(`4.7.${exNum}`, 3, a3);
  }
}

// ─────────────────────────────────────────────
// QUESTIONS SECTION  (pages 11–50)
// ─────────────────────────────────────────────

const questionsText = answersStart > 0 ? text.slice(0, answersStart) : text;

// ── Locate major section zones ─────────────────

function sectionZone(re) {
  const idx = lastIndexOf(questionsText, re);
  return idx;
}

const zListening    = sectionZone(/4\.1\.\s+LISTENING/);
const zReading      = sectionZone(/4\.2\.\s+READING/);
const zVocabI       = sectionZone(/4\.3\.\s+VOCABULARY\s+I\b/);
const zVocabII      = sectionZone(/4\.4\.\s+VOCABULARY\s+II/);
const zGrammarI     = sectionZone(/4\.5\.\s+GRAMMAR\s+I\b/);
const zGrammarII    = sectionZone(/4\.6\.\s+GRAMMAR\s+II/);
const zComm         = sectionZone(/4\.7\.\s+COMMUNICATION/);

function textBetween(a, b) {
  if (a < 0) return '';
  return b > 0 ? questionsText.slice(a, b) : questionsText.slice(a);
}

const listeningText  = textBetween(zListening, zReading);
const readingText    = textBetween(zReading, zVocabI);
const vocabIText     = textBetween(zVocabI, zVocabII);
const vocabIIText    = textBetween(zVocabII, zGrammarI);
const grammarIText   = textBetween(zGrammarI, zGrammarII);
const grammarIIText  = textBetween(zGrammarII, zComm);
const commText       = textBetween(zComm, answersStart > 0 ? answersStart : questionsText.length);

// ─────────────────────────────────────────────
// 4.1 LISTENING
// ─────────────────────────────────────────────

// Find tapescript for each exercise number
function findTapescript(exerciseTitle) {
  const re = new RegExp(`4\\.1\\.\\d+\\.\\s+TAPESCRIPT\\s*\\n${exerciseTitle}\\s*\\n([\\s\\S]+?)(?=4\\.1\\.\\d+\\.\\s+TAPESCRIPT|4\\.2\\.|RJEŠENJA|$)`, 'i');
  const m = listeningText.match(re) || text.match(re);
  return m ? m[1].trim() : null;
}

// Exercise definitions: [number, title, type ('tf'|'mcq')]
const listeningExercises = [
  { num: '4.1.1', title: 'STOP WASTING TIME',       type: 'tf'  },
  { num: '4.1.2', title: 'A TRIP TO REMEMBER',      type: 'tf'  },
  { num: '4.1.3', title: 'AQUA PARK INFORMATION',   type: 'tf'  },
  { num: '4.1.4', title: 'MISSING A CLASS',         type: 'mcq' },
  { num: '4.1.5', title: 'TOWN HAS CHANGED',        type: 'mcq' },
];

for (const ex of listeningExercises) {
  const shortNum = ex.num.split('.')[2]; // '1'..'5'
  const tapescript = findTapescript(ex.title) || '';

  // Find the exercise block in listeningText
  const exRe = new RegExp(`${ex.num.replace(/\./g, '\\.')}\\.[\\s\\S]+?(?=4\\.1\\.\\d+\\.|4\\.1\\.\\d+\\.\\s+TAPESCRIPT|4\\.2\\.|$)`);
  const exBlock = listeningText.match(exRe)?.[0] || '';
  const exLines = exBlock.split('\n').map(l => l.trim()).filter(l => l);

  if (ex.type === 'tf') {
    // Lines like: "1   Tom's mum thinks that music helps people study.   True / False"
    for (const line of exLines) {
      const m = line.match(/^(\d)\s{2,}(.+?)\s+True\s*\/\s*False\s*$/i);
      if (!m) continue;
      const qNum = parseInt(m[1]);
      const stmt = m[2].trim();
      const ans  = answers[ex.num]?.[qNum] ?? answers[ex.num.replace('4.1.', '')]?.[qNum];
      const correctAns = ans === 'T' ? 'a' : ans === 'F' ? 'b' : 'a';
      addQ({
        subject: 'en',
        section: 'Listening',
        section_order: 1,
        exercise: ex.title,
        question_number: parseInt(`${shortNum}${qNum < 10 ? '0' : ''}${qNum}`),
        question_type: 'mcq',
        context_text: tapescript || null,
        question_text: stmt,
        option_a: 'True',
        option_b: 'False',
        option_c: null,
        option_d: null,
        correct_answer: correctAns,
        matching_left: null,
        matching_right: null,
        correct_mapping: null,
      });
    }
  } else {
    // MCQ: numbered question + A/B/C options
    let curQ = null, curOpts = {};
    for (const line of exLines) {
      const qStart = line.match(/^(\d)\s+(.+)/);
      const optLine = line.match(/^([ABC])\s+(.+)/);
      if (qStart && !optLine) {
        if (curQ && Object.keys(curOpts).length >= 2) {
          const ans = answers[ex.num]?.[curQ.num] || 'a';
          addQ({ ...curQ,
            option_a: curOpts.A || null, option_b: curOpts.B || null,
            option_c: curOpts.C || null, option_d: null,
            correct_answer: ans.toLowerCase(),
          });
        }
        curQ = {
          subject: 'en', section: 'Listening', section_order: 1,
          exercise: ex.title,
          question_number: parseInt(`${shortNum}${qStart[1] < 10 ? '0' : ''}${qStart[1]}`),
          question_type: 'mcq',
          context_text: tapescript || null,
          question_text: qStart[2].trim(),
          matching_left: null, matching_right: null, correct_mapping: null,
        };
        curQ.num = parseInt(qStart[1]);
        curOpts = {};
      } else if (optLine) {
        curOpts[optLine[1]] = (curOpts[optLine[1]] || '') + (curOpts[optLine[1]] ? ' ' : '') + optLine[2];
      }
    }
    if (curQ && Object.keys(curOpts).length >= 2) {
      const ans = answers[ex.num]?.[curQ.num] || 'a';
      addQ({ ...curQ,
        option_a: curOpts.A || null, option_b: curOpts.B || null,
        option_c: curOpts.C || null, option_d: null,
        correct_answer: ans.toLowerCase(),
      });
    }
  }
}

// ─────────────────────────────────────────────
// 4.2 READING
// ─────────────────────────────────────────────

// Find each exercise block 4.2.1 through 4.2.10
const readingExercisesRaw = [];
const readingExRe = /4\.2\.(\d+)\.\s+([A-Z][^\n]+)/g;
let rm;
while ((rm = readingExRe.exec(readingText)) !== null) {
  readingExercisesRaw.push({ start: rm.index, num: parseInt(rm[1]), title: rm[2].trim() });
}
for (let i = 0; i < readingExercisesRaw.length; i++) {
  const ex = readingExercisesRaw[i];
  const nextStart = readingExercisesRaw[i + 1]?.start ?? readingText.length;
  const block = readingText.slice(ex.start, nextStart);
  const blockLines = block.split('\n').map(l => l.trim()).filter(l => l);

  // Determine type: T/F exercises (4.2.1–4.2.6) vs MCQ (4.2.7–4.2.10)
  const isTF = ex.num <= 6;
  const isMCQ = ex.num >= 7;

  // Extract context text (the passage) — everything before the first numbered question
  let contextLines = [];
  let questLines = [];
  let inQuest = false;
  for (const line of blockLines) {
    if (!inQuest) {
      // T/F question indicator
      if (isTF && line.match(/^1\s{2,}[A-Z]/)) { inQuest = true; questLines.push(line); continue; }
      // MCQ question indicator (T/F version at bottom: "1   statement   ____")
      if (isTF && line.match(/^1\s+[A-Z].*____/)) { inQuest = true; questLines.push(line); continue; }
      // MCQ version
      if (isMCQ && line.match(/^1\s+[A-Z]/)) { inQuest = true; questLines.push(line); continue; }
      contextLines.push(line);
    } else {
      questLines.push(line);
    }
  }
  const contextText = contextLines
    .filter(l => !l.match(/^4\.2\.\d+\./))
    .filter(l => !l.match(/^Read the text/i))
    .filter(l => !l.match(/^Example:/i))
    .filter(l => !l.match(/^[TF]\s*$/))
    .join('\n').trim() || null;

  const exKey = `4.2.${ex.num}`;
  const sectionOrder = 2;

  if (isTF) {
    // Lines: "1   statement text   ____"
    for (const line of questLines) {
      const m = line.match(/^(\d)\s{2,}(.+?)(?:\s+_{2,}\s*)?$/);
      if (!m) continue;
      const qNum = parseInt(m[1]);
      if (isNaN(qNum) || qNum < 1) continue;
      const ans = answers[exKey]?.[qNum];
      addQ({
        subject: 'en', section: 'Reading', section_order: sectionOrder,
        exercise: ex.title,
        question_number: ex.num * 100 + qNum,
        question_type: 'mcq',
        context_text: contextText,
        question_text: m[2].trim(),
        option_a: 'True', option_b: 'False', option_c: null, option_d: null,
        correct_answer: ans === 'T' ? 'a' : ans === 'F' ? 'b' : 'a',
        matching_left: null, matching_right: null, correct_mapping: null,
      });
    }
  } else {
    // MCQ: numbered question + A/B/C options on separate lines
    let curQ = null, curOpts = {}, curNum = 0;
    for (const line of questLines) {
      const isOpt   = line.match(/^([ABC])\s+(.+)/);
      const qMatch  = line.match(/^(\d)\s+(.+)/);
      const isQStart = qMatch && !isOpt;
      if (isQStart) {
        if (curQ && Object.keys(curOpts).length >= 2) {
          const ans = (answers[exKey]?.[curNum] || 'a').toLowerCase();
          addQ({ ...curQ,
            option_a: curOpts.A || null, option_b: curOpts.B || null,
            option_c: curOpts.C || null, option_d: null,
            correct_answer: ans,
          });
        }
        curNum = parseInt(qMatch[1]);
        curQ = {
          subject: 'en', section: 'Reading', section_order: sectionOrder,
          exercise: ex.title,
          question_number: ex.num * 100 + curNum,
          question_type: 'mcq',
          context_text: contextText,
          question_text: qMatch[2].trim(),
          matching_left: null, matching_right: null, correct_mapping: null,
        };
        curOpts = {};
      } else if (isOpt) {
        curOpts[isOpt[1]] = (curOpts[isOpt[1]] ? curOpts[isOpt[1]] + ' ' : '') + isOpt[2].trim();
      } else if (curQ && !isQStart) {
        curQ.question_text += ' ' + line;
      }
    }
    if (curQ && Object.keys(curOpts).length >= 2) {
      const ans = (answers[exKey]?.[curNum] || 'a').toLowerCase();
      addQ({ ...curQ,
        option_a: curOpts.A || null, option_b: curOpts.B || null,
        option_c: curOpts.C || null, option_d: null,
        correct_answer: ans,
      });
    }
  }
}

// ─────────────────────────────────────────────
// 4.3 VOCABULARY I  — 20 MCQ questions
// ─────────────────────────────────────────────

{
  const vocabLines = vocabIText.split('\n').map(l => l.trim()).filter(l => l);
  // Questions look like: "4.3.1.   sentence _____ rest?"
  // Next line:           "A   word   B   word   C   word"
  for (let i = 0; i < vocabLines.length; i++) {
    const line = vocabLines[i];
    const qm = line.match(/^4\.3\.(\d+)\.\s+(.+)/);
    if (!qm) continue;
    const qNum = parseInt(qm[1]);
    const qText = qm[2].trim();
    // Options on next line (or current line if inline)
    let optLine = vocabLines[i + 1] || '';
    // Sometimes options are on same line at end
    const inlineOpt = qText.match(/^(.+?)\s{2,}A\s+(.+?)\s{2,}B\s+(.+?)\s{2,}C\s+(.+)$/);
    let optA = '', optB = '', optC = '';
    if (inlineOpt) {
      optA = inlineOpt[2]; optB = inlineOpt[3]; optC = inlineOpt[4];
    } else {
      const om = optLine.match(/^A\s+(.+?)\s{2,}B\s+(.+?)\s{2,}C\s+(.+?)$/);
      if (om) { optA = om[1].trim(); optB = om[2].trim(); optC = om[3].trim(); i++; }
      else {
        // Try looser: split on "B " and "C "
        const parts = optLine.split(/\s{2,}[BC]\s+/);
        if (parts.length === 3) {
          optA = parts[0].replace(/^A\s+/, '').trim();
          optB = parts[1].trim();
          optC = parts[2].trim();
          i++;
        }
      }
    }
    const rawAns = answers['4.3']?.[qNum] || 'A';
    addQ({
      subject: 'en', section: 'Vocabulary I', section_order: 3,
      exercise: 'Vocabulary I',
      question_number: qNum,
      question_type: 'mcq',
      context_text: null,
      question_text: inlineOpt ? inlineOpt[1].trim() : qText,
      option_a: optA || null, option_b: optB || null,
      option_c: optC || null, option_d: null,
      correct_answer: rawAns.toLowerCase(),
      matching_left: null, matching_right: null, correct_mapping: null,
    });
  }
}

// ─────────────────────────────────────────────
// 4.4 VOCABULARY II
// ─────────────────────────────────────────────

{
  const v2Lines = vocabIIText.split('\n').map(l => l.trim()).filter(l => l);

  // 4.4.1–4.4.10: binary choice "word1 / word2"
  for (let i = 0; i < v2Lines.length; i++) {
    const line = v2Lines[i];
    const qm = line.match(/^4\.4\.(\d+)\.\s+(.+)/);
    if (!qm) continue;
    const qNum = parseInt(qm[1]);
    if (qNum > 10) continue;
    const full = qm[2].trim();
    // Options are always single words flanked by 2+ spaces: "   word / word   "
    const slash = full.match(/\s{2,}([\w'']+(?:\s[\w'']+)?)\s*\/\s*([\w'']+(?:\s[\w'']+)?)\s*(?:\s{2,}|$)/);
    if (!slash) continue;
    const optA = slash[1].trim();
    const optB = slash[2].trim();
    const correct = answers['4.4']?.[qNum] || optA;
    const correctLetter = correct.toLowerCase() === optA.toLowerCase() ? 'a' : 'b';
    addQ({
      subject: 'en', section: 'Vocabulary II', section_order: 4,
      exercise: 'Vocabulary II',
      question_number: qNum,
      question_type: 'mcq',
      context_text: null,
      question_text: full,
      option_a: optA, option_b: optB, option_c: null, option_d: null,
      correct_answer: correctLetter,
      matching_left: null, matching_right: null, correct_mapping: null,
    });
  }

  // 4.4.11–4.4.15: fill-in from word box (2 sub-questions each)
  const wordBoxExercises = [];
  let curEx = null;
  for (let i = 0; i < v2Lines.length; i++) {
    const line = v2Lines[i];
    const exm = line.match(/^4\.4\.(\d+)\.\s+(.+)/);
    if (exm && parseInt(exm[1]) >= 11) {
      if (curEx) wordBoxExercises.push(curEx);
      curEx = { num: parseInt(exm[1]), header: exm[2], lines: [] };
    } else if (curEx && !line.match(/^4\.\d+\.\d+\./)) {
      curEx.lines.push(line);
    }
  }
  if (curEx) wordBoxExercises.push(curEx);

  for (const ex of wordBoxExercises) {
    const exKey = `4.4.${ex.num}`;
    // Word bank is usually the first line of lines that has multiple words separated by spaces/tabs
    const wordBankLine = ex.lines.find(l =>
      l.match(/^\w+.*\s{3,}\w+/) && !l.match(/^Example:/i) && !l.match(/^1\s/) && !l.match(/^2\s/)
    ) || '';
    const contextText = ex.header + '\n' + wordBankLine;

    // Sub-questions: lines starting with "1 " or "2 "
    for (const sl of ex.lines) {
      const sm = sl.match(/^([12])\s+(.+)/);
      if (!sm) continue;
      const subNum = parseInt(sm[1]);
      const stmtText = sm[2].replace(/_{3,}/g, '_____');
      const correctAns = answers[exKey]?.[subNum] || '';
      addQ({
        subject: 'en', section: 'Vocabulary II', section_order: 4,
        exercise: `Vocabulary II (${ex.header.slice(0, 40)})`,
        question_number: ex.num * 10 + subNum,
        question_type: 'fill_in',
        context_text: contextText,
        question_text: stmtText,
        option_a: null, option_b: null, option_c: null, option_d: null,
        correct_answer: correctAns,
        matching_left: null, matching_right: null, correct_mapping: null,
      });
    }
  }
}

// ─────────────────────────────────────────────
// 4.5 GRAMMAR I — 30 fill-in (verb forms)
// ─────────────────────────────────────────────

{
  const g1Lines = grammarIText.split('\n').map(l => l.trim()).filter(l => l);
  for (const line of g1Lines) {
    const m = line.match(/^4\.5\.(\d+)\.\s+(.+)/);
    if (!m) continue;
    const qNum = parseInt(m[1]);
    const qText = m[2].trim();
    const fullSentence = answers['4.5']?.[qNum] || '';
    addQ({
      subject: 'en', section: 'Grammar I', section_order: 5,
      exercise: 'Grammar I',
      question_number: qNum,
      question_type: 'fill_in',
      context_text: null,
      question_text: qText,
      option_a: null, option_b: null, option_c: null, option_d: null,
      correct_answer: fullSentence,
      matching_left: null, matching_right: null, correct_mapping: null,
    });
  }
}

// ─────────────────────────────────────────────
// 4.6 GRAMMAR II — 30 word-order (fill-in)
// ─────────────────────────────────────────────

{
  const g2Lines = grammarIIText.split('\n').map(l => l.trim()).filter(l => l);
  for (let i = 0; i < g2Lines.length; i++) {
    const line = g2Lines[i];
    const m = line.match(/^4\.6\.(\d+)\.\s+(.+)/);
    if (!m) continue;
    const qNum = parseInt(m[1]);
    // The jumbled words are the rest of this line
    const jumbled = m[2].replace(/^(The|Many|If|Who|Have|Karen|Sarajevo City Hall|I|A|Hundreds|You|Students|Before|Are|Can|Una National Park|We)\s+/, '').trim();
    const fullSentence = answers['4.6']?.[qNum] || '';
    addQ({
      subject: 'en', section: 'Grammar II', section_order: 6,
      exercise: 'Grammar II',
      question_number: qNum,
      question_type: 'fill_in',
      context_text: null,
      question_text: `Arrange into a correct sentence: ${m[2].trim()}`,
      option_a: null, option_b: null, option_c: null, option_d: null,
      correct_answer: fullSentence,
      matching_left: null, matching_right: null, correct_mapping: null,
    });
  }
}

// ─────────────────────────────────────────────
// 4.7 COMMUNICATION — 10 dialogues × 3 blanks
// ─────────────────────────────────────────────

{
  // Find each exercise block
  const commExercisesRaw = [];
  const commExRe = /4\.7\.(\d+)\.\s+([A-Z][^\n]+)/g;
  let cm;
  while ((cm = commExRe.exec(commText)) !== null) {
    commExercisesRaw.push({ start: cm.index, num: parseInt(cm[1]), title: cm[2].trim() });
  }

  for (let i = 0; i < commExercisesRaw.length; i++) {
    const ex = commExercisesRaw[i];
    const nextStart = commExercisesRaw[i + 1]?.start ?? commText.length;
    const block = commText.slice(ex.start, nextStart).trim();

    const exKey = `4.7.${ex.num}`;
    const exAns = answers[exKey] || {};

    // The full dialogue block is the context
    const contextText = block
      .replace(/^4\.7\.\d+\.\s+.+\n/, '')
      .replace(/Complete the dialogue.+\n/, '')
      .replace(/^[a-z ]+(?:\s{3,}[a-z]+)+\n/im, '') // word box line
      .trim();

    // Emit 3 fill_in questions (blank 1, 2, 3)
    for (let blank = 1; blank <= 3; blank++) {
      // Try to find the sentence containing "blank"
      const blankRe = new RegExp(`${blank}\\s*_{3,}|_{3,}\\s*${blank}|\\b${blank}\\s*_{5,}`);
      const matchingLine = block.split('\n').find(l => blankRe.test(l)) || '';
      const questionText = matchingLine.trim()
        || `Complete dialogue – fill in blank ${blank}`;

      addQ({
        subject: 'en', section: 'Communication', section_order: 7,
        exercise: ex.title,
        question_number: ex.num * 10 + blank,
        question_type: 'fill_in',
        context_text: contextText || null,
        question_text: questionText,
        option_a: null, option_b: null, option_c: null, option_d: null,
        correct_answer: exAns[blank] || '',
        matching_left: null, matching_right: null, correct_mapping: null,
      });
    }
  }
}

// ─────────────────────────────────────────────
// OUTPUT
// ─────────────────────────────────────────────

const outPath = join(ROOT, 'data', 'english_questions.json');
writeFileSync(outPath, JSON.stringify(questions, null, 2), 'utf8');

console.log(`\nTotal questions: ${questions.length}`);
const bySection = {};
for (const q of questions) {
  bySection[q.section] = (bySection[q.section] || 0) + 1;
}
for (const [sec, cnt] of Object.entries(bySection)) {
  console.log(`  ${sec}: ${cnt}`);
}
console.log(`\nSaved to ${outPath}`);

// Check answer coverage
let noAns = 0;
for (const q of questions) {
  if (!q.correct_answer) noAns++;
}
if (noAns > 0) console.warn(`⚠  ${noAns} questions have no correct_answer`);
