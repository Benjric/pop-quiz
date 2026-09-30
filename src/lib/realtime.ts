import * as Ably from "ably";

/**
 * Live updates go through Ably (free tier). Messages carry no game data —
 * they only say "something changed", and each screen re-reads its own view
 * from the API. That keeps answers private (a phone never receives the
 * correct answer early) and means a missed message can't leave a screen
 * wrong: the periodic refresh catches it up.
 *
 * Without ABLY_API_KEY (e.g. local dev) publishing is a no-op and the
 * screens fall back to polling.
 */
let rest: Ably.Rest | null = null;

export function ablyConfigured(): boolean {
  return Boolean(process.env.ABLY_API_KEY);
}

export function ablyRest(): Ably.Rest | null {
  if (!ablyConfigured()) return null;
  rest ??= new Ably.Rest({ key: process.env.ABLY_API_KEY! });
  return rest;
}

export const gameChannel = (gameId: string) => `game:${gameId}`;
export const hostChannel = (gameId: string) => `game:${gameId}:host`;

export type LiveEvent = "state" | "players" | "answers";

/** Tell every screen in the game that the game moved on. */
export async function publishGame(gameId: string, event: LiveEvent = "state") {
  await publish(gameChannel(gameId), event);
  await publish(hostChannel(gameId), event);
}

/** Tell only the teacher's screens (joins, answer counts). */
export async function publishHost(gameId: string, event: LiveEvent) {
  await publish(hostChannel(gameId), event);
}

async function publish(channel: string, event: LiveEvent) {
  const client = ablyRest();
  if (!client) return;
  try {
    await client.channels.get(channel).publish(event, { at: Date.now() });
  } catch (error) {
    // A lost notification only delays screens until their next refresh.
    console.error("Ably publish failed", error);
  }
}
