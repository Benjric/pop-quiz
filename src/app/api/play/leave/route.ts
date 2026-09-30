import { NextResponse } from "next/server";
import { clearPlayerCookie } from "@/lib/player";

/** "Join another game": forget which game this phone was in. */
export async function POST() {
  await clearPlayerCookie();
  return NextResponse.json({ ok: true });
}
