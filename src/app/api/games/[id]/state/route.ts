import { NextResponse } from "next/server";
import { assertTeacherOwnsGame, getHostState } from "@/lib/game/engine";
import { getTeacherId } from "@/lib/session";
import { errorResponse, unauthorized } from "@/lib/api";

export async function GET(_request: Request, ctx: RouteContext<"/api/games/[id]/state">) {
  const teacherId = await getTeacherId();
  if (!teacherId) return unauthorized();
  const { id } = await ctx.params;

  try {
    await assertTeacherOwnsGame(id, teacherId);
    const state = await getHostState(id);
    return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
