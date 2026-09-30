/** Answers this long after the deadline still count (network lag). */
export const GRACE_MS = 1000;

export const MAX_POINTS = 1000;
const STREAK_STEP = 100;
const STREAK_CAP = 500;

export type ScoreInput = {
  correct: boolean;
  elapsedMs: number;
  limitMs: number;
  /** The player's streak before this answer. */
  previousStreak: number;
};

export type ScoreResult =
  | { accepted: false; reason: "late" }
  | { accepted: true; points: number; streak: number; responseMs: number };

/**
 * Kahoot-style scoring: a correct answer is worth 1000 at once, falling to
 * 500 at the buzzer, plus 100 per answer in a streak after the first
 * (capped at 500). Wrong answers score 0 and reset the streak.
 */
export function scoreAnswer({ correct, elapsedMs, limitMs, previousStreak }: ScoreInput): ScoreResult {
  if (elapsedMs > limitMs + GRACE_MS) return { accepted: false, reason: "late" };

  const responseMs = Math.max(0, Math.min(elapsedMs, limitMs));
  if (!correct) return { accepted: true, points: 0, streak: 0, responseMs };

  const streak = previousStreak + 1;
  const speed = Math.round(MAX_POINTS * (1 - responseMs / limitMs / 2));
  const bonus = Math.min((streak - 1) * STREAK_STEP, STREAK_CAP);
  return { accepted: true, points: speed + bonus, streak, responseMs };
}

export type Ranked<T> = T & { rank: number };

/** Highest score first; players on the same score share a rank. */
export function rankPlayers<T extends { score: number; nickname: string }>(players: T[]): Ranked<T>[] {
  const sorted = players
    .slice()
    .sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname));
  let rank = 0;
  let lastScore: number | null = null;
  return sorted.map((p, i) => {
    if (p.score !== lastScore) {
      rank = i + 1;
      lastScore = p.score;
    }
    return { ...p, rank };
  });
}
