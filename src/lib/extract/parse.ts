import type { ExtractedQuestion, ExtractionResult, SheetRows, SkippedItem } from "./types";
import { LIMITS } from "../quizLimits";

/**
 * Rule-based question extractor. Runs entirely inside the app (no AI, no
 * API key), so it only understands the layouts teachers commonly use:
 *
 *   1. Which planet is known as the Red Planet?       <- numbered question
 *      A. Venus   B. Mars*   C. Jupiter   D. Saturn    <- lettered choices
 *      Answer: B                                       <- or an answer line
 *
 * Also: "Q1 ..." / "Question 1 ...", choices one per line or all on one line,
 * "(A)" / "a)" / "A." letters, True/False sections, a correct choice marked
 * with * or **bold** (from Word), and an answer key at the end
 * ("Answer Key", "Answers", "Susi sa Pagwawasto").
 *
 * Everything that isn't a question — titles, directions, name/date lines,
 * page numbers, section headings — is left out.
 */

const MAX_CHOICES = 6;

// ── line classifiers ────────────────────────────────────────────────────────

const QUESTION_RE = /^(?:(?:q|question|item)\s*)?(\d{1,3})\s*[.)\]:-]\s*(.+)$/i;
const Q_PREFIX_RE = /^(?:q|question)\s*(\d{1,3})\s+(.+)$/i;
const CHOICE_RE = /^\(?([a-f])\s*[.)\]:]\s*(.*)$/i;
const ANSWER_LINE_RE = /^(?:correct\s+answer|answer|ans|sagot)\s*[:=.-]\s*(.+)$/i;
const ANSWER_KEY_HEADING_RE =
  /^(?:answer\s*keys?|answers|key\s+to\s+corrections?|susi\s+sa\s+pagwawasto|mga\s+sagot)\s*[:.-]?\s*$/i;
const ANSWER_KEY_INLINE_RE =
  /^(?:answer\s*key|key\s+to\s+corrections?|susi\s+sa\s+pagwawasto)\s*[:.-]\s*(.+)$/i;
const TRUE_FALSE_HINT_RE = /\b(true\s*(?:or|\/)\s*false|t\s*\/\s*f|tama\s+o\s+mali)\b/i;
const DIRECTIONS_RE = /^(?:directions?|instructions?|panuto)\b/i;
const SECTION_RE = /^(?:(?:test|part|section|exam|quiz)\s+[ivx\d]+\b|[ivx]{1,5}\s*[.)]\s+\S)/i;
const PAGE_NUMBER_RE = /^(?:page\s*)?\d{1,4}(?:\s*(?:of|\/)\s*\d{1,4})?$/i;
const FORM_FIELD_RE = /^(?:name|date|score|section|grade|teacher|subject|year|class)\s*[:_]/i;
const INLINE_CHOICE_SPLIT_RE = /(?:^|\s+)\(?([a-f])\s*[.)]\s+/gi;
// Explanations of the answer are for the teacher, not part of the question.
const EXPLANATION_WORDS = "explanations?|rationale|reason(?:ing)?|solution|justification|feedback|paliwanag";
// A label, then ":" or a spaced dash: "Explanation: …", "Rationale – …".
// Line-start only: "Source:" / "Reference:" lines cite where a question came from.
const EXPLANATION_RE = new RegExp(`^(?:${EXPLANATION_WORDS}|note|why|sources?|references?)(?:\\s*:|\\s+[–—-]\\s)`, "i");
const INLINE_EXPLANATION_RE = new RegExp(`\\s*[(\\[]?\\b(?:${EXPLANATION_WORDS})(?:\\s*:|\\s+[–—-]\\s).*$`, "i");

const TRUE_WORDS = new Set(["true", "t", "tama", "yes"]);
const FALSE_WORDS = new Set(["false", "f", "mali", "no"]);

type Block = {
  text: string;
  choices: { text: string; marked: boolean }[];
  answerHint: string | null;
  trueFalseSection: boolean;
  raw: string[];
};

// ── public entry points ─────────────────────────────────────────────────────

