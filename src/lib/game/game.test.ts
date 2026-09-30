import { describe, expect, it } from "vitest";
import { pickQuestions, shuffleChoices } from "./pickQuestions";
import { GRACE_MS, rankPlayers, scoreAnswer } from "./score";

const questions = Array.from({ length: 10 }, (_, i) => ({
  id: `q${i}`,
  order: i,
  correctIndex: i === 3 ? null : 0,
}));

describe("pickQuestions", () => {
  it("takes the first N in order, skipping questions with no answer", () => {
    const picked = pickQuestions(questions, { count: 4, mode: "ordered" });
    expect(picked.map((q) => q.id)).toEqual(["q0", "q1", "q2", "q4"]);
  });

  it("caps the count at the number of eligible questions", () => {
    const picked = pickQuestions(questions, { count: 50, mode: "ordered", excludedIds: ["q0"] });
    expect(picked).toHaveLength(8);
  });

  it("draws a random subset without repeats", () => {
    const picked = pickQuestions(questions, { count: 5, mode: "random" });
    expect(picked).toHaveLength(5);
    expect(new Set(picked.map((q) => q.id)).size).toBe(5);
    expect(picked.some((q) => q.id === "q3")).toBe(false);
  });

  it("never picks excluded questions", () => {
    const excludedIds = ["q0", "q1", "q2"];
    const picked = pickQuestions(questions, { count: 10, mode: "random", excludedIds });
    expect(picked.some((q) => excludedIds.includes(q.id))).toBe(false);
  });
});

describe("shuffleChoices", () => {
  it("keeps track of the correct answer", () => {
    for (let i = 0; i < 20; i++) {
      const { choices, correctIndex } = shuffleChoices(["a", "b", "c", "d"], 2);
      expect(choices[correctIndex]).toBe("c");
      expect([...choices].sort()).toEqual(["a", "b", "c", "d"]);
    }
  });
});

describe("scoreAnswer", () => {
  const limitMs = 20000;

  it("gives 1000 for an instant correct answer and 500 at the buzzer", () => {
    expect(scoreAnswer({ correct: true, elapsedMs: 0, limitMs, previousStreak: 0 })).toMatchObject({ points: 1000 });
    expect(scoreAnswer({ correct: true, elapsedMs: limitMs, limitMs, previousStreak: 0 })).toMatchObject({ points: 500 });
  });

  it("scores wrong answers 0 and resets the streak", () => {
    expect(scoreAnswer({ correct: false, elapsedMs: 1000, limitMs, previousStreak: 4 })).toMatchObject({
      points: 0,
      streak: 0,
    });
  });

  it("adds a capped streak bonus", () => {
    expect(scoreAnswer({ correct: true, elapsedMs: 0, limitMs, previousStreak: 1 })).toMatchObject({
      points: 1100,
      streak: 2,
    });
    expect(scoreAnswer({ correct: true, elapsedMs: 0, limitMs, previousStreak: 20 })).toMatchObject({ points: 1500 });
  });

  it("rejects answers after the deadline plus grace", () => {
    expect(scoreAnswer({ correct: true, elapsedMs: limitMs + GRACE_MS + 1, limitMs, previousStreak: 0 })).toEqual({
      accepted: false,
      reason: "late",
    });
    expect(scoreAnswer({ correct: true, elapsedMs: limitMs + GRACE_MS, limitMs, previousStreak: 0 }).accepted).toBe(true);
  });
});

describe("rankPlayers", () => {
  it("orders by score and shares ranks on ties", () => {
    const ranked = rankPlayers([
      { nickname: "Leo", score: 900 },
      { nickname: "Ava", score: 1200 },
      { nickname: "Mia", score: 900 },
      { nickname: "Zoe", score: 100 },
    ]);
    expect(ranked.map((p) => [p.nickname, p.rank])).toEqual([
      ["Ava", 1],
      ["Leo", 2],
      ["Mia", 2],
      ["Zoe", 4],
    ]);
  });
});
