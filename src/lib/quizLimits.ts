/** Shared by the quiz editor (to point at the problem) and the save action. */
export const LIMITS = {
  title: 120,
  question: 1000,
  choice: 300,
  minChoices: 2,
  maxChoices: 6,
  questions: 500,
} as const;

export const choiceLetter = (index: number) => String.fromCharCode(65 + index);
