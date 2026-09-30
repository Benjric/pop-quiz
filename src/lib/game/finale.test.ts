import { describe, expect, it } from "vitest";
import { finaleSeconds, listRows, PHONE_REVEAL_AFTER_S, WINNER_AT_S } from "./finale";

describe("finale", () => {
  it("lists places 4 to 10 only, so the podium stays a surprise", () => {
    expect(listRows(0)).toBe(0);
    expect(listRows(3)).toBe(0); // straight to the podium
    expect(listRows(5)).toBe(2); // 4th and 5th
    expect(listRows(10)).toBe(7); // 4th to 10th
    expect(listRows(100)).toBe(7);
  });

  it("phones wait until the winner is revealed", () => {
    expect(finaleSeconds(0)).toBe(0);
    expect(finaleSeconds(3)).toBeCloseTo(WINNER_AT_S + PHONE_REVEAL_AFTER_S);
    expect(finaleSeconds(10)).toBeLessThan(13); // the whole finale
    expect(finaleSeconds(100)).toBe(finaleSeconds(10));
  });
});
