"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import type { HostState, PodiumEntry } from "@/lib/game/types";
import { formatNumber } from "@/lib/format";
import { playDrumRoll } from "@/lib/sounds";
import {
  BAR_DELAY_S,
  BAR_S,
  LIST_FROM,
  LIST_TO,
  listSeconds,
  ROW_STEP_S,
  top3TextAt,
  WINNER_AT_S as CONFETTI_AT_S,
} from "@/lib/game/finale";

/**
 * The end of the game on the projector, in two acts (timing: lib/game/finale):
 *   1. Places 10 down to 4 rise in one by one, so the top 3 stay a secret.
 *   2. Podium: 3rd, 2nd, then 1st rise up to a drum roll, and confetti falls
 *      with a crash and fanfare for the winner.
 * "Replay" runs it again. With reduced motion everything simply appears.
 */

export function FinalResults({ state }: { state: HostState }) {
  const [run, setRun] = useState(0);
  return <Sequence key={run} state={state} onReplay={() => setRun((r) => r + 1)} />;
}

function Sequence({ state, onReplay }: { state: HostState; onReplay: () => void }) {
  const everyone = state.leaderboard;
  const list = everyone.slice(LIST_FROM - 1, LIST_TO);
  const [act, setAct] = useState<"list" | "podium">(list.length ? "list" : "podium");

  const listMs = listSeconds(everyone.length) * 1000;
  useEffect(() => {
    if (!listMs) return;
    const t = setTimeout(() => setAct("podium"), listMs);
    return () => clearTimeout(t);
  }, [listMs]);

  return (
    <div className="relative flex flex-1 flex-col items-center gap-[3vh] overflow-hidden px-[4vw] py-[5vh]">
      {act === "list" ? (
        <PlacesList list={list} total={Math.min(everyone.length, LIST_TO)} />
      ) : (
        <Podium top={everyone.slice(0, 3)} quizTitle={state.game.quizTitle} />
      )}
      {everyone.length === 0 ? <p className="text-xl font-bold text-muted">Nobody played this game.</p> : null}
      {act === "podium" ? (
        <div className="anim-rise flex flex-wrap justify-center gap-3" style={{ animationDelay: `${everyone.length ? CONFETTI_AT_S + 0.8 : 0}s` }}>
          <button type="button" onClick={onReplay} className="btn btn-outline h-14 px-6 text-lg">
            <RotateCcw size={20} /> Replay
          </button>
          <Link href={`/dashboard/games/${state.game.id}`} className="btn btn-primary h-14 px-8 text-lg">
            View report
          </Link>
          <Link href="/dashboard" className="btn btn-outline h-14 px-8 text-lg">
            Dashboard
          </Link>
        </div>
      ) : null}
    </div>
  );
}

/** Places 4–10, revealed from the bottom (10th) up to 4th. */
function PlacesList({ list, total }: { list: PodiumEntry[]; total: number }) {
  return (
    <>
      <h1 className="anim-rise font-display text-[clamp(40px,4.4vw,64px)] font-extrabold">Top {total}</h1>
      <ol className="flex w-full max-w-250 flex-1 flex-col justify-center gap-[1.2vh]">
        {list.map((p, i) => (
          <li
            key={p.nickname}
            className="anim-rise flex h-[clamp(48px,7.5vh,80px)] items-center gap-6 rounded-3xl border-2 border-line bg-white px-8"
            // The lowest place first, 4th last.
            style={{ animationDelay: `${(list.length - 1 - i) * ROW_STEP_S}s` }}
          >
            <span className="w-14 font-display text-[clamp(28px,3vw,46px)] font-extrabold text-brand">{p.rank}</span>
            <span className="min-w-0 flex-1 truncate text-[clamp(20px,2.1vw,34px)] font-bold">{p.nickname}</span>
            <span className="font-display text-[clamp(24px,2.5vw,40px)] font-extrabold">{formatNumber(p.score)}</span>
          </li>
        ))}
      </ol>
      <p
        className="anim-pop font-display text-[clamp(26px,2.8vw,44px)] font-extrabold text-brand"
        style={{ animationDelay: `${top3TextAt(list.length)}s` }}
      >
        …and now, the top 3!
      </p>
    </>
  );
}

/** Podium bars: gold, silver and bronze, shaded top to bottom like metal. */
const MEDALS = {
  gold: {
    name: "Gold",
    fill: "linear-gradient(180deg, #FCE38A 0%, #F2C230 38%, #D19B0C 72%, #A87A04 100%)",
    text: "#5A3E00",
    glow: "rgba(209,155,12,0.8)",
  },
  silver: {
    name: "Silver",
    fill: "linear-gradient(180deg, #F4F6F9 0%, #D3D8E0 38%, #A9B1BD 72%, #858E9C 100%)",
    text: "#3A4150",
    glow: "rgba(133,142,156,0.8)",
  },
  bronze: {
    name: "Bronze",
    fill: "linear-gradient(180deg, #F2B98A 0%, #D98C4F 38%, #B5652B 72%, #8A4719 100%)",
    text: "#FFFFFF",
    glow: "rgba(181,101,43,0.8)",
  },
} as const;

