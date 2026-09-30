import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * Students have no accounts. Joining a game creates a Player and stores
 * "<playerId>.<secret>" in an httpOnly cookie; only a hash of the secret is
 * kept in the database. A refreshed or re-opened phone rejoins as the same
 * player until the game ends.
 */
const COOKIE = "pq_player";
const MAX_AGE_SECONDS = 8 * 60 * 60;

export function newPlayerToken(): { token: string; tokenHash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, tokenHash: hash(token) };
}

export async function setPlayerCookie(playerId: string, token: string) {
  const jar = await cookies();
  jar.set(COOKIE, `${playerId}.${token}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearPlayerCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** The player this browser joined as, if the cookie is valid. */
export async function getCurrentPlayer() {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const [playerId, token] = raw.split(".");
  if (!playerId || !token) return null;

  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return null;

  const expected = Buffer.from(player.tokenHash, "hex");
  const actual = Buffer.from(hash(token), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return player;
}

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
