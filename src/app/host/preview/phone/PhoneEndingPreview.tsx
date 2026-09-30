"use client";

import { useEffect, useState } from "react";
import { InGame } from "@/app/play/PlayClient";
import type { PlayerState } from "@/lib/game/types";
import { LIST_FROM, LIST_TO } from "@/lib/game/finale";
import { PREVIEW_PLAYERS, REPLAY_MESSAGE } from "../previewData";

/**
 * The real phone screen, fed a finished game of 10: places 10–4 count down,
 * then the final screen. The viewer is "Sofia" (5th), or with `winner` "Mia"
 * (1st), who sees "Top 3!" until the podium has played. Restarts when the
 * preview page sends a replay message.
 */
export function PhoneEndingPreview({ winner = false }: { winner?: boolean }) {
  const [endedAt, setEndedAt] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setEndedAt(Date.now()), 0);
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data === REPLAY_MESSAGE) setEndedAt(Date.now());
    };
    window.addEventListener("message", onMessage);
    return () => {
      clearTimeout(t);
      window.removeEventListener("message", onMessage);
    };
  }, []);

  if (endedAt === null) return null;

  const meIndex = winner ? 0 : 4;
  const [myName, myScore] = PREVIEW_PLAYERS[meIndex];
  const state: PlayerState = {
    gameId: "preview",
    status: "ENDED",
    quizTitle: "Demo quiz",
    index: 14,
    total: 15,
    deadline: null,
    nextAt: null,
    endedAt,
    // Like the server: only places 4–10 ever reach a phone.
    places: PREVIEW_PLAYERS.slice(LIST_FROM - 1, LIST_TO).map(([nickname, score], i) => ({
      nickname,
      score,
      rank: i + LIST_FROM,
    })),
    serverNow: endedAt,
    question: null,
    correctIndex: null,
    me: { nickname: myName, score: myScore, rank: meIndex + 1, playerCount: PREVIEW_PLAYERS.length, kicked: false },
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