export function parseQuestionsFromText(input: string): ExtractionResult {
  const lines = normalize(input);
  const { body, keyEntries } = splitAnswerKey(lines);

  const blocks: Block[] = [];
  const skipped: SkippedItem[] = [];
  let title: string | null = null;
  let current: Block | null = null;
  let trueFalseSection = false;
  let lastWasChoice = false;
  // Skipping lines that aren't part of the question: an "Explanation: …" or
  // "Answer: …" that wraps onto more lines, or a heading/footer between
  // choices. The question stays open, so a later "Answer:" line or choice
  // still belongs to it; the next choice or question ends the skipping.
  let skipping = false;

  const flush = () => {
    if (current) blocks.push(current);
    current = null;
    lastWasChoice = false;
    skipping = false;
  };

  for (const rawLine of body) {
    // A line that is bold from end to end (Word): classify it without the
    // markers, but remember it in case it's the one bold choice.
    const wholeBold = /^\*\*(.+)\*\*$/.exec(rawLine);
    const line = wholeBold ? wholeBold[1].trim() : rawLine;

    if (PAGE_NUMBER_RE.test(line) || FORM_FIELD_RE.test(line) || /^_{3,}$/.test(line)) continue;

    if (DIRECTIONS_RE.test(line) || SECTION_RE.test(line)) {
      flush();
      trueFalseSection = TRUE_FALSE_HINT_RE.test(line);
      continue;
    }

    const inlineKey = line.match(ANSWER_KEY_INLINE_RE);
    if (inlineKey) {
      flush();
      keyEntries.push(...parseKeyEntries(inlineKey[1]));
      continue;
    }

    if (EXPLANATION_RE.test(line)) {
      skipping = true;
      lastWasChoice = false;
      continue;
    }

    const answer = line.match(ANSWER_LINE_RE);
    if (answer && current) {
      // "Answer: D. Explanation: …" keeps only the answer. The answer's text
      // may wrap onto the next lines; those must not join the last choice.
      current.answerHint = stripExplanation(answer[1]) || null;
      current.raw.push(line);
      skipping = true;
      lastWasChoice = false;
      continue;
    }

    const choice = current ? line.match(CHOICE_RE) : null;
    if (current && choice && choice[2].trim()) {
      skipping = false;
      const split = splitInlineChoices(line);
      for (const c of split) {
        const parsed = markChoice(c);
        current.choices.push(wholeBold ? { ...parsed, marked: true } : parsed);
      }
      current.raw.push(line);
      lastWasChoice = true;
      continue;
    }

    const question = line.match(QUESTION_RE) ?? line.match(Q_PREFIX_RE);
    if (question && !looksLikeListOfNumbers(line)) {
      flush();
      const { stem, inline } = splitStemAndInlineChoices(question[2]);
      current = {
        text: stem,
        choices: inline.map(markChoice),
        answerHint: null,
        trueFalseSection,
        raw: [line],
      };
      continue;
    }

    if (skipping) continue;

    if (current) {
      // A wrapped line: belongs to the last choice if we're in the choices,
      // otherwise to the question itself.
      if (lastWasChoice && current.choices.length > 0) {
        const last = current.choices[current.choices.length - 1];
        if (!continuesChoice(last.text, line)) {
          // A heading, footer or passage after a choice: not part of the
          // question. Skip it (and what follows) until the next choice,
          // answer line or question.
          skipping = true;
          lastWasChoice = false;
          continue;
        }
        last.text = `${last.text} ${line}`.trim();
      } else {
        current.text = `${current.text} ${line}`.trim();
      }
      current.raw.push(line);
      continue;
    }

    // Text before the first question: the first short line is the title,
    // the rest (instructions, school name...) is ignored.
    if (!title && line.length <= 100 && /[a-z]/i.test(line)) {
      title = stripMarkers(line);
      if (TRUE_FALSE_HINT_RE.test(line)) trueFalseSection = true;
    } else if (TRUE_FALSE_HINT_RE.test(line)) {
      trueFalseSection = true;
    }
  }
  flush();

  const questions: ExtractedQuestion[] = [];
  const keyForBlock = mapAnswerKey(blocks, keyEntries);

  blocks.forEach((block, i) => {
    const built = buildQuestion(block, keyForBlock[i]);
    if ("reason" in built) skipped.push(built);
    else questions.push(built);
  });

  return { title, questions, skipped };
}

/**
 * Spreadsheets: a header row naming the columns (Question, A–D or
 * Option 1–4, Answer) is read as a table; rows without a header are read
 * positionally (question first, answer last if it looks like one); anything
 * else falls back to the text parser, one cell per line.
 */
export function parseQuestionsFromRows(rows: SheetRows): ExtractionResult {
  const clean = rows
    .map((r) => r.map((c) => String(c ?? "").trim()))
    .filter((r) => r.some((c) => c !== ""));
  if (clean.length === 0) return { title: null, questions: [], skipped: [] };

  const headerIndex = clean.findIndex((r) => r.some((c) => /^(question|item|tanong)s?\b/i.test(c)));
  if (headerIndex !== -1 && headerIndex < 5) {
    return parseTable(clean, headerIndex);
  }

  const wide = clean.filter((r) => r.filter(Boolean).length >= 3);
  if (wide.length >= Math.max(1, clean.length * 0.6)) {
    return parsePositional(clean);
  }

  return parseQuestionsFromText(clean.map((r) => r.filter(Boolean).join(" ")).join("\n"));
}

