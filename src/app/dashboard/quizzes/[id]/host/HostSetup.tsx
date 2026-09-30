"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Minus, Plus } from "lucide-react";
import { startGame } from "../../actions";
import { LONG_QUESTION_CHARS, LONG_QUESTION_SEC, SHORT_QUESTION_SEC } from "@/lib/game/timing";

/** `autoSec`: this question's time under "Auto" (15 s short, 25 s long). */
type Q = { id: string; text: string; hasAnswer: boolean; autoSec: number };

const PRESETS = [5, 10, 15] as const;
const TIMES = [10, 15, 20, 30, 60] as const;
/** Rough time per question spent on the answer (and leaderboard) screens. */
const OVERHEAD_SEC = { auto: 12, manual: 15 };

export function HostSetup({ quizId, questions }: { quizId: string; questions: Q[] }) {
  const [included, setIncluded] = useState(() => new Set(questions.filter((q) => q.hasAnswer).map((q) => q.id)));
  const available = included.size;
  const [wanted, setWanted] = useState(() => Math.min(10, available) || 1);
  const [mode, setMode] = useState<"random" | "ordered">("random");
  const [time, setTime] = useState<number | "auto">("auto");
  const [shuffleChoices, setShuffleChoices] = useState(true);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const count = Math.max(0, Math.min(wanted, available));
  const overhead = autoAdvance ? OVERHEAD_SEC.auto : OVERHEAD_SEC.manual;
  // With Auto, estimate from the questions that can be drawn (in order: the first ones).
  const pool = questions.filter((q) => included.has(q.id));
  const drawn = mode === "ordered" ? pool.slice(0, count) : pool;
  const perQuestion =
    time === "auto" ? drawn.reduce((sum, q) => sum + q.autoSec, 0) / Math.max(1, drawn.length) : time;
  const minutes = Math.max(1, Math.round((count * (perQuestion + overhead)) / 60));
  const longCount = pool.filter((q) => q.autoSec === LONG_QUESTION_SEC).length;
  const missing = questions.filter((q) => !q.hasAnswer).length;

  const toggle = (id: string) =>
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const create = () => {
    setError(null);
    startTransition(async () => {
      const result = await startGame({
        quizId,
        count,
        mode,
        excludedIds: questions.filter((q) => !included.has(q.id)).map((q) => q.id),
        timeLimitSec: time === "auto" ? SHORT_QUESTION_SEC : time,
        autoTime: time === "auto",
        shuffleChoices,
        autoAdvance,
      });
      if (result?.error) setError(result.error);
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="card flex flex-col p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-extrabold">
            Questions to draw from <span className="text-muted">({available} of {questions.length})</span>
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setIncluded(new Set(questions.filter((q) => q.hasAnswer).map((q) => q.id)))}
            >
              All
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setIncluded(new Set())}>
              None
            </button>
          </div>
        </div>
        {missing ? (
          <p className="mt-3 rounded-xl bg-warn-soft px-3 py-2 text-sm font-semibold text-warn">
            {missing} {missing === 1 ? "question has" : "questions have"} no correct answer and can&apos;t be used.{" "}
            <Link href={`/dashboard/quizzes/${quizId}`} className="underline">
              Edit the quiz
            </Link>{" "}
            to pick one.
          </p>
        ) : null}
        <ul className="mt-3 flex flex-col divide-y divide-line">
          {questions.map((q, i) => (
            <li key={q.id}>
              <label className={`flex items-start gap-3 py-2.5 ${q.hasAnswer ? "cursor-pointer" : "opacity-50"}`}>
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
                  checked={included.has(q.id)}
                  disabled={!q.hasAnswer}
                  onChange={() => toggle(q.id)}
                />
                <span className="w-7 shrink-0 font-bold text-muted">{i + 1}</span>
                <span className="flex-1">
                  {q.text}
                  {!q.hasAnswer ? <span className="ml-2 text-sm font-bold text-warn">needs an answer</span> : null}
                </span>
                {time === "auto" && q.hasAnswer ? (
                  <span
                    className={`pill shrink-0 ${q.autoSec === LONG_QUESTION_SEC ? "bg-brand-soft text-brand" : "bg-ivory text-muted"}`}
                  >
                    {q.autoSec} s
                  </span>
                ) : null}
              </label>
            </li>
          ))}
        </ul>
      </section>

      <aside className="flex flex-col gap-5 self-start lg:sticky lg:top-6">
        <div className="card flex flex-col gap-5 p-5">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 font-display text-lg font-extrabold">How many questions?</legend>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="One fewer"
                className="btn btn-outline h-12 w-12 p-0"
                disabled={count <= 1}
                onClick={() => setWanted(Math.max(1, count - 1))}
              >
                <Minus size={20} />
              </button>
              <input
                aria-label="Number of questions"
                inputMode="numeric"
                value={count}
                onChange={(e) => setWanted(Number(e.target.value.replace(/\D/g, "")) || 1)}
                className="field h-12 w-20 text-center font-display text-2xl font-extrabold"
              />
              <button
                type="button"
                aria-label="One more"
                className="btn btn-outline h-12 w-12 p-0"
                disabled={count >= available}
                onClick={() => setWanted(count + 1)}
              >
                <Plus size={20} />
              </button>
              <span className="text-sm text-muted">of {available}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((n) => (
                <Choice key={n} active={count === n} disabled={n > available} onClick={() => setWanted(n)}>
                  {n}
                </Choice>
              ))}
              <Choice active={count === available && available > 0} disabled={available === 0} onClick={() => setWanted(available)}>
                All
              </Choice>
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-display text-lg font-extrabold">Which ones?</legend>
            <Radio name="mode" checked={mode === "random"} onChange={() => setMode("random")}>
              A random mix <span className="text-muted">— different every game</span>
            </Radio>
            <Radio name="mode" checked={mode === "ordered"} onChange={() => setMode("ordered")}>
              The first {count} in order
            </Radio>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-display text-lg font-extrabold">Time per question</legend>
            <div className="flex flex-wrap gap-2">
              <Choice active={time === "auto"} onClick={() => setTime("auto")}>
                Auto
              </Choice>
              {TIMES.map((t) => (
                <Choice key={t} active={time === t} onClick={() => setTime(t)}>
                  {t} s
                </Choice>
              ))}
            </div>
            {time === "auto" ? (
              <p className="text-sm text-muted">
                Short questions get {SHORT_QUESTION_SEC} s, long ones {LONG_QUESTION_SEC} s (over{" "}
                {LONG_QUESTION_CHARS} characters, counting the choices). This quiz has {longCount} long and{" "}
                {pool.length - longCount} short.
              </p>
            ) : null}
          </fieldset>

          <label className="flex cursor-pointer items-center gap-3 font-semibold">
            <input
              type="checkbox"
              className="h-5 w-5 accent-brand"
              checked={shuffleChoices}
              onChange={(e) => setShuffleChoices(e.target.checked)}
            />
            Shuffle the answer order
          </label>

          <label className="flex cursor-pointer items-start gap-3 font-semibold">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
              checked={autoAdvance}
              onChange={(e) => setAutoAdvance(e.target.checked)}
            />
            <span>
              Go to the next question automatically
              <span className="block text-sm font-normal text-muted">
                10 seconds after the answer shows. You can pause it any time. Off: you press Next and a leaderboard
                shows between questions.
              </span>
            </span>
          </label>
        </div>

        <div className="card flex flex-col gap-3 p-5">
          <p className="text-muted">
            <span className="font-display text-2xl font-extrabold text-ink">{count}</span> questions · about{" "}
            <span className="font-bold text-ink">{minutes} min</span>
          </p>
          {error ? (
            <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">
              {error}
            </p>
          ) : null}
          <button type="button" className="btn btn-primary h-14 text-lg" disabled={pending || count === 0} onClick={create}>
            {pending ? "Creating…" : "Create game"}
          </button>
          <p className="text-sm text-muted">Opens the lobby with the PIN and QR code. Put it on the projector.</p>
        </div>
      </aside>
    </div>
  );
}

function Choice({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`btn btn-sm min-w-14 ${active ? "bg-brand text-white" : "btn-outline"}`}
    >
      {children}
    </button>
  );
}

function Radio({
  name,
  checked,
  onChange,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="h-5 w-5 accent-brand" />
      <span className="font-semibold">{children}</span>
    </label>
  );
}