function Podium({ top, quizTitle }: { top: PodiumEntry[]; quizTitle: string }) {
  const [first, second, third] = top;

  // Drum roll while 3rd, 2nd and 1st rise; a hit as each lands, and a crash
  // with a fanfare the moment the winner appears. Replay plays it again.
  const places = top.length;
  useEffect(() => {
    if (places === 0) return;
    const landings = [3, 2].filter((p) => p <= places).map((p) => BAR_DELAY_S[p as 3 | 2] + BAR_S);
    return playDrumRoll(CONFETTI_AT_S, landings);
  }, [places]);
  const columns = [
    { p: second, place: 2 as const, height: "h-[24vh]", medal: MEDALS.silver },
    { p: first, place: 1 as const, height: "h-[34vh]", medal: MEDALS.gold },
    { p: third, place: 3 as const, height: "h-[16vh]", medal: MEDALS.bronze },
  ];
  return (
    <>
      <div className="anim-rise flex flex-col items-center gap-1 text-center">
        <h1 className="font-display text-[clamp(40px,4.4vw,64px)] font-extrabold">Final results</h1>
        <p className="text-[clamp(16px,1.4vw,22px)] font-bold text-muted">{quizTitle}</p>
      </div>
      <div className="flex w-full max-w-250 flex-1 items-end justify-center gap-[2vw]">
        {columns.map(({ p, place, height, medal }) => {
          if (!p) return <div key={place} className="w-1/3" />;
          const barAt = BAR_DELAY_S[place];
          return (
            <div key={place} className="flex w-1/3 flex-col items-center gap-2">
              <div className="anim-pop flex max-w-full flex-col items-center" style={{ animationDelay: `${barAt + BAR_S - 0.2}s` }}>
                {place === 1 ? (
                  <svg viewBox="0 0 24 24" className="mb-1 w-[clamp(36px,4vw,60px)]" fill="#F2C230" stroke="#A87A04" strokeWidth="1" strokeLinejoin="round" aria-hidden>
                    <path d="M3 8 L7.5 12 L12 5 L16.5 12 L21 8 L19 19 H5 Z" />
                  </svg>
                ) : null}
                <span
                  className={`max-w-full truncate font-bold ${place === 1 ? "text-[clamp(26px,2.9vw,44px)]" : "text-[clamp(20px,2.2vw,34px)]"}`}
                >
                  {p.nickname}
                </span>
                <span className="font-display text-[clamp(18px,1.8vw,28px)] font-extrabold text-muted">
                  {formatNumber(p.score)}
                </span>
              </div>
              <div
                className={`anim-grow flex w-full items-start justify-center rounded-t-3xl pt-4 font-display text-[clamp(44px,5.5vw,88px)] font-extrabold ${height}`}
                style={{
                  background: medal.fill,
                  color: medal.text,
                  boxShadow: `inset 0 3px 0 rgba(255,255,255,0.45), 0 16px 36px -18px ${medal.glow}`,
                  textShadow: medal.text === "#FFFFFF" ? "0 2px 0 rgba(0,0,0,0.2)" : "0 1px 0 rgba(255,255,255,0.5)",
                  animationDelay: `${barAt}s`,
                  animationDuration: `${BAR_S}s`,
                }}
                aria-label={`${medal.name}, place ${place}`}
              >
                {place}
              </div>
            </div>
          );
        })}
      </div>
      {first ? <Confetti /> : null}
    </>
  );
}

// Fixed pseudo-random pieces (no Math.random during render).
const COLORS = ["#C8382B", "#1F5FBF", "#E8A317", "#1D7A4C", "#4B2BB5", "#A3317A", "#0E6F7A"];
const rand = (i: number, n: number) => {
  const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const PIECES = Array.from({ length: 80 }, (_, i) => ({
  left: rand(i, 1) * 100,
  delay: CONFETTI_AT_S + rand(i, 2) * 1.4,
  duration: 2.8 + rand(i, 3) * 2,
  drift: Math.round((rand(i, 4) - 0.5) * 260),
  spin: Math.round(360 + rand(i, 5) * 720),
  width: Math.round(8 + rand(i, 6) * 8),
  height: Math.round(12 + rand(i, 7) * 10),
  color: COLORS[i % COLORS.length],
  round: i % 5 === 0,
}));

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {PIECES.map((c, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={
            {
              left: `${c.left}%`,
              width: c.width,
              height: c.round ? c.width : c.height,
              borderRadius: c.round ? "50%" : 2,
              background: c.color,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
              "--drift": `${c.drift}px`,
              "--spin": `${c.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