// ── text helpers ────────────────────────────────────────────────────────────

function normalize(input: string): string[] {
  return input
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[   \t]/g, " ")
    .replace(/[•●▪‣⁃]/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function stripMarkers(s: string): string {
  return s.replace(/\*\*/g, "").replace(/^\*+|\*+$/g, "").trim();
}

/** Longest a choice may grow by picking up wrapped lines. */
const MAX_WRAPPED_CHOICE = LIMITS.choice;

/**
 * Whether a line after a choice is that choice wrapping onto the next line,
 * rather than a heading ("IDENTIFICATION", "Matching Type:"), a footer
 * ("Prepared by: …") or a page header repeated by the PDF.
 */
function continuesChoice(choice: string, line: string): boolean {
  const letters = line.replace(/[^a-z]/gi, "");
  if (letters.length >= 4 && letters === letters.toUpperCase()) return false;
  if (/:\s*$/.test(line)) return false;
  if (/^(?:prepared|checked|noted|approved|reviewed|submitted)\s+by\b/i.test(line)) return false;
  return choice.length + 1 + line.length <= MAX_WRAPPED_CHOICE;
}

function looksLikeListOfNumbers(line: string): boolean {
  // "1. B 2. C 3. A" — an answer key written without a heading.
  return /^(\d{1,3}\s*[.):-]\s*[a-f]\b\s*){3,}$/i.test(line);
}

/** "April 18, 2000 Explanation: This is the date…" → "April 18, 2000". */
function stripExplanation(s: string): string {
  return s.replace(INLINE_EXPLANATION_RE, "").trim();
}

function markChoice(raw: string): { text: string; marked: boolean } {
  let text = stripExplanation(raw);
  let marked = false;
  if (/^\*\*.+\*\*$/.test(text)) {
    marked = true; // the whole choice is bold in Word
  }
  if (/^\*(?!\*)|(?<!\*)\*$|\((?:correct|answer|tama)\)|✓|✔/i.test(text)) {
    marked = true;
  }
  text = text
    .replace(/\((?:correct|answer|tama)\)/gi, "")
    .replace(/[✓✔]/g, "");
  return { text: stripMarkers(text), marked };
}

function splitInlineChoices(line: string): string[] {
  const parts: { letter: string; start: number; textStart: number }[] = [];
  INLINE_CHOICE_SPLIT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE_CHOICE_SPLIT_RE.exec(line))) {
    parts.push({ letter: m[1].toLowerCase(), start: m.index, textStart: m.index + m[0].length });
  }
  // Only treat as several choices when the letters run in order (a, b, c...).
  const inOrder =
    parts.length > 1 &&
    parts.every((p, i) => p.letter.charCodeAt(0) === parts[0].letter.charCodeAt(0) + i);
  if (!inOrder) {
    const single = line.match(CHOICE_RE);
    return single ? [single[2]] : [line];
  }
  return parts.map((p, i) => line.slice(p.textStart, parts[i + 1]?.start ?? line.length).trim());
}

function splitStemAndInlineChoices(text: string): { stem: string; inline: string[] } {
  // "Which is red? A. Venus B. Mars C. Earth" — choices after the question.
  const m = text.match(/^(.*?\S)\s+\(?a\s*[.)]\s+(.*)$/i);
  if (m && /\s\(?b\s*[.)]\s+/i.test(` ${m[2]}`)) {
    const choices = splitInlineChoices(`a. ${m[2]}`);
    if (choices.length >= 2) return { stem: m[1].trim(), inline: choices };
  }
  return { stem: text.trim(), inline: [] };
}

// ── answer key ──────────────────────────────────────────────────────────────

type KeyEntry = { number: number; value: string };

