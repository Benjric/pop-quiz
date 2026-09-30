import { NextResponse } from "next/server";
import { getPlayerState } from "@/lib/game/engine";
import { getCurrentPlayer } from "@/lib/player";

/** What this phone should show. 401 means "not in a game": show the join form. */
export async function GET() {
  const player = await getCurrentPlayer();
  if (!player) return NextResponse.json({ error: "Not in a game." }, { status: 401 });
  const state = await getPlayerState(player.id);
  if (!state) return NextResponse.json({ error: "Not in a game." }, { status: 401 });
  return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
}
