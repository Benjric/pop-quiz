"use client";

import { useEffect, useState } from "react";
import { FinalResults } from "@/app/host/[gameId]/FinalResults";
import type { HostState } from "@/lib/game/types";
import { unlockSounds } from "@/lib/sounds";
import { PREVIEW_PLAYERS, REPLAY_MESSAGE } from "../previewData";

const STATE: HostState = {
  game: {
    id: "preview",
    pin: "000000",
    status: "ENDED",
    quizId: "preview",
    quizTitle: "Demo quiz",
    currentIndex: 14,
    totalQuestions: 15,
    timeLimitSec: 15,
    autoAdvance: true,
    deadline: null,
    nextAt: null,
    serverNow: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  question: null,
  players: [],
  activeCount: PREVIEW_PLAYERS.length,
  answeredCount: 0,
  distribution: [],
  leaderboard: PREVIEW_PLAYERS.map(([nickname, score], i) => ({ nickname, score, rank: i + 1 })),
  questions: [],
};

/**
 * The real projector finale with made-up players. Restarts when the preview
 * page sends a replay message, so it stays in step with the phone beside it.
 */
export function ProjectorFinalePreview() {
  const [run, setRun] = useState(0);

  useEffect(() => {
    const unlock = () => unlockSounds();
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data === REPLAY_MESSAGE) setRun((r) => r + 1);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("message", onMessage);
    };
  }, []);

  return (
    <main className="relative flex min-h-dvh flex-col">
      <FinalResults key={run} state={STATE} />
    </main>
  );
}
