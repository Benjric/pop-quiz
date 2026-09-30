"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useCountdown, useLiveGame } from "@/lib/useLiveGame";
import type { PlayerState } from "@/lib/game/types";
import { ChoiceShape, choiceStyle } from "@/components/choices";
import { LogoMark } from "@/components/Logo";
import { formatNumber, formatPin, ordinal } from "@/lib/format";

/**
 * The student's phone. Every screen fills the viewport (dvh, so mobile
 * browser bars don't cut it off), pads around notches, and sizes its type
 * from the viewport, so it fits anything from a 320px phone to a tablet,
 * portrait or landscape.
 */

/** "out" = this phone isn't in a game (show the join form). */
type View = PlayerState | "out";

async function loadView(): Promise<View> {
  const res = await fetch("/api/play/state", { cache: "no-store" });
  if (res.status === 401) return "out";
  if (!res.ok) throw new Error(`state ${res.status}`);
  return res.json();
}

export function PlayClient({ initialPin }: { initialPin: string }) {
  const [gameId, setGameId] = useState<string | null>(null);
  const load = useCallback(async () => {
    const view = await loadView();
    setGameId(view === "out" ? null : view.gameId);
    return view;
  }, []);
  const { state, setState, refresh } = useLiveGame<View>({ gameId, role: "player", load });

  const leave = async () => {
    await fetch("/api/play/leave", { method: "POST" }).catch(() => null);
    setGameId(null);
    setState("out");
  };

  if (state === null) {
    return (
      <Screen tone="brand">
        <LogoMark size={64} inverted />
        <p className="font-bold">Loading…</p>
      </Screen>
    );
  }
  if (state === "out") return <JoinForm initialPin={initialPin} onJoined={refresh} />;
  return <InGame state={state} refresh={refresh} leave={leave} />;
}

// ── joining ─────────────────────────────────────────────────────────────────

