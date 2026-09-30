"use client";

import { useEffect, useState } from "react";
import { InGame } from "@/app/play/PlayClient";
import type { PlayerState } from "@/lib/game/types";

const PLAYERS = 10;

/**
 * The real phone screen, fed a finished game where the viewer is "Ava" in
 * 3rd place: the "And the winners are…" wait, then the result.
 */
export function PhoneEndingPreview() {
  const [endedAt, setEndedAt] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setEndedAt(Date.now()), 0);
    return () => clearTimeout(t);
  }, []);

  if (endedAt === null) return null;

  const state: PlayerState = {
    gameId: "preview",
    status: "ENDED",
    quizTitle: "Demo quiz",
    index: 14,
    total: 15,
    deadline: null,
    nextAt: null,
    endedAt,
    serverNow: endedAt,
    question: null,
    correctIndex: null,
    me: { nickname: "Ava", score: 7610, rank: 3, playerCount: PLAYERS, kicked: false },
    myAnswer: null,
  };

  return (
    <InGame
      key={endedAt}
      state={state}
      refresh={async () => {}}
      // "Join another game" replays the preview.
      leave={() => setEndedAt(Date.now())}
    />
  );
}
