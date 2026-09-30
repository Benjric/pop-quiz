import { describe, expect, it } from "vitest";
import { parseQuestionsFromRows, parseQuestionsFromText } from "./parse";

describe("parseQuestionsFromText", () => {
  it("pulls numbered questions and lettered choices, skipping the title and directions", () => {
    const text = `
      Science Quiz: The Solar System
      Name: ____________  Date: ________
      Directions: Choose the letter of the best answer.
      1. Which planet is known as the Red Planet?
      A. Venus
      B. Mars*
      C. Jupiter
      D. Saturn
      2. What is the largest planet?
      a) Earth  b) Jupiter  c) Mars  d) Mercury
      Answer: B
      Page 1 of 2
    `;
    const result = parseQuestionsFromText(text);
    expect(result.title).toBe("Science Quiz: The Solar System");
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0]).toEqual({
      text: "Which planet is known as the Red Planet?",
      choices: ["Venus", "Mars", "Jupiter", "Saturn"],
      correctIndex: 1,
      type: "MULTIPLE_CHOICE",
    });
    expect(result.questions[1].choices).toEqual(["Earth", "Jupiter", "Mars", "Mercury"]);
    expect(result.questions[1].correctIndex).toBe(1);
  });

  it("reads choices written on the same line as the question", () => {
    const result = parseQuestionsFromText("1. 2 + 2 = ? A. 3 B. 4 C. 5 D. 6");
    expect(result.questions[0].text).toBe("2 + 2 = ?");
    expect(result.questions[0].choices).toEqual(["3", "4", "5", "6"]);
  });

  it("matches an answer key at the end, by position even when numbering restarts", () => {
    const text = `
      Test I
      1. Q one? A. x B. y
      2. Q two? A. x B. y
      Test II
      1. Q three? A. x B. y
      Answer Key
      Test I: 1. B 2. A
      Test II: 1. B
    `;
    const result = parseQuestionsFromText(text);
    expect(result.questions.map((q) => q.correctIndex)).toEqual([1, 0, 1]);
  });

  it("handles a True/False section and its key", () => {
    const text = `
      Directions: Write True if the statement is correct and False if not.
      1. The Sun is a star.
      2. The Moon makes its own light.
      Answers
      1. T 2. F
    `;
    const result = parseQuestionsFromText(text);
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0]).toMatchObject({ type: "TRUE_FALSE", choices: ["True", "False"], correctIndex: 0 });
    expect(result.questions[1].correctIndex).toBe(1);
  });

  it("skips open-ended questions and says why", () => {
    const result = parseQuestionsFromText("1. Explain why the sky is blue.\n2. Pick one: A. yes B. no");
    expect(result.questions).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toMatch(/open-ended/);
  });

  it("uses a single bold choice from Word as the answer, but not when every choice is bold", () => {
    const one = parseQuestionsFromText("1. Capital of France?\na. Rome\n**b. Paris**\nc. Madrid");
    expect(one.questions[0].correctIndex).toBe(1);
    const all = parseQuestionsFromText("1. Capital of France?\n**a. Rome**\n**b. Paris**");
    expect(all.questions[0].correctIndex).toBeNull();
  });

  it("leaves the answer empty when nothing marks it", () => {
    const result = parseQuestionsFromText("Q1 What color is grass? A. Blue B. Green");
    expect(result.questions[0].correctIndex).toBeNull();
  });

  it("does not treat a bare 'Answer:' line as an answer-key heading", () => {
    const result = parseQuestionsFromText("1. First? A. a B. b\nAnswer:\n2. Second? A. c B. d");
    expect(result.questions).toHaveLength(2);
  });

  it("joins a question that wraps onto a second line", () => {
    const result = parseQuestionsFromText("1. Which of the following is\nthe closest planet to the Sun?\nA. Mercury\nB. Venus");
    expect(result.questions[0].text).toBe("Which of the following is the closest planet to the Sun?");
  });
});

describe("parseQuestionsFromRows", () => {
  it("reads a table with a header row", () => {
    const rows = [
      ["Question", "A", "B", "C", "D", "Answer"],
      ["Red planet?", "Venus", "Mars", "Jupiter", "Saturn", "B"],
      ["Largest planet?", "Earth", "Jupiter", "Mars", "Venus", "2"],
      ["Explain gravity.", "", "", "", "", ""],
    ];
    const result = parseQuestionsFromRows(rows);
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].correctIndex).toBe(1);
    expect(result.questions[1].correctIndex).toBe(1);
    expect(result.skipped).toHaveLength(1);
  });

  it("reads rows without a header by position", () => {
    const rows = [["1. Red planet?", "Venus", "Mars", "Jupiter", "B"]];
    const result = parseQuestionsFromRows(rows);
    expect(result.questions[0]).toMatchObject({
      text: "Red planet?",
      choices: ["Venus", "Mars", "Jupiter"],
      correctIndex: 1,
    });
  });
});
