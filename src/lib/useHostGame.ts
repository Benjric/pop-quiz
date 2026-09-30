"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCountdown, useLiveGame } from "@/lib/useLiveGame";
import type { GameStatus, HostState } from "@/lib/game/types";
import type { ConfirmOptions } from "@/components/ConfirmDialog";

type Control =
  | { action: "next"; status: GameStatus; index: number }
  | { action: "reveal"; index: number }
  | { action: "hold"; index: number }
  | { action: "end" }
  | { action: "restart" }
  | { action: "kick"; playerId: string };

/**
 * The teacher's view of a game, shared by the projector screen and the
 * monitor. Either screen may drive the game; the server's conditional moves
 * make sure two clicks on "Next" (or two screens' timers) only move it once.
 */
export function useHostGame(gameId: string) {
  const load = useCallback(async (): Promise<HostState | null> => {
    const res = await fetch(`/api/games/${gameId}/state`, { cache: "no-store" });
    if (!res.ok) throw new Error(`state ${res.status}`);
    return res.json();
  }, [gameId]);

  const { state, setState, live } = useLiveGame<HostState>({ gameId, role: "host", load });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const serverNow = state?.game.serverNow ?? null;
  const secondsLeft = useCountdown(state?.game.deadline ?? null, serverNow);
  const nextIn = useCountdown(state?.game.nextAt ?? null, serverNow);

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

  const hold = useCallback(() => {
    if (!state) return;
    void control({ action: "hold", index: state.game.currentIndex });
  }, [state, control]);

  // Clocks: close the question when time is up, and move on when the answer
  // screen's countdown ends. The server ignores repeats and stale moves.
  // Each move is remembered by its clock time, not just the question number,
  // so a restarted game's question 1 still gets closed.
  const firedFor = useRef<string | null>(null);
  const status = state?.game.status;
  const index = state?.game.currentIndex;
  const deadline = state?.game.deadline;
  const nextAt = state?.game.nextAt;
  useEffect(() => {
    if (index === undefined) return;
    let move: Control | null = null;
    let key = "";
    if (status === "QUESTION" && secondsLeft === 0) {
      move = { action: "reveal", index };
      key = `reveal:${index}:${deadline}`;
    } else if (status === "REVEAL" && nextIn === 0) {
      move = { action: "next", status: "REVEAL", index };
      key = `next:${index}:${nextAt}`;
    }
    if (!move || firedFor.current === key) return;
    firedFor.current = key;
    void control(move);
  }, [status, index, deadline, nextAt, secondsLeft, nextIn, control]);

  return { state, live, busy, error, secondsLeft, nextIn, control, next, hold };
}

/** Shared by the projector and the monitor. */
export const RESTART_CONFIRM: ConfirmOptions = {
  danger: true,
  title: "Restart the game?",
  body: "It goes back to the lobby with the same PIN and everyone stays joined, but all scores and answers so far are wiped.",
  confirmLabel: "Restart",
};

/** What the main button does at each stage. */
export function nextLabel(state: HostState): string | null {
  const { status, currentIndex, totalQuestions, autoAdvance } = state.game;
  const last = currentIndex >= totalQuestions - 1;
  switch (status) {
    case "LOBBY":
      return "Start game";
    case "QUESTION":
      return "Skip to answer";
    case "REVEAL":
      return last ? "Final results" : autoAdvance ? "Next question" : "Leaderboard";
    case "LEADERBOARD":
      return "Next question";
    case "ENDED":
      return null;
  }
}
