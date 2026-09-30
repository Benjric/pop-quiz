/**
 * "Auto" question timing: a question with a lot to read gets more time.
 * Length counts the question and all its choices, since students read both.
 */
export const SHORT_QUESTION_SEC = 15;
export const LONG_QUESTION_SEC = 25;
export const LONG_QUESTION_CHARS = 160;

export function readingLength(q: { text: string; choices: string[] }): number {
  return q.text.trim().length + q.choices.reduce((sum, c) => sum + c.trim().length, 0);
}

export function isLongQuestion(q: { text: string; choices: string[] }): boolean {
  return readingLength(q) > LONG_QUESTION_CHARS;
}

export function autoTimeLimit(q: { text: string; choices: string[] }): number {
  return isLongQuestion(q) ? LONG_QUESTION_SEC : SHORT_QUESTION_SEC;
}
