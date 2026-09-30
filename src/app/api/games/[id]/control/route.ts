import { NextResponse } from "next/server";
import { z } from "zod";
import { advance, assertTeacherOwnsGame, endGame, getHostState, kickPlayer, reveal } from "@/lib/game/engine";
import { getTeacherId } from "@/lib/session";
import { errorResponse, unauthorized } from "@/lib/api";

const STATUS = z.enum(["LOBBY", "QUESTION", "REVEAL", "LEADERBOARD", "ENDED"]);

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("next"), status: STATUS, index: z.number().int() }),
  z.object({ action: z.literal("reveal"), index: z.number().int() }),
  z.object({ action: z.literal("end") }),
  z.object({ action: z.literal("kick"), playerId: z.string().min(1) }),
]);

/** Teacher controls: next / reveal (timer ran out) / end / remove a player. */
export async function POST(request: Request, ctx: RouteContext<"/api/games/[id]/control">) {
  const teacherId = await getTeacherId();
  if (!teacherId) return unauthorized();
  const { id } = await ctx.params;

  try {
    await assertTeacherOwnsGame(id, teacherId);
    const body = Body.parse(await request.json());
    switch (body.action) {
      case "next":
        await advance(id, { status: body.status, index: body.index });
        break;
      case "reveal":
        await reveal(id, body.index);
        break;
      case "end":
        await endGame(id);
        break;
      case "kick":
        await kickPlayer(id, body.playerId);
        break;
    }
    return NextResponse.json(await getHostState(id));
  } catch (error) {
    return errorResponse(error);
  }
}
