/**
 * parse-questions.mjs
 * Parses output_full.txt into structured questions.json.
 * Run: node scripts/parse-questions.mjs
 * Output: data/questions.json
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

const rawText = readFileSync(join(PROJECT_ROOT, 'data', 'output_full.txt'), 'utf8');

// ─── Section definitions ──────────────────────────────────────────────────────
// Note: TOC entries use "5.1   KNJIŽEVNOST" (no trailing period on number),
// while body section headers use "5.1. KNJIŽEVNOST" — use specific patterns
// that match both but find the LAST (actual body) match.
const SECTIONS = [
  { order: 1, name: 'Književnost',           startPattern: /5\.1\.?\s+KNJIŽEVNOST/ig },
  { order: 2, name: 'Medijska kultura',       startPattern: /5\.2\.?\s+MEDIJSKA KULTURA/ig },
  { order: 3, name: 'Fonetika i fonologija',  startPattern: /5\.3\.?\s+FONETIKA I FONOLOGIJA/ig },
  { order: 4, name: 'Morfologija',            startPattern: /5\.4\.?\s+MORFOLOGIJA/ig },
  { order: 5, name: 'Tvorba riječi',          startPattern: /5\.5\.?\s+TVORBA RIJE[ČC]I/ig },
  { order: 6, name: 'Sintaksa',               startPattern: /5\.6\.?\s+SINTAKSA/ig },
  { order: 7, name: 'Leksika',                startPattern: /5\.7\.?\s+LEKSIKA/ig },
  { order: 8, name: 'Pravopis',               startPattern: /5\.8\.?\s+PRAVOPIS/ig },
  { order: 9, name: 'Historija jezika',       startPattern: /5\.9\.?\s+HISTORIJA JEZIKA/ig },
];

const ANSWER_SECTIONS = [
  { order: 1, name: 'Književnost',           pattern: /^\s*KNJIŽEVNOST\s*$/m },
  { order: 2, name: 'Medijska kultura',       pattern: /^\s*MEDIJSKA KULTURA\s*$/m },
  { order: 3, name: 'Fonetika i fonologija',  pattern: /^\s*FONETIKA I FONOLOGIJA\s*$/m },
  { order: 4, name: 'Morfologija',            pattern: /^\s*MORFOLOGIJA\s*$/m },
  { order: 5, name: 'Tvorba riječi',          pattern: /^\s*TVORBA RIJE[ČC]I\s*$/m },
  { order: 6, name: 'Sintaksa',               pattern: /^\s*SINTAKSA\s*$/m },
  { order: 7, name: 'Leksika',                pattern: /^\s*LEKSIKA\s*$/m },
  { order: 8, name: 'Pravopis',               pattern: /^\s*PRAVOPIS\s*$/m },
  { order: 9, name: 'Historija jezika',       pattern: /^\s*HISTORIJA JEZIKA\s*$/m },
];

// ─── Utility: strip page headers and normalize whitespace ─────────────────────
function cleanText(text) {
  text = text.replace(/EKSTERNA MATURA\s+Bosanski jezik i knji[žz]evnost[^]*?Kantona Sarajevo\s+\d+\s*/g, '');
  text = text.replace(/---\s*PAGE \d+\s*---/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

// ─── Split document into question-zone and answer-zone ────────────────────────
const rjesenjaSplit = rawText.indexOf('6. RJEŠENJA');
if (rjesenjaSplit === -1) throw new Error('Could not find "6. RJEŠENJA"');

const questionsZone = cleanText(rawText.substring(0, rjesenjaSplit));
const answersZone   = cleanText(rawText.substring(rjesenjaSplit));

// ─── PASS A: Extract questions ────────────────────────────────────────────────
// Find the LAST occurrence of each section header (skips the TOC, uses body header).
function findSectionBoundaries(text, sectionDefs) {
  const found = [];
  for (const s of sectionDefs) {
    // Re-create a fresh regex (global flag needs reset)
    const re = new RegExp(s.startPattern.source, 'ig');
    let lastMatch = null;
    let m;
    while ((m = re.exec(text)) !== null) {
      lastMatch = m;
    }
    if (lastMatch) {
      found.push({ ...s, index: lastMatch.index });
    } else {
      console.warn(`  [WARN] Section not found: ${s.name}`);
    }
  }
  found.sort((a, b) => a.index - b.index);
  return found;
}

const qSectionBoundaries = findSectionBoundaries(questionsZone, SECTIONS);

console.log('Section boundaries in questions zone:');
for (const b of qSectionBoundaries) {
  console.log(`  ${b.name}: index ${b.index}`);
}

// Extract raw text per section
const sectionTexts = {};
for (let i = 0; i < qSectionBoundaries.length; i++) {
  const current = qSectionBoundaries[i];
  const next    = qSectionBoundaries[i + 1];
  sectionTexts[current.name] = questionsZone.substring(current.index, next ? next.index : questionsZone.length);
}

// ─── Parse individual questions from a section block ─────────────────────────
function parseQuestionsFromBlock(sectionName, block) {
  const questions = [];

  // Find all question start positions: "N." or "N ." at start of line
  // Some PDF extractions insert a space before the period (e.g. "9 .", "31 .")
  const questionSplitRe = /(?:^|\n)(\d{1,2})\s*\.\s+/g;
  const starts = [];
  let m;
  while ((m = questionSplitRe.exec(block)) !== null) {
    // Skip if this is a sub-item numbering (like "1." inside an answer block)
    // by requiring the number to be reasonably incremental
    const num = parseInt(m[1], 10);
    if (starts.length === 0 || num === starts[starts.length - 1].num + 1 || num === 1) {
      starts.push({ num, index: m.index + (m[0].startsWith('\n') ? 1 : 0) });
    } else if (num > starts[starts.length - 1].num) {
      // Allow gaps (some questions may be skipped in parsing)
      starts.push({ num, index: m.index + (m[0].startsWith('\n') ? 1 : 0) });
    }
  }

  for (let i = 0; i < starts.length; i++) {
    const qNum   = starts[i].num;
    const qStart = starts[i].index;
    const qEnd   = i + 1 < starts.length ? starts[i + 1].index : block.length;
    const raw    = block.substring(qStart, qEnd).trim();

    const q = parseOneQuestion(sectionName, qNum, raw);
    if (q) questions.push(q);
  }

  return questions;
}

function parseOneQuestion(section, questionNumber, raw) {
  const isMatchingType = /Pove[žz]i|Spoji/i.test(raw);
  const hasFourOptions = /\n\s*a\)/.test(raw) && /\n\s*b\)/.test(raw) && /\n\s*c\)/.test(raw) && /\n\s*d\)/.test(raw);
  const isMCQType = !isMatchingType && (
    /Zaokru[žz]i slovo/i.test(raw) || hasFourOptions
  );

  if (isMatchingType) {
    return parseMatchingQuestion(section, questionNumber, raw);
  } else if (isMCQType) {
    return parseMCQQuestion(section, questionNumber, raw);
  } else {
    return parseFillInQuestion(section, questionNumber, raw);
  }
}

