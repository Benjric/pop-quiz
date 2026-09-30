import { NextResponse } from "next/server";
import { z } from "zod";
import { submitAnswer } from "@/lib/game/engine";
import { getCurrentPlayer } from "@/lib/player";
import { errorResponse } from "@/lib/api";

const Body = z.object({
  index: z.number().int().min(0),
  choiceIndex: z.number().int().min(0),
});

export async function POST(request: Request) {
  const player = await getCurrentPlayer();
  if (!player) return NextResponse.json({ error: "Join the game first." }, { status: 401 });

  try {
    const { index, choiceIndex } = Body.parse(await request.json());
    await submitAnswer(player, index, choiceIndex);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
