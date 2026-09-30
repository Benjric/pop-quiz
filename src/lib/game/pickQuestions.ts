export type PickMode = "random" | "ordered";

type Pickable = { id: string; order: number; correctIndex: number | null };

/**
 * Chooses which questions a game uses. Only questions with a correct answer
 * and not left out by the teacher are eligible; `count` is capped at that.
 * "ordered" takes the first N in quiz order; "random" draws N at random and
 * plays them in the drawn order, so every game gets a fresh mix.
 */
export function pickQuestions<T extends Pickable>(
  questions: T[],
  opts: { count: number; mode: PickMode; excludedIds?: string[]; random?: () => number },
): T[] {
  const excluded = new Set(opts.excludedIds ?? []);
  const eligible = questions
    .filter((q) => q.correctIndex !== null && !excluded.has(q.id))
    .sort((a, b) => a.order - b.order);

  const count = Math.max(0, Math.min(Math.floor(opts.count), eligible.length));
  if (opts.mode === "ordered") return eligible.slice(0, count);
  return shuffle(eligible, opts.random).slice(0, count);
}

/** Fisher–Yates; returns a new array. */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Shuffles a question's choices and returns where the correct one landed. */
export function shuffleChoices(
  choices: string[],
  correctIndex: number,
  random: () => number = Math.random,
): { choices: string[]; correctIndex: number } {
  const order = shuffle(choices.map((_, i) => i), random);
  return { choices: order.map((i) => choices[i]), correctIndex: order.indexOf(correctIndex) };
}
