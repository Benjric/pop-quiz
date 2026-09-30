"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import QRCode from "qrcode";
import { Check, Maximize, Pause, RotateCcw, Square, Volume2, VolumeX, X } from "lucide-react";
import { nextLabel, RESTART_CONFIRM, useHostGame } from "@/lib/useHostGame";
import type { HostState } from "@/lib/game/types";
import { ChoiceShape, choiceStyle } from "@/components/choices";
import { Logo } from "@/components/Logo";
import { Credit } from "@/components/Credit";
import { useConfirm } from "@/components/ConfirmDialog";
import { FinalResults } from "./FinalResults";
import { formatNumber, formatPin, plural } from "@/lib/format";
import { isMuted, playBuzzer, playCountdownBeep, playTick, setMuted, unlockSounds } from "@/lib/sounds";

/**
 * The projector screen. Sized in viewport units so it fills any projector
 * or TV, from a 1280×720 classroom beamer up.
 */
export function HostScreen({ gameId }: { gameId: string }) {
  const { state, busy, error, secondsLeft, nextIn, control, next, hold } = useHostGame(gameId);
  useCountdownSounds(state?.game.status, state?.game.currentIndex, secondsLeft, nextIn);
  const [ask, dialog] = useConfirm();

  if (!state) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Logo size={56} />
      </main>
    );
  }

  const action = nextLabel(state);
  const nextButton = action ? (
    <button
      type="button"
      onClick={next}
      disabled={busy || (state.game.status === "LOBBY" && state.activeCount === 0)}
      className="btn btn-primary h-[clamp(52px,7vh,80px)] rounded-2xl px-[clamp(24px,3vw,44px)] text-[clamp(18px,1.9vw,28px)]"
    >
      {action}
    </button>
  ) : null;

  return (
    <main className="relative flex min-h-dvh flex-col">
      {state.game.status === "LOBBY" && <Lobby state={state} startButton={nextButton} onKick={(id) => control({ action: "kick", playerId: id })} />}
      {state.game.status === "QUESTION" && (
        <Question key={`q${state.game.currentIndex}`} state={state} secondsLeft={secondsLeft} skipButton={nextButton} />
      )}
      {state.game.status === "REVEAL" && (
        <Reveal key={`r${state.game.currentIndex}`} state={state} nextButton={nextButton} autoAdvance={<AutoAdvance state={state} nextIn={nextIn} onPause={hold} busy={busy} />} />
      )}
      {state.game.status === "LEADERBOARD" && (
        <Leaderboard key={`l${state.game.currentIndex}`} state={state} nextButton={nextButton} />
      )}
      {state.game.status === "ENDED" && <FinalResults state={state} />}
      {error ? (
        <p role="alert" className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-xl bg-danger px-4 py-2 font-bold text-white">
          {error}
        </p>
      ) : null}
      {dialog}
      <div className="absolute right-3 bottom-3 flex items-center gap-1">
        {state.game.status !== "ENDED" && state.game.status !== "LOBBY" ? (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              const ok = await ask(RESTART_CONFIRM);
              if (ok) void control({ action: "restart" });
            }}
            className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-muted opacity-40 hover:bg-white hover:text-ink hover:opacity-100"
          >
            <RotateCcw size={16} aria-hidden /> Restart
          </button>
        ) : null}
        {state.game.status !== "ENDED" ? (
          // Faded like the other corner buttons, so the class doesn't notice it.
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              const ok = await ask({
                danger: true,
                title: "End the game now?",
                body: "Everyone sees the final results. Scores so far are kept in the report.",
                confirmLabel: "End game",
              });
              if (ok) void control({ action: "end" });
            }}
            className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-muted opacity-40 hover:bg-white hover:text-danger hover:opacity-100"
          >
            <Square size={16} aria-hidden /> End game
          </button>
        ) : null}
        <SoundButton />
        <FullscreenButton />
      </div>
    </main>
  );
}

/**
 * Ticks each second of the question clock (sharper in the last 5), a buzzer
 * when time runs out, and beeps on the "next question in…" countdown.
 */
