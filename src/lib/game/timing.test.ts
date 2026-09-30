import { describe, expect, it } from "vitest";
import { autoTimeLimit, LONG_QUESTION_SEC, SHORT_QUESTION_SEC } from "./timing";

describe("autoTimeLimit", () => {
  it("gives short questions 15 s", () => {
    expect(autoTimeLimit({ text: "Which planet is known as the Red Planet?", choices: ["Venus", "Mars", "Jupiter", "Saturn"] })).toBe(
      SHORT_QUESTION_SEC,
    );
    expect(
      autoTimeLimit({
        text: "On what date did Secretary Gonzales authorize the Division's establishment?",
        choices: ["March 2, 2000", "April 13, 2000", "October 30, 2000", "April 18, 2000"],
      }),
    ).toBe(SHORT_QUESTION_SEC);
  });

  it("gives long questions 25 s, counting the choices too", () => {
    expect(
      autoTimeLimit({
        text: "Marietta Tumaneng served six years as OIC-SDS, while Antonio Nang served only about eight months before retiring. What does this contrast suggest about leadership continuity in the Division's early years?",
        choices: ["That Nang's short tenure reflected poor performance.", "Rotation.", "Refusal.", "External circumstances."],
      }),
    ).toBe(LONG_QUESTION_SEC);
    // A short question whose choices are long still takes a while to read.
    expect(
      autoTimeLimit({
        text: "Which is true?",
        choices: [
          "The Division was established by a resolution of the City Council in early 2000.",
          "The Division was created by national law without any local resolution.",
          "The Division existed before the city was chartered.",
        ],
      }),
    ).toBe(LONG_QUESTION_SEC);
  });
});
