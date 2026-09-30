import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { GameError } from "@/lib/game/engine";

/** Turns known errors into JSON the screens can show; rethrows the rest. */
export function errorResponse(error: unknown) {
  if (error instanceof GameError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  console.error(error);
  return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
}

export const unauthorized = () => NextResponse.json({ error: "Sign in first." }, { status: 401 });