function splitAnswerKey(lines: string[]): { body: string[]; keyEntries: KeyEntry[] } {
  // The key comes after the questions: take the last heading, and only if
  // some question line appears before it.
  const keyStart = lines.findLastIndex((l) => ANSWER_KEY_HEADING_RE.test(l.replace(/\*\*/g, "")));
  const firstQuestion = lines.findIndex((l) => QUESTION_RE.test(l) || Q_PREFIX_RE.test(l));
  const trailingKey: KeyEntry[] = [];

  if (keyStart !== -1 && firstQuestion !== -1 && firstQuestion < keyStart) {
    for (const line of lines.slice(keyStart + 1)) trailingKey.push(...parseKeyEntries(line));
    return { body: lines.slice(0, keyStart), keyEntries: trailingKey };
  }

  // No heading, but the last lines may be a bare key like "1. B 2. C 3. D".
  let cut = lines.length;
  while (cut > 0 && looksLikeListOfNumbers(lines[cut - 1])) cut--;
  for (const line of lines.slice(cut)) trailingKey.push(...parseKeyEntries(line));
  return { body: lines.slice(0, cut), keyEntries: trailingKey };
}

function parseKeyEntries(line: string): KeyEntry[] {
  const entries: KeyEntry[] = [];
  const re = /(\d{1,3})\s*[.):=-]?\s*([a-f]\b|true\b|false\b|tama\b|mali\b|t\b|f\b)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) entries.push({ number: Number(m[1]), value: m[2] });
  return entries;
}

/**
 * Match key entries to question blocks. When the key has exactly one entry
 * per question, match by position (this survives numbering that restarts in
 * each test part). Otherwise match by the question's own number.
 */
function mapAnswerKey(blocks: Block[], key: KeyEntry[]): (string | null)[] {
  if (key.length === 0) return blocks.map(() => null);
  if (key.length === blocks.length) return key.map((k) => k.value);

  const byNumber = new Map<number, string>();
  for (const k of key) if (!byNumber.has(k.number)) byNumber.set(k.number, k.value);
  return blocks.map((b) => {
    const n = b.raw[0].match(/(\d{1,3})/);
    return n ? (byNumber.get(Number(n[1])) ?? null) : null;
  });
}

// ── building a question ─────────────────────────────────────────────────────

function buildQuestion(block: Block, keyValue: string | null): ExtractedQuestion | SkippedItem {
  const text = stripExplanation(stripMarkers(block.text));
  const excerpt = block.raw.join(" ").slice(0, 160);
  // Wrapped lines are added after markChoice, so strip explanations again.
  let choices = block.choices.slice(0, MAX_CHOICES).map((c) => ({ ...c, text: stripExplanation(c.text) }));

  const rawHint = block.answerHint ?? keyValue;
  const hint = rawHint ? stripExplanation(rawHint) || null : null;
  const tfFromHint = hint ? toTrueFalse(hint) : null;
  const isTrueFalse =
    choices.length === 0 &&
    (block.trueFalseSection || TRUE_FALSE_HINT_RE.test(text) || tfFromHint !== null);

  if (choices.length === 0 && isTrueFalse) {
    return {
      text: text.replace(/\(?\s*(true\s*\/\s*false|t\s*\/\s*f)\s*\)?\s*$/i, "").trim(),
      choices: ["True", "False"],
      correctIndex: tfFromHint === null ? null : tfFromHint ? 0 : 1,
      type: "TRUE_FALSE",
    };
  }

  // A two-choice "True / False" question written out as choices.
  if (
    choices.length === 2 &&
    choices.every((c) => toTrueFalse(c.text) !== null) &&
    toTrueFalse(choices[0].text) !== toTrueFalse(choices[1].text)
  ) {
    const trueFirst = toTrueFalse(choices[0].text) === true;
    const markedIdx = choices.findIndex((c) => c.marked);
    let correctIndex: number | null = markedIdx === -1 ? null : markedIdx;
    if (correctIndex === null && tfFromHint !== null) correctIndex = tfFromHint === trueFirst ? 0 : 1;
    if (correctIndex === null && hint) correctIndex = letterIndex(hint);
    return { text, choices: choices.map((c) => c.text), correctIndex, type: "TRUE_FALSE" };
  }

  if (choices.length === 0) {
    return { excerpt, reason: "No answer choices found (open-ended question)" };
  }
  if (choices.length === 1) {
    return { excerpt, reason: "Only one answer choice found" };
  }
  if (!text) {
    return { excerpt, reason: "Choices found without a question" };
  }
  choices = choices.filter((c) => c.text !== "");
  if (choices.length < 2) {
    return { excerpt, reason: "Answer choices are empty" };
  }

  // Marked choice wins, but only if exactly one is marked (all-bold choices
  // mean the teacher just formatted the list, not that they're all right).
  const marked = choices.map((c, i) => (c.marked ? i : -1)).filter((i) => i !== -1);
  let correctIndex: number | null = marked.length === 1 ? marked[0] : null;

  if (correctIndex === null && hint) {
    correctIndex = letterIndex(hint);
    if (correctIndex === null) {
      const byText = choices.findIndex((c) => c.text.toLowerCase() === hint.toLowerCase().trim());
      correctIndex = byText === -1 ? null : byText;
    }
  }
  if (correctIndex !== null && correctIndex >= choices.length) correctIndex = null;

  return { text, choices: choices.map((c) => c.text), correctIndex, type: "MULTIPLE_CHOICE" };
}