function parseMCQQuestion(section, questionNumber, raw) {
  // Extract options: lines starting with a), b), c), d)
  const optionRe = /\n\s*([abcd])\)\s*([\s\S]*?)(?=\n\s*[abcd]\)|\s*$)/g;
  const options = {};
  let m;
  while ((m = optionRe.exec(raw)) !== null) {
    options[m[1]] = m[2].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Question text: everything before the first option
  const firstOptionIdx = raw.search(/\n\s*a\)/);
  let questionBody = firstOptionIdx > 0 ? raw.substring(0, firstOptionIdx).trim() : raw.trim();
  questionBody = questionBody.replace(/^\d{1,2}\.\s*/, '').trim();

  // Try to split context_text from question_text for literature questions
  let contextText  = null;
  let questionText = questionBody;

  // If the body contains a long passage (indicated by double newlines), try to separate it
  const parts = questionBody.split(/\n\n+/);
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1].trim();
    // The actual question usually ends with '?' and is shorter than the context
    if (/\?/.test(lastPart) || /Zaokru[žz]i slovo/i.test(lastPart)) {
      // Remove "Zaokruži slovo ispred tačnog odgovora" instruction from question text
      questionText = lastPart.replace(/\s*Zaokru[žz]i slovo ispred ta[čc]nog odgovora\.?\s*$/i, '').trim();
      contextText  = parts.slice(0, -1).join('\n\n').trim() || null;
    } else if (parts.length > 1) {
      // Last part may be just the Zaokruži instruction
      const secondToLast = parts[parts.length - 2].trim();
      if (/\?/.test(secondToLast)) {
        questionText = secondToLast.replace(/\s*Zaokru[žz]i slovo ispred ta[čc]nog odgovora\.?\s*$/i, '').trim();
        contextText  = parts.slice(0, -2).join('\n\n').trim() || null;
      }
    }
  }
  // Remove standalone "Zaokruži" instructions from question text
  questionText = questionText.replace(/\s*Zaokru[žz]i slovo ispred ta[čc]nog odgovora\.?\s*$/i, '').trim();

  if (!options.a && !options.b) {
    return parseFillInQuestion(section, questionNumber, raw);
  }

  return {
    section,
    section_order: SECTIONS.find(s => s.name === section)?.order ?? 0,
    question_number: questionNumber,
    question_type: 'mcq',
    context_text: contextText || null,
    question_text: questionText,
    options,
    correct_answer: '',
    matching_left: null,
    matching_right: null,
    correct_mapping: null,
  };
}