function JoinForm({ initialPin, onJoined }: { initialPin: string; onJoined: () => Promise<void> }) {
  const [pin, setPin] = useState(initialPin);
  const [editingPin, setEditingPin] = useState(initialPin.length !== 6);
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/play/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, nickname }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Couldn't join. Try again.");
        return;
      }
      await onJoined();
    } catch {
      setError("No connection. Check your Wi-Fi and try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="safe-screen flex min-h-dvh flex-col items-center justify-center gap-[clamp(16px,4dvh,32px)] bg-brand">
      <div className="flex flex-col items-center gap-2">
        <LogoMark size={56} inverted />
        <h1 className="font-display text-phone-hero font-extrabold text-white">Pop Quiz</h1>
      </div>
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-3 rounded-3xl bg-white p-[clamp(16px,5vw,24px)]">
        {editingPin ? (
          <>
            <label htmlFor="pin" className="text-phone-lg font-bold">
              Game PIN
            </label>
            <input
              id="pin"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000 000"
              maxLength={7}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="field h-14 min-w-0 text-center font-display text-2xl font-extrabold tracking-[0.12em]"
            />
          </>
        ) : (
          <div className="flex items-center justify-between gap-2 text-[15px] font-bold text-muted">
            <span>Game PIN {formatPin(pin)}</span>
            <button
              type="button"
              onClick={() => setEditingPin(true)}
              className="-m-2 p-2 text-brand underline-offset-2 hover:underline"
            >
              Change
            </button>
          </div>
        )}
        <label htmlFor="nick" className="text-phone-lg font-bold">
          Your name
        </label>
        <input
          id="nick"
          placeholder="e.g. Ava"
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="go"
          autoFocus={!editingPin}
          maxLength={20}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          // 16px+ stops iOS zooming into the field.
          className="field h-14 min-w-0 text-xl"
        />
        {error ? (
          <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className="btn btn-dark mt-1 h-14 text-xl">
          {pending ? "Joining…" : "Join game"}
        </button>
      </form>
      <p className="text-center font-semibold text-[#E4DDFB]">No account or app needed</p>
    </main>
  );
}

// ── in the game ─────────────────────────────────────────────────────────────

function InGame({ state, refresh, leave }: { state: PlayerState; refresh: () => Promise<void>; leave: () => void }) {
  const secondsLeft = useCountdown(state.deadline, state.serverNow);
  const nextIn = useCountdown(state.nextAt, state.serverNow);
  const [pending, setPending] = useState<{ index: number; choice: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { me } = state;

  // Check in when a clock runs out, in case the live update is missed.
  const wakeAt = state.nextAt ?? (state.deadline !== null ? state.deadline + 1200 : null);
  useEffect(() => {
    if (wakeAt === null) return;
    const t = setTimeout(() => void refresh(), Math.max(0, wakeAt - state.serverNow) + 400);
    return () => clearTimeout(t);
  }, [wakeAt, state.serverNow, refresh]);

  const upNext =
    nextIn !== null
      ? `${state.index >= state.total - 1 ? "Final results" : "Next question"} in ${nextIn}…`
      : "Look at the big screen for the next question";

  if (me.kicked) {
    return (
      <Screen tone="ink">
        <h1 className="font-display text-phone-hero font-extrabold">You were removed from this game</h1>
        <p className="text-phone-lg font-semibold text-white/80">Ask your teacher if this was a mistake.</p>
        <JoinAnother onClick={leave} />
      </Screen>
    );
  }

  switch (state.status) {
    case "LOBBY":
      return (
        <Screen tone="brand">
          <span className="anim-pop">
            <CheckBadge color="#4B2BB5" />
          </span>
          <h1 className="anim-rise font-display text-phone-hero font-extrabold" style={{ animationDelay: "0.15s" }}>
            You&apos;re in!
          </h1>
          <p
            className="anim-pop max-w-full rounded-full bg-white px-6 py-2.5 font-display text-[clamp(22px,7vw,32px)] font-extrabold wrap-break-word text-brand"
            style={{ animationDelay: "0.35s" }}
          >
            {me.nickname}
          </p>
          <p className="text-phone-lg font-bold">Look for your name on the big screen</p>
          <p className="font-semibold text-[#E4DDFB]">{state.quizTitle}</p>
        </Screen>
      );

    case "QUESTION": {
      const answered = state.myAnswer ?? (pending?.index === state.index ? { choiceIndex: pending.choice } : null);
      if (answered) {
        const style = choiceStyle(answered.choiceIndex);
        return (
          <Screen tone="brand" header={<StatusBar state={state} />}>
            <span
              className="anim-pop flex aspect-square w-[clamp(80px,min(28vw,16dvh),112px)] items-center justify-center rounded-3xl"
              style={{ background: style.bg }}
            >
              <ChoiceShape index={answered.choiceIndex} size={56} />
            </span>
            <h1 className="anim-rise font-display text-phone-hero font-extrabold" style={{ animationDelay: "0.1s" }}>
              Answer locked in
            </h1>
            <p className="animate-pulse text-phone-lg motion-reduce:animate-none font-bold text-[#E4DDFB]">Waiting for everyone else…</p>
          </Screen>
        );
      }
      if (secondsLeft === 0) {
        return (
          <Screen tone="ink" header={<StatusBar state={state} />}>
            <h1 className="anim-shake font-display text-phone-hero font-extrabold">Time&apos;s up!</h1>
            <p className="text-phone-lg font-bold text-white/80">Look at the big screen for the answer</p>
          </Screen>
        );
      }
      const question = state.question!;
      const answer = async (choice: number) => {
        setError(null);
        setPending({ index: state.index, choice });
        try {
          const res = await fetch("/api/play/answer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ index: state.index, choiceIndex: choice }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            setPending(null);
            setError(body.error ?? "That answer didn't go through.");
          }
        } catch {
          setPending(null);
          setError("No connection. Try again.");
        }
        await refresh();
      };
      const many = question.choices.length > 4;
      return (
        <main className="safe-screen flex min-h-dvh flex-col gap-3 bg-ivory">
          <div className="flex items-center justify-between gap-3 text-[15px] font-bold">
            <span className="shrink-0 text-muted">
              Q{state.index + 1} of {state.total}
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">
                {me.nickname} · {formatNumber(me.score)}
              </span>
              {secondsLeft !== null ? (
                <span
                  // Red and pulsing for the last five seconds.
                  key={secondsLeft > 0 && secondsLeft <= 5 ? secondsLeft : "calm"}
                  className={`flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full px-2 font-display font-extrabold text-white ${
                    secondsLeft > 0 && secondsLeft <= 5 ? "anim-heartbeat bg-[#C8382B]" : "bg-ink"
                  }`}
                  aria-label={`${secondsLeft} seconds left`}
                >
                  {secondsLeft}
                </span>
              ) : null}
            </span>
          </div>
          <h1 className="anim-rise font-display text-phone-question font-extrabold wrap-break-word">{question.text}</h1>
          {error ? (
            <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">
              {error}
            </p>
          ) : null}
          <div
            className={`grid min-h-[max(45dvh,200px)] flex-1 auto-rows-fr gap-[clamp(8px,2.5vw,14px)] ${
              question.choices.length === 2
                ? "grid-cols-1 landscape:grid-cols-2"
                : many
                  ? "grid-cols-2 landscape:grid-cols-3"
                  : "grid-cols-2"
            }`}
          >
            {question.choices.map((choice, i) => {
              const style = choiceStyle(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => answer(i)}
                  className="anim-pop flex min-h-18 min-w-0 cursor-pointer flex-col items-center justify-center gap-[clamp(4px,1.5dvh,12px)] rounded-[20px] p-2 text-[clamp(14px,min(4.6vw,3dvh),20px)] leading-tight font-bold wrap-break-word transition-transform active:scale-95 landscape:flex-row landscape:px-4"
                  style={{
                    background: style.bg,
                    color: style.fg,
                    animationDelay: `${0.15 + i * 0.07}s`,
                    // Let go of the pop's transform afterwards so the tap-press still works.
                    animationFillMode: "backwards",
                  }}
                >
                  <span className="w-[clamp(28px,min(12vw,7dvh),56px)] shrink-0">
                    <ChoiceShape index={i} size={56} className="h-auto w-full" />
                  </span>
                  <span className="max-w-full">{choice}</span>
                </button>
              );
            })}
          </div>
        </main>
      );
    }

    case "REVEAL": {
      const correctText = state.correctIndex !== null ? state.question?.choices[state.correctIndex] : null;
      const mine = state.myAnswer;
      if (mine?.correct) {
        return (
          <Screen tone="green" header={<StatusBar state={state} />}>
            <span className="anim-pop">
              <CheckBadge color="#1D7A4C" />
            </span>
            <h1 className="anim-rise font-display text-phone-hero font-extrabold" style={{ animationDelay: "0.15s" }}>
              Correct!
            </h1>
            <p
              className="anim-pop rounded-full bg-white px-6 py-2.5 font-display text-[clamp(24px,8vw,34px)] font-extrabold text-success"
              style={{ animationDelay: "0.4s" }}
            >
              + {formatNumber(mine.points ?? 0)}
            </p>
            <p className="anim-rise text-phone-lg font-bold" style={{ animationDelay: "0.6s" }}>
              You&apos;re in {ordinal(me.rank)} place
            </p>
            <p className="font-semibold text-[#D5EFE1]">{upNext}</p>
          </Screen>
        );
      }
      return (
        <Screen tone={mine ? "red" : "ink"} header={<StatusBar state={state} />}>
          <span
            className="anim-shake flex aspect-square w-[clamp(72px,min(26vw,14dvh),112px)] items-center justify-center rounded-full bg-white"
            style={{ animationDelay: "0.1s" }}
            aria-hidden
          >
            <svg viewBox="0 0 24 24" className="w-1/2" fill="none" stroke={mine ? "#C8382B" : "#1E1B3A"} strokeWidth="3" strokeLinecap="round">
              <path d="M6 6 L18 18 M18 6 L6 18" />
            </svg>
          </span>
          <h1 className="anim-rise font-display text-phone-hero font-extrabold" style={{ animationDelay: "0.15s" }}>
            {mine ? "Not quite" : "No answer"}
          </h1>
          {correctText ? (
            <p className="text-phone-lg font-bold wrap-break-word">
              The answer was <span className="rounded-lg bg-white/20 px-2 py-0.5">{correctText}</span>
            </p>
          ) : null}
          <p className="text-phone-lg font-bold">You&apos;re in {ordinal(me.rank)} place</p>
          <p className="font-semibold text-white/80">{upNext}</p>
        </Screen>
      );
    }

    case "LEADERBOARD":
      return (
        <Screen tone="brand" header={<StatusBar state={state} />}>
          <p className="anim-rise text-phone-lg font-bold text-[#E4DDFB]">You&apos;re in</p>
          <h1 className="anim-pop font-display text-phone-giant font-extrabold" style={{ animationDelay: "0.2s" }}>
            {ordinal(me.rank)}
          </h1>
          <p className="text-phone-lg font-bold">
            of {me.playerCount} · {formatNumber(me.score)} points
          </p>
          <p className="font-semibold text-[#E4DDFB]">Get ready for the next question</p>
        </Screen>
      );

    case "ENDED":
      return (
        <Screen tone="brand">
          <p className="anim-rise text-phone-lg font-bold text-[#E4DDFB]">Game over · you finished</p>
          <h1 className="anim-pop font-display text-phone-giant font-extrabold" style={{ animationDelay: "0.3s" }}>
            {ordinal(me.rank)}
          </h1>
          <p className="anim-rise text-phone-lg font-bold" style={{ animationDelay: "0.6s" }}>
            {formatNumber(me.score)} points
          </p>
          {state.podium.length ? (
            <ol className="flex w-full max-w-xs flex-col gap-2 text-left">
              {state.podium.map((p, i) => (
                <li
                  key={p.nickname}
                  className={`anim-rise flex items-center gap-3 rounded-2xl px-4 py-2.5 ${
                    p.nickname === me.nickname ? "bg-[#E8A317] text-ink" : "bg-white text-ink"
                  }`}
                  // 7th first, the winner last, as on the big screen.
                  style={{ animationDelay: `${1 + (state.podium.length - 1 - i) * 0.5}s` }}
                >
                  <span className="w-6 shrink-0 font-display text-xl font-extrabold text-brand">{p.rank}</span>
                  <span className="min-w-0 flex-1 truncate font-bold">{p.nickname}</span>
                  <span className="shrink-0 font-display font-extrabold">{formatNumber(p.score)}</span>
                </li>
              ))}
            </ol>
          ) : null}
          <div className="anim-rise" style={{ animationDelay: `${1.6 + state.podium.length * 0.5}s` }}>
            <JoinAnother onClick={leave} />
          </div>
        </Screen>
      );
  }
}

// ── pieces ──────────────────────────────────────────────────────────────────

const TONES = {
  brand: "bg-brand text-white",
  ink: "bg-ink text-white",
  green: "bg-[#1D7A4C] text-white",
  red: "bg-[#C8382B] text-white",
} as const;

function Screen({ tone, header, children }: { tone: keyof typeof TONES; header?: ReactNode; children: ReactNode }) {
  return (
    <main className={`safe-screen flex min-h-dvh flex-col ${TONES[tone]}`}>
      {header}
      <div className="flex flex-1 flex-col items-center justify-center gap-[clamp(10px,3dvh,24px)] py-4 text-center">
        {children}
      </div>
    </main>
  );
}

function StatusBar({ state }: { state: PlayerState }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[15px] font-bold opacity-90">
      <span className="shrink-0">
        Q{state.index + 1} of {state.total}
      </span>
      <span className="truncate">
        {state.me.nickname} · {formatNumber(state.me.score)}
      </span>
    </div>
  );
}

function CheckBadge({ color }: { color: string }) {
  return (
    <span
      className="flex aspect-square w-[clamp(72px,min(26vw,14dvh),112px)] items-center justify-center rounded-full bg-white"
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="w-[55%]" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5 L10 17.5 L19 7" />
      </svg>
    </span>
  );
}

function JoinAnother({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="btn mt-2 h-12 bg-white px-6 text-ink hover:bg-ivory">
      Join another game
    </button>
  );
}