function isAnswerCell(value: string): boolean {
  return /^\(?[a-f]\)?\.?$/i.test(value.trim()) || /^[1-6]$/.test(value.trim());
}

function letterIndex(value: string): number | null {
  const m = value.trim().match(/^\(?([a-f])\)?\.?(?:\s|$)/i);
  return m ? m[1].toLowerCase().charCodeAt(0) - 97 : null;
}

function toTrueFalse(value: string): boolean | null {
  const v = value.trim().toLowerCase().replace(/[.!]$/, "");
  if (TRUE_WORDS.has(v)) return true;
  if (FALSE_WORDS.has(v)) return false;
  return null;
}

// ── spreadsheet helpers ─────────────────────────────────────────────────────

function parseTable(rows: SheetRows, headerIndex: number): ExtractionResult {
  const header = rows[headerIndex].map((h) => h.toLowerCase());
  const qCol = header.findIndex((h) => /^(question|item|tanong)s?\b/.test(h));
  const answerCol = header.findIndex(
    (h) => /answer|correct|key|sagot/.test(h) && !/explan|rationale|reason|paliwanag/.test(h),
  );
  const choiceCols = header
    .map((h, i) => ({ h, i }))
    .filter(
      ({ h, i }) =>
        i !== qCol &&
        i !== answerCol &&
        /^(?:(?:option|choice|choices|answer choice)\s*)?(?:[a-f]|[1-6])$/.test(h.replace(/[.):]/g, "").trim()),
    )
    .map(({ i }) => i);

  const skipped: SkippedItem[] = [];
  const questions: ExtractedQuestion[] = [];
  const title = headerIndex > 0 ? rows[0].find(Boolean) ?? null : null;

  for (const row of rows.slice(headerIndex + 1)) {
    const text = row[qCol] ?? "";
    if (!text) continue;
    const block: Block = {
      text,
      choices: choiceCols.map((i) => row[i] ?? "").filter(Boolean).map(markChoice),
      answerHint: answerCol === -1 ? null : row[answerCol] || null,
      trueFalseSection: false,
      raw: [row.filter(Boolean).join(" | ")],
    };
    const built = buildQuestion(block, null);
    if ("reason" in built) skipped.push(built);
    else questions.push(numberAnswerFix(built, block.answerHint));
  }
  return { title, questions, skipped };
}

function parsePositional(rows: SheetRows): ExtractionResult {
  const skipped: SkippedItem[] = [];
  const questions: ExtractedQuestion[] = [];
  for (const row of rows) {
    const cells = row.filter(Boolean);
    if (cells.length < 2) continue;
    const [text, ...cellsAfter] = cells;
    // A trailing explanation after the answer column isn't a choice.
    let rest = cellsAfter.filter((c) => !EXPLANATION_RE.test(c));
    if (rest.length >= 4 && rest[rest.length - 1].length > 40 && isAnswerCell(rest[rest.length - 2])) {
      rest = rest.slice(0, -1);
    }
    const last = rest[rest.length - 1];
    const lastIsAnswer =
      rest.length >= 3 &&
      (letterIndex(last) !== null || /^[1-6]$/.test(last) || rest.slice(0, -1).includes(last));
    const choiceCells = lastIsAnswer ? rest.slice(0, -1) : rest;
    const block: Block = {
      text: text.replace(/^\d{1,3}\s*[.)]\s*/, ""),
      choices: choiceCells.map(markChoice),
      answerHint: lastIsAnswer ? last : null,
      trueFalseSection: false,
      raw: [cells.join(" | ")],
    };
    const built = buildQuestion(block, null);
    if ("reason" in built) skipped.push(built);
    else questions.push(numberAnswerFix(built, block.answerHint));
  }
  return { title: null, questions, skipped };
}

/** Spreadsheets often give the answer as a choice number (1–6). */
function numberAnswerFix(q: ExtractedQuestion, hint: string | null): ExtractedQuestion {
  if (q.correctIndex === null && hint && /^[1-6]$/.test(hint.trim())) {
    const idx = Number(hint.trim()) - 1;
    if (idx < q.choices.length) return { ...q, correctIndex: idx };
  }
  return q;
}
