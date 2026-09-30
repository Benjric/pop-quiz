import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { findJoinableGame } from "@/lib/game/engine";
import { newPlayerToken, setPlayerCookie } from "@/lib/player";
import { publishHost } from "@/lib/realtime";
import { errorResponse } from "@/lib/api";

const Body = z.object({
  pin: z
    .string()
    .transform((s) => s.replace(/\D/g, ""))
    .refine((s) => s.length === 6, "The game PIN has 6 digits."),
  nickname: z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .refine((s) => s.length >= 1, "Enter your name.")
    .refine((s) => s.length <= 20, "Keep your name to 20 characters or fewer."),
});

export async function POST(request: Request) {
  try {
    const { pin, nickname } = Body.parse(await request.json());

    const game = await findJoinableGame(pin);
    if (!game) {
      return NextResponse.json({ error: "No game with that PIN is running. Check the big screen." }, { status: 404 });
    }

    const taken = await prisma.player.findFirst({
      where: { gameId: game.id, nickname: { equals: nickname, mode: "insensitive" } },
      select: { id: true },
    });
    if (taken) {
      return NextResponse.json({ error: "Someone already has that name. Try another." }, { status: 409 });
    }

    const { token, tokenHash } = newPlayerToken();
    const player = await prisma.player.create({ data: { gameId: game.id, nickname, tokenHash } });
    await setPlayerCookie(player.id, token);
    await publishHost(game.id, "players");

    return NextResponse.json({ gameId: game.id });
  } catch (error) {
    return errorResponse(error);
  }
}