function parseFillInQuestion(section, questionNumber, raw) {
  let text = raw.replace(/^\d{1,2}\.\s*/, '').trim();
  text = text.replace(/_{3,}/g, '___').replace(/\s+/g, ' ').trim();

  return {
    section,
    section_order: SECTIONS.find(s => s.name === section)?.order ?? 0,
    question_number: questionNumber,
    question_type: 'fill_in',
    context_text: null,
    question_text: text,
    options: null,
    correct_answer: '',
    matching_left: null,
    matching_right: null,
    correct_mapping: null,
  };
}

function parseMatchingQuestion(section, questionNumber, raw) {
  let text = raw.replace(/^\d{1,2}\.\s*/, '').trim();

  // Question instruction is everything before first "a)" item
  const firstItemIdx = text.search(/\n\s*a\)/i);
  const questionText = firstItemIdx > 0 ? text.substring(0, firstItemIdx).trim() : text.trim();

  // Parse left items: "a) text   ____   right_text" OR just "a) text"
  const leftItems  = [];
  const rightItems = [];

  // Try to match paired lines: a) LEFT   ___+   RIGHT
  const lineRe = /\n\s*([abcd])\)\s*(.+?)(?:\s{2,}|___+\s*)([^\n]+)/g;
  let m;
  while ((m = lineRe.exec(raw)) !== null) {
    const key       = m[1].toLowerCase();
    const leftText  = m[2].replace(/\s+/g, ' ').trim();
    const rightText = m[3].replace(/_+/g, '').replace(/\s+/g, ' ').trim();
    if (leftText && rightText) {
      leftItems.push({ key, text: leftText });
      rightItems.push({ key: rightText, text: rightText });
    }
  }

  // Fallback: just grab left items
  if (leftItems.length === 0) {
    const leftRe = /\n\s*([abcd])\)\s*(.+?)(?=\n\s*[abcd]\)|\n\s*\d|$)/g;
    while ((m = leftRe.exec(raw)) !== null) {
      leftItems.push({ key: m[1].toLowerCase(), text: m[2].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim() });
    }
  }

  return {
    section,
    section_order: SECTIONS.find(s => s.name === section)?.order ?? 0,
    question_number: questionNumber,
    question_type: 'matching',
    context_text: null,
    question_text: questionText,
    options: null,
    correct_answer: '',
    matching_left: leftItems.length > 0 ? leftItems : null,
    matching_right: rightItems.length > 0 ? rightItems : null,
    correct_mapping: null,
  };
}

// Build all questions
const allQuestions = [];
for (const s of SECTIONS) {
  const block = sectionTexts[s.name];
  if (!block) { console.warn(`[WARN] No block for: ${s.name}`); continue; }
  const qs = parseQuestionsFromBlock(s.name, block);
  console.log(`  Section "${s.name}": ${qs.length} questions`);
  allQuestions.push(...qs);
}

// ─── PASS B: Extract answers ──────────────────────────────────────────────────
function findAnswerSectionBoundaries(text) {
  const found = [];
  for (const s of ANSWER_SECTIONS) {
    const match = s.pattern.exec(text);
    if (match) {
      found.push({ ...s, index: match.index });
    } else {
      console.warn(`  [WARN] Answer section not found: ${s.name}`);
    }
  }
  found.sort((a, b) => a.index - b.index);
  return found;
}

const aSectionBoundaries = findAnswerSectionBoundaries(answersZone);
const answerSectionTexts = {};
for (let i = 0; i < aSectionBoundaries.length; i++) {
  const current = aSectionBoundaries[i];
  const next    = aSectionBoundaries[i + 1];
  answerSectionTexts[current.name] = answersZone.substring(current.index, next ? next.index : answersZone.length);
}