function useCountdownSounds(
  status: string | undefined,
  index: number | undefined,
  secondsLeft: number | null,
  nextIn: number | null,
) {
  useEffect(() => {
    // Browsers only allow sound once the page has been clicked.
    const unlock = () => unlockSounds();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const played = useRef<string | null>(null);
  useEffect(() => {
    let key: string | null = null;
    let play: (() => void) | null = null;
    if (status === "QUESTION" && secondsLeft !== null) {
      key = `q${index}:${secondsLeft}`;
      play = secondsLeft === 0 ? playBuzzer : () => playTick(secondsLeft <= 5);
    } else if (status === "REVEAL" && nextIn !== null && nextIn > 0) {
      key = `n${index}:${nextIn}`;
      play = () => playCountdownBeep(nextIn === 1);
    }
    if (!key || !play || played.current === key) return;
    played.current = key;
    play();
  }, [status, index, secondsLeft, nextIn]);
}

function SoundButton() {
  const [muted, setMutedState] = useState(isMuted);
  const label = muted ? "Turn sound on" : "Mute sound";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={muted}
      onClick={() => {
        setMuted(!muted);
        setMutedState(!muted);
        unlockSounds();
      }}
      className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-muted opacity-40 hover:bg-white hover:opacity-100"
    >
      {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
    </button>
  );
}

const noopSubscribe = () => () => {};

// ── lobby ───────────────────────────────────────────────────────────────────

function Lobby({
  state,
  startButton,
  onKick,
}: {
  state: HostState;
  startButton: React.ReactNode;
  onKick: (playerId: string) => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const host = useSyncExternalStore(noopSubscribe, () => window.location.host, () => "");
  const players = state.players.filter((p) => !p.kicked);
  const [ask, dialog] = useConfirm();

  useEffect(() => {
    const url = `${window.location.origin}/play?pin=${state.game.pin}`;
    QRCode.toDataURL(url, { margin: 1, width: 720, color: { dark: "#1E1B3A", light: "#FFFFFF" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [state.game.pin]);

  return (
    <>
      {dialog}
      <header className="flex items-center justify-between gap-6 border-b-2 border-line px-[4vw] py-[2vh]">
        <Logo size={40} />
        <p className="truncate text-[clamp(16px,1.4vw,22px)] font-bold text-muted">
          {state.game.quizTitle} · {plural(state.game.totalQuestions, "question")}
        </p>
      </header>
      <div className="grid flex-1 gap-[4vw] p-[4vw] md:grid-cols-2">
        <section className="card flex flex-col items-center justify-center gap-[3vh] rounded-4xl p-[3vw]">
          <h1 className="font-display text-[clamp(28px,2.8vw,44px)] font-extrabold">Scan to join</h1>
          <div className="aspect-square w-[min(34vh,30vw,380px)] min-w-44 overflow-hidden rounded-2xl border-3 border-line">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element -- a generated data URL
              <img src={qr} alt={`QR code to join with PIN ${formatPin(state.game.pin)}`} className="h-full w-full" />
            ) : null}
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-[clamp(14px,1.2vw,18px)] font-bold text-muted">
              or go to <span className="text-ink">{host}/play</span> and enter
            </p>
            <p className="text-[clamp(14px,1.2vw,18px)] font-bold tracking-[0.08em] text-muted uppercase">Game PIN</p>
            <p className="font-display text-[clamp(44px,4.6vw,72px)] leading-none font-extrabold tracking-[0.08em] text-brand">
              {formatPin(state.game.pin)}
            </p>
          </div>
        </section>
        <section className="flex min-h-0 flex-col gap-[3vh]">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[clamp(28px,2.8vw,44px)] font-extrabold">Players</h2>
            <span key={players.length} className="anim-bump font-display text-[clamp(40px,4vw,60px)] font-extrabold text-brand">
              {players.length}
            </span>
          </div>
          <ul className="flex flex-1 flex-wrap content-start gap-3 overflow-y-auto">
            {players.length === 0 ? (
              <li className="text-[clamp(16px,1.4vw,22px)] font-semibold text-muted">Waiting for players to join…</li>
            ) : (
              players.map((p) => (
                // New players pop in as they join.
                <li key={p.id} className="anim-pop">
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await ask({
                        danger: true,
                        title: `Remove ${p.nickname}?`,
                        body: "They leave the game and their phone says they were removed.",
                        confirmLabel: "Remove",
                      });
                      if (ok) onKick(p.id);
                    }}
                    title={`Remove ${p.nickname}`}
                    className="group flex cursor-pointer items-center gap-2 rounded-full border-2 border-line bg-white px-5 py-2.5 text-[clamp(16px,1.4vw,22px)] font-bold hover:border-danger hover:text-danger"
                  >
                    {p.nickname}
                    <X size={18} className="opacity-0 group-hover:opacity-100" aria-hidden />
                  </button>
                </li>
              ))
            )}
          </ul>
          <div className="flex flex-col">{startButton}</div>
        </section>
      </div>
      <Credit tone="dark" className="pb-[2.5vh] text-[clamp(14px,1.2vw,18px)]" />
    </>
  );
}

// ── question ────────────────────────────────────────────────────────────────

function Question({
  state,
  secondsLeft,
  skipButton,
}: {
  state: HostState;
  secondsLeft: number | null;
  skipButton: React.ReactNode;
}) {
  const question = state.question!;
  const urgent = secondsLeft !== null && secondsLeft > 0 && secondsLeft <= 5;
  return (
    <div className="flex flex-1 flex-col gap-[3vh] px-[4vw] py-[4vh]">
      <div className="flex items-center justify-between gap-4">
        <QuestionPill state={state} />
        <div className="flex items-center gap-[2vw]">
          <span className="text-[clamp(16px,1.4vw,22px)] font-bold text-muted">
            <span key={state.answeredCount} className="inline-block anim-bump text-ink">
              {state.answeredCount}
            </span>{" "}
            / {state.activeCount} answered
          </span>
          <span
            // Turns red and pulses every second for the last five.
            key={urgent ? secondsLeft : "calm"}
            className={`flex aspect-square w-[clamp(64px,6.5vw,104px)] items-center justify-center rounded-full font-display text-[clamp(28px,3vw,48px)] font-extrabold text-white transition-colors ${
              urgent ? "anim-heartbeat bg-[#C8382B]" : "bg-ink"
            }`}
          >
            {secondsLeft ?? ""}
          </span>
        </div>
      </div>
      <QuestionCard text={question.text} />
      <Tiles choices={question.choices} />
      <div className="flex justify-end">{skipButton}</div>
    </div>
  );
}

// ── reveal ──────────────────────────────────────────────────────────────────

function Reveal({
  state,
  nextButton,
  autoAdvance,
}: {
  state: HostState;
  nextButton: React.ReactNode;
  autoAdvance: React.ReactNode;
}) {
  const question = state.question!;
  const most = Math.max(1, ...state.distribution);
  const correct = state.distribution[question.correctIndex] ?? 0;
  return (
    <div className="flex flex-1 flex-col gap-[3vh] px-[4vw] py-[4vh]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <QuestionPill state={state} />
        <span className="text-[clamp(16px,1.4vw,22px)] font-bold text-muted">
          {correct} of {state.activeCount} got it right
        </span>
        <div className="flex items-center gap-3">
          {autoAdvance}
          {nextButton}
        </div>
      </div>
      <p className="text-center font-display text-[clamp(24px,2.6vw,40px)] leading-tight font-extrabold">{question.text}</p>
      <div className="flex flex-1 items-end justify-center gap-[3vw]" aria-label="Answers per choice">
        {question.choices.map((_, i) => {
          const style = choiceStyle(i);
          const count = state.distribution[i] ?? 0;
          const isCorrect = i === question.correctIndex;
          return (
            <div
              key={i}
              className={`flex w-[clamp(64px,9vw,140px)] flex-col items-center gap-2 ${isCorrect ? "" : "anim-dim"}`}
              // Wrong answers fade back once the bars have grown.
              style={isCorrect ? undefined : { animationDelay: "1.1s" }}
            >
              <span className="anim-pop font-display text-[clamp(22px,2.4vw,36px)] font-extrabold" style={{ animationDelay: `${0.5 + i * 0.12}s` }}>
                {count}
              </span>
              <div
                className="anim-grow w-full rounded-t-xl"
                style={{
                  background: style.bg,
                  height: `${(count / most) * 22}vh`,
                  minHeight: 8,
                  animationDelay: `${i * 0.12}s`,
                }}
              />
              <div className="flex w-full items-center justify-center gap-2 rounded-b-xl py-2" style={{ background: style.bg }}>
                <ChoiceShape index={i} size={28} />
                {isCorrect ? <Check size={28} color={style.fg} strokeWidth={3} aria-label="Correct" /> : null}
              </div>
            </div>
          );
        })}
      </div>
      <Tiles choices={question.choices} correctIndex={question.correctIndex} />
    </div>
  );
}

// ── leaderboard ─────────────────────────────────────────────────────────────

function Leaderboard({ state, nextButton }: { state: HostState; nextButton: React.ReactNode }) {
  const top = state.leaderboard.slice(0, 5);
  return (
    <div className="flex flex-1 flex-col gap-[3vh] px-[4vw] py-[5vh]">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-[clamp(36px,3.9vw,56px)] font-extrabold">Leaderboard</h1>
        {nextButton}
      </div>
      <ol className="mx-auto flex w-full max-w-250 flex-1 flex-col justify-center gap-[1.6vh]">
        {top.map((p, i) => (
          <li
            key={p.nickname}
            style={{ animationDelay: `${i * 0.12}s` }}
            className={`anim-rise flex items-center gap-6 rounded-3xl px-8 ${
              i === 0 ? "h-[clamp(64px,10.5vh,96px)] bg-brand text-white" : "h-[clamp(56px,9.5vh,88px)] border-2 border-line bg-white"
            }`}
          >
            <span className={`w-12 font-display text-[clamp(26px,2.6vw,40px)] font-extrabold ${i === 0 ? "" : i < 3 ? "text-brand" : "text-muted"}`}>
              {p.rank}
            </span>
            <span className="flex-1 truncate text-[clamp(20px,2vw,32px)] font-bold">{p.nickname}</span>
            <span className="font-display text-[clamp(22px,2.3vw,36px)] font-extrabold">{formatNumber(p.score)}</span>
          </li>
        ))}
      </ol>
      <p className="text-center text-[clamp(16px,1.4vw,20px)] font-bold text-muted">
        After question {state.game.currentIndex + 1} of {state.game.totalQuestions} · {plural(state.activeCount, "player")}
      </p>
    </div>
  );
}

// ── pieces ──────────────────────────────────────────────────────────────────

/** "Next question in 4 · Pause" while the answer screen counts down. */
function AutoAdvance({
  state,
  nextIn,
  onPause,
  busy,
}: {
  state: HostState;
  nextIn: number | null;
  onPause: () => void;
  busy: boolean;
}) {
  if (!state.game.autoAdvance) return null;
  const last = state.game.currentIndex >= state.game.totalQuestions - 1;
  if (state.game.nextAt === null) {
    return <span className="text-[clamp(16px,1.4vw,22px)] font-bold text-muted">Paused</span>;
  }
  return (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-3 text-[clamp(16px,1.4vw,22px)] font-bold text-muted">
        {last ? "Results in" : "Next question in"}
        <span
          key={nextIn ?? "none"}
          className="anim-bump flex aspect-square w-[clamp(52px,5vw,72px)] items-center justify-center rounded-full bg-ink font-display text-[clamp(24px,2.4vw,36px)] font-extrabold text-white"
        >
          {nextIn ?? ""}
        </span>
      </span>
      <button
        type="button"
        onClick={onPause}
        disabled={busy}
        className="btn btn-outline h-[clamp(52px,7vh,80px)] rounded-2xl px-[clamp(18px,2vw,32px)] text-[clamp(16px,1.6vw,24px)]"
      >
        <Pause size={22} /> Pause
      </button>
    </div>
  );
}

function QuestionPill({ state }: { state: HostState }) {
  return (
    <span className="rounded-full bg-brand-soft px-5 py-2.5 text-[clamp(16px,1.4vw,22px)] font-bold whitespace-nowrap text-brand">
      Question {state.game.currentIndex + 1} of {state.game.totalQuestions}
    </span>
  );
}

function QuestionCard({ text }: { text: string }) {
  return (
    <div className="anim-rise card flex flex-1 items-center justify-center rounded-4xl p-[3vw] text-center">
      <p className="max-w-275 font-display text-[clamp(28px,3.9vw,60px)] leading-[1.15] font-extrabold">{text}</p>
    </div>
  );
}

function Tiles({ choices, correctIndex }: { choices: string[]; correctIndex?: number }) {
  return (
    <div className={`grid gap-[1.4vw] ${choices.length > 4 ? "grid-cols-3" : "grid-cols-2"}`}>
      {choices.map((choice, i) => {
        const style = choiceStyle(i);
        const revealing = correctIndex !== undefined;
        // Question: tiles pop in one after another. Answer: the right one
        // bounces, the others fade back.
        const anim = !revealing ? "anim-pop" : i === correctIndex ? "anim-celebrate" : "anim-dim";
        const delay = !revealing ? 0.25 + i * 0.1 : i === correctIndex ? 0.2 : 0.1;
        return (
          <div
            key={i}
            className={`${anim} flex min-h-[clamp(72px,14vh,128px)] items-center gap-[1.6vw] rounded-3xl px-[2vw] py-3 text-[clamp(20px,2.4vw,36px)] font-bold`}
            style={{ background: style.bg, color: style.fg, animationDelay: `${delay}s` }}
          >
            <ChoiceShape index={i} size={44} />
            <span className="flex-1 wrap-break-word">{choice}</span>
            {correctIndex === i ? <Check size={44} strokeWidth={3} aria-label="Correct answer" /> : null}
          </div>
        );
      })}
    </div>
  );
}

function FullscreenButton() {
  return (
    <button
      type="button"
      aria-label="Full screen"
      title="Full screen"
      onClick={() => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen().catch(() => null);
      }}
      className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-muted opacity-40 hover:bg-white hover:opacity-100"
    >
      <Maximize size={20} />
    </button>
  );
}
