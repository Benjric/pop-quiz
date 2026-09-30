import { NextResponse } from "next/server";
import { ablyRest, gameChannel, hostChannel } from "@/lib/realtime";
import { assertTeacherOwnsGame } from "@/lib/game/engine";
import { getCurrentPlayer } from "@/lib/player";
import { getTeacherId } from "@/lib/session";
import { errorResponse } from "@/lib/api";

/**
 * Short-lived Ably tokens. Screens may only listen — never publish — and a
 * phone can only listen to its own game's public channel.
 */
export async function GET(request: Request) {
  const client = ablyRest();
  if (!client) return NextResponse.json({ error: "Live updates are not configured." }, { status: 503 });

  const url = new URL(request.url);
  const gameId = url.searchParams.get("gameId") ?? "";
  const role = url.searchParams.get("role");

  try {
    if (role === "host") {
      const teacherId = await getTeacherId();
      if (!teacherId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
      await assertTeacherOwnsGame(gameId, teacherId);
      const token = await client.auth.createTokenRequest({
        clientId: `teacher:${teacherId}`,
        capability: { [gameChannel(gameId)]: ["subscribe"], [hostChannel(gameId)]: ["subscribe"] },
      });
      return NextResponse.json(token);
    }

    const player = await getCurrentPlayer();
    if (!player || player.gameId !== gameId) {
      return NextResponse.json({ error: "Join the game first." }, { status: 401 });
    }
    const token = await client.auth.createTokenRequest({
      clientId: `player:${player.id}`,
      capability: { [gameChannel(gameId)]: ["subscribe"] },
    });
    return NextResponse.json(token);
  } catch (error) {
    return errorResponse(error);
  }
}