function parseAnswersFromBlock(sectionName, block) {
  const answers = {};
  const lines = block.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // MATCHING (inline format): "N. a) text  __d__ right"  — detect before MCQ check
    // The presence of __X__ in the line means it's a matching answer block
    const matchingInlineStart = line.match(/^(\d{1,2})\s*\.\s+([abcd])\)\s+.+?__?([abcd])__?/i);
    if (matchingInlineStart) {
      const qNum = parseInt(matchingInlineStart[1], 10);
      const mapping = {};
      // Parse this line and the following b/c/d lines
      let j = i;
      while (j < lines.length) {
        const sub = lines[j].trim();
        if (!sub) { j++; continue; }
        // Stop at next numbered question or section header (but not a/b/c/d items)
        if (j > i && /^\d{1,2}\s*\./.test(sub) && !/^\d{1,2}\s*\.\s+[abcd]\)/.test(sub)) break;
        if (/^[A-ZŠĐŽĆČ ]{5,}$/.test(sub)) break;
        const mapLine = sub.match(/([abcd])\)\s+.+?_+([abcd])_+/i);
        if (mapLine) mapping[mapLine[1].toLowerCase()] = mapLine[2].toLowerCase();
        // Stop after the d) row
        if (/^d\)/i.test(sub) || sub.startsWith(matchingInlineStart[1] + '.') && /^d\)/i.test(sub.replace(/^\d+\s*\.\s+/, ''))) { j++; break; }
        j++;
      }
      i = j;
      if (Object.keys(mapping).length > 0) answers[qNum] = JSON.stringify(mapping);
      continue;
    }

    // MCQ: "1. b) ..." or "1.   b) ..." or "25 .   c) ..." (space before period)
    const mcqMatch = line.match(/^(\d{1,2})\s*\.\s+([abcd])\)/i);
    if (mcqMatch) {
      answers[parseInt(mcqMatch[1], 10)] = mcqMatch[2].toLowerCase();
      i++;
      continue;
    }

    // Fill-in: "N. Odgovor: text"
    const odgovorMatch = line.match(/^(\d{1,2})\s*\.\s+Odgovor:\s*(.+)/i);
    if (odgovorMatch) {
      answers[parseInt(odgovorMatch[1], 10)] = odgovorMatch[2].trim();
      i++;
      continue;
    }

    // Fill-in with just the answer text after number (single or multiple spaces)
    // e.g. "1.   fonetika" or "40. Epiteti..."
    const fillMatch = line.match(/^(\d{1,2})\s*\.\s+(.+)/);
    if (fillMatch) {
      const val = fillMatch[2].trim();
      // Make sure it's not an MCQ indicator
      if (!/^[abcd]\)/i.test(val)) {
        const num = parseInt(fillMatch[1], 10);
        if (!answers[num]) answers[num] = val;
        i++;
        continue;
      }
    }

    // Matching question block: line is just "N." or "N ." followed by sub-lines
    const matchingStart = line.match(/^(\d{1,2})\s*\.\s*$/);
    if (matchingStart) {
      const qNum = parseInt(matchingStart[1], 10);
      const mapping = {};
      i++;
      while (i < lines.length) {
        const sub = lines[i].trim();
        if (!sub) { i++; continue; }
        if (/^\d{1,2}\./.test(sub) || /^[A-ZŠĐŽĆČ ]{5,}$/.test(sub)) break;

        // "a) text   _d_ text" or "a) text   __d__"
        const mapLine = sub.match(/([abcd])\)\s+.+?\s+_+([abcd])_+/i);
        if (mapLine) {
          mapping[mapLine[1].toLowerCase()] = mapLine[2].toLowerCase();
        }
        i++;
      }
      if (Object.keys(mapping).length > 0) {
        answers[qNum] = JSON.stringify(mapping);
      }
      continue;
    }

    i++;
  }

  return answers;
}

console.log('\nParsing answers...');
const allAnswers = {};
for (const s of ANSWER_SECTIONS) {
  const block = answerSectionTexts[s.name];
  if (!block) { console.warn(`[WARN] No answer block: ${s.name}`); continue; }
  const ans = parseAnswersFromBlock(s.name, block);
  allAnswers[s.name] = ans;
  console.log(`  Answers "${s.name}": ${Object.keys(ans).length}`);
}

// ─── MERGE ────────────────────────────────────────────────────────────────────
let matched = 0, unmatched = 0;

for (const q of allQuestions) {
  const sAns = allAnswers[q.section] || {};
  const ans  = sAns[q.question_number];

  if (ans !== undefined) {
    if (q.question_type === 'matching') {
      try {
        q.correct_mapping = JSON.parse(ans);
      } catch { /* ignore */ }
      q.correct_answer = ans;
    } else {
      q.correct_answer = ans;
    }
    matched++;
  } else {
    console.warn(`  [UNMATCHED] ${q.section} Q${q.question_number} (${q.question_type})`);
    unmatched++;
  }
}

console.log(`\nMerge: ${matched} matched, ${unmatched} unmatched (total ${allQuestions.length})`);

// ─── Write output ─────────────────────────────────────────────────────────────
const outPath = join(PROJECT_ROOT, 'data', 'questions.json');
writeFileSync(outPath, JSON.stringify(allQuestions, null, 2), 'utf8');
console.log(`Saved to ${outPath}`);

console.log('\n=== Summary ===');
for (const s of SECTIONS) {
  const qs = allQuestions.filter(q => q.section === s.name);
  const byType = {};
  for (const q of qs) byType[q.question_type] = (byType[q.question_type] || 0) + 1;
  const withAns = qs.filter(q => q.correct_answer).length;
  console.log(`  ${s.name}: ${qs.length} q's [${JSON.stringify(byType)}] ${withAns} with answers`);
}
