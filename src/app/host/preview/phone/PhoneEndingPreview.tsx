"use client";

import { useEffect, useState } from "react";
import { InGame } from "@/app/play/PlayClient";
import type { PlayerState } from "@/lib/game/types";

// Places 4–10 of a made-up game; the phones never receive the top 3.
const PLACES = [
  ["Noah", 6930], ["Sofia", 6555], ["Ethan", 6120], ["Isabella", 5870],
  ["Lucas", 5230], ["Chloe", 4810], ["Mateo", 3995],
] as const;

/**
 * The real phone screen, fed a finished game of 10: places 10–4 count down,
 * then the final screen. The viewer is "Sofia" (5th), or with `winner` "Mia"
 * (1st), who sees "Top 3!" until the podium has played.
 */
export function PhoneEndingPreview({ winner = false }: { winner?: boolean }) {
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
    places: PLACES.map(([nickname, score], i) => ({ nickname, score, rank: i + 4 })),
    serverNow: endedAt,
    question: null,
    correctIndex: null,
    me: winner
      ? { nickname: "Mia", score: 8420, rank: 1, playerCount: 10, kicked: false }
      : { nickname: "Sofia", score: 6555, rank: 5, playerCount: 10, kicked: false },
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
