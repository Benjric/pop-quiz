"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCountdown, useLiveGame } from "@/lib/useLiveGame";
import type { GameStatus, HostState } from "@/lib/game/types";

type Control =
  | { action: "next"; status: GameStatus; index: number }
  | { action: "reveal"; index: number }
  | { action: "end" }
  | { action: "kick"; playerId: string };

/**
 * The teacher's view of a game, shared by the projector screen and the
 * monitor. Either screen may drive the game; the server's conditional moves
 * make sure two clicks on "Next" only move it once.
 */
export function useHostGame(gameId: string, { autoReveal }: { autoReveal: boolean }) {
  const load = useCallback(async (): Promise<HostState | null> => {
    const res = await fetch(`/api/games/${gameId}/state`, { cache: "no-store" });
    if (!res.ok) throw new Error(`state ${res.status}`);
    return res.json();
  }, [gameId]);

  const { state, setState, live } = useLiveGame<HostState>({ gameId, role: "host", load });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const secondsLeft = useCountdown(state?.game.deadline ?? null, state?.game.serverNow ?? null);

  const control = useCallback(
    async (body: Control) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/games/${gameId}/control`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) setError(json?.error ?? "That didn't work. Try again.");
        else if (json) setState(json);
      } catch {
        setError("No connection. Try again.");
      } finally {
        setBusy(false);
      }
    },
    [gameId, setState],
  );

  const next = useCallback(() => {
    if (!state) return;
    void control({ action: "next", status: state.game.status, index: state.game.currentIndex });
  }, [state, control]);

  // When the clock runs out, close the question (the server ignores repeats).
  const revealedFor = useRef<number | null>(null);
  const status = state?.game.status;
  const index = state?.game.currentIndex;
  useEffect(() => {
    if (!autoReveal || status !== "QUESTION" || secondsLeft !== 0 || index === undefined) return;
    if (revealedFor.current === index) return;
    revealedFor.current = index;
    void control({ action: "reveal", index });
  }, [autoReveal, status, secondsLeft, index, control]);

  return { state, live, busy, error, secondsLeft, control, next };
}

/** What the main button does at each stage. */
export function nextLabel(state: HostState): string | null {
  const { status, currentIndex, totalQuestions } = state.game;
  switch (status) {
    case "LOBBY":
      return "Start game";
    case "QUESTION":
      return "Skip to answer";
    case "REVEAL":
      return currentIndex >= totalQuestions - 1 ? "Final results" : "Leaderboard";
    case "LEADERBOARD":
      return "Next question";
    case "ENDED":
      return null;
  }
}
