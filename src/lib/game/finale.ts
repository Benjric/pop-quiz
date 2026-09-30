/**
 * Timing of the end-of-game finale, shared by the projector (which plays it)
 * and the phones (which wait for it, so they don't spoil the winners).
 *
 *   1. List: places 10 down to 4 rise in one by one, then hold.
 *   2. Podium: 3rd, 2nd, then 1st rise to a drum roll; confetti for the winner.
 */
export const LIST_FROM = 4;
export const LIST_TO = 10;
export const ROW_STEP_S = 0.5; // between list rows
export const LIST_HOLD_S = 1.2; // how long the full list stays up
export const BAR_DELAY_S = { 3: 0.2, 2: 0.9, 1: 1.6 } as const; // podium, by place
export const BAR_S = 0.8;
/** Phones reveal this long after the winner appears on the projector. */
export const PHONE_REVEAL_AFTER_S = 0.3;
export const WINNER_AT_S = BAR_DELAY_S[1] + BAR_S;

/** How many rows the list act shows for this many players (0: straight to the podium). */
export function listRows(players: number): number {
  return Math.max(0, Math.min(players, LIST_TO) - (LIST_FROM - 1));
}

export function listSeconds(players: number): number {
  const rows = listRows(players);
  return rows ? (rows - 1) * ROW_STEP_S + 0.6 + LIST_HOLD_S : 0;
}

/** Seconds from the end of the game until the winner has been revealed. */
export function finaleSeconds(players: number): number {
  return players > 0 ? listSeconds(players) + WINNER_AT_S + PHONE_REVEAL_AFTER_S : 0;
}
