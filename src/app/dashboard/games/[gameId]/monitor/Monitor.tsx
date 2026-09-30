"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { nextLabel, useHostGame } from "@/lib/useHostGame";
import type { HostPlayer, HostState } from "@/lib/game/types";
import { ChoiceBadge } from "@/components/choices";
import { formatNumber, formatPin, percent } from "@/lib/format";

const STATUS_LABEL = {
  LOBBY: "Waiting for players",
  QUESTION: "Question open",
  REVEAL: "Showing the answer",
  LEADERBOARD: "Showing the leaderboard",
  ENDED: "Game over",
} as const;

/**
 * The teacher's laptop view while the projector shows the game: who has
 * answered, how the class is doing, and the controls. The projector screen
 * closes questions when the clock runs out, so this one doesn't have to.
 */
export function Monitor({ gameId }: { gameId: string }) {
  const { state, live, busy, error, secondsLeft, control, next } = useHostGame(gameId, { autoReveal: false });

  if (!state) return <p className="text-muted">Loading the game…</p>;

  const { game, question } = state;
  const action = nextLabel(state);
  const revealed = game.status !== "QUESTION";
  const players = state.players.slice().sort((a, b) => Number(a.kicked) - Number(b.kicked) || a.rank - b.rank);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-bold text-muted">
            <span
              className={`h-2 w-2 rounded-full ${live === "realtime" ? "bg-[#1D7A4C]" : "bg-[#E8A317]"}`}
              aria-hidden
            />
            {live === "realtime" ? "Live" : live === "polling" ? "Refreshing every few seconds" : "Connecting…"}
          </p>
          <h1 className="truncate font-display text-3xl font-extrabold">{game.quizTitle}</h1>
          <p className="font-semibold text-muted">
            PIN <span className="font-display font-extrabold text-brand">{formatPin(game.pin)}</span> ·{" "}
            {STATUS_LABEL[game.status]}
            {game.currentIndex >= 0 && game.status !== "ENDED"
              ? ` · question ${game.currentIndex + 1} of ${game.totalQuestions}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/host/${game.id}`} target="_blank" className="btn btn-outline">
            <ExternalLink size={18} /> Projector screen
          </Link>
          {game.status === "ENDED" ? (
            <Link href={`/dashboard/games/${game.id}`} className="btn btn-primary">
              View report
            </Link>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy}
                onClick={() => {
                  if (confirm("End the game now? Everyone sees the final results.")) void control({ action: "end" });
                }}
              >
                End game
              </button>
              {action ? (
                <button
                  type="button"
                  className="btn btn-primary px-6"
                  disabled={busy || (game.status === "LOBBY" && state.activeCount === 0)}
                  onClick={next}
                >
                  {action}
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 font-semibold text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="card overflow-x-auto">
          <table className="w-full text-left text-[15px]">
            <caption className="px-5 pt-4 text-left font-display text-lg font-extrabold">
              Players ({state.activeCount})
            </caption>
            <thead className="border-b-2 border-line text-sm text-muted">
              <tr>
                <th className="px-5 py-3 font-bold">#</th>
                <th className="px-5 py-3 font-bold">Name</th>
                <th className="px-5 py-3 font-bold">This question</th>
                <th className="px-5 py-3 font-bold">Correct</th>
                <th className="px-5 py-3 text-right font-bold">Score</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {players.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-muted">
                    Nobody has joined yet. Students go to the site on their phone and enter PIN {formatPin(game.pin)}.
                  </td>
                </tr>
              ) : (
                players.map((p) => (
                  <tr key={p.id} className={`border-b border-line last:border-0 ${p.kicked ? "text-muted" : ""}`}>
                    <td className="px-5 py-2.5 font-bold text-muted">{p.kicked ? "—" : p.rank}</td>
                    <td className="px-5 py-2.5 font-bold">{p.nickname}</td>
                    <td className="px-5 py-2.5">
                      <PlayerStatus player={p} state={state} revealed={revealed} />
                    </td>
                    <td className="px-5 py-2.5 whitespace-nowrap">
                      {p.correctCount} / {p.answeredCount}
                    </td>
                    <td className="px-5 py-2.5 text-right font-display font-extrabold">{formatNumber(p.score)}</td>
                    <td className="px-5 py-2.5 text-right">
                      {!p.kicked && game.status !== "ENDED" ? (
                        <button
                          type="button"
                          className="text-sm font-bold text-danger hover:underline"
                          onClick={() => {
                            if (confirm(`Remove ${p.nickname} from the game?`)) void control({ action: "kick", playerId: p.id });
                          }}
                        >
                          Remove
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <aside className="flex flex-col gap-6">
          {question && game.status !== "ENDED" ? (
            <section className="card flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-lg font-extrabold">Question {game.currentIndex + 1}</h2>
                {game.status === "QUESTION" && secondsLeft !== null ? (
                  <span className="flex h-11 min-w-11 items-center justify-center rounded-full bg-ink px-2 font-display text-lg font-extrabold text-white">
                    {secondsLeft}
                  </span>
                ) : null}
              </div>
              <p className="font-semibold">{question.text}</p>
              <p className="text-sm font-bold text-muted">
                {state.answeredCount} of {state.activeCount} answered
              </p>
              <ul className="flex flex-col gap-2">
                {question.choices.map((choice, i) => {
                  const count = state.distribution[i] ?? 0;
                  const isCorrect = i === question.correctIndex;
                  return (
                    <li key={i} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-sm">
                        <ChoiceBadge index={i} />
                        <span className={`flex-1 ${isCorrect ? "font-bold" : ""}`}>
                          {choice}
                          {isCorrect ? <span className="ml-1 text-success">✓</span> : null}
                        </span>
                        <span className="font-bold">{count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-ivory">
                        <div
                          className={`h-full rounded-full ${isCorrect ? "bg-[#1D7A4C]" : "bg-field"}`}
                          style={{ width: `${percent(count, Math.max(1, state.answeredCount))}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <QuestionProgress state={state} />
        </aside>
      </div>
    </div>
  );
}

function PlayerStatus({ player, state, revealed }: { player: HostPlayer; state: HostState; revealed: boolean }) {
  if (player.kicked) return <span className="text-sm font-bold">Removed</span>;
  if (state.game.status === "LOBBY") return <span className="text-sm text-muted">Waiting</span>;
  if (state.game.status === "ENDED") return <span className="text-sm text-muted">Finished</span>;
  const answer = player.current;
  if (!answer) {
    return revealed ? (
      <span className="text-sm font-bold text-muted">No answer</span>
    ) : (
      <span className="text-sm text-muted">Thinking…</span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-sm font-bold">
      <ChoiceBadge index={answer.choiceIndex} />
      {revealed ? (
        answer.correct ? (
          <span className="text-success">Correct +{formatNumber(answer.points)}</span>
        ) : (
          <span className="text-danger">Wrong</span>
        )
      ) : (
        <span>Answered</span>
      )}
    </span>
  );
}

function QuestionProgress({ state }: { state: HostState }) {
  const played = state.questions.filter((q) => q.index <= state.game.currentIndex);
  if (played.length === 0) return null;
  return (
    <section className="card flex flex-col gap-3 p-5">
      <h2 className="font-display text-lg font-extrabold">How the class is doing</h2>
      <ul className="flex flex-col gap-2 text-sm">
        {played.map((q) => {
          const pct = percent(q.correct, q.answered);
          return (
            <li key={q.index} className="flex items-center gap-3">
              <span className="w-8 shrink-0 font-bold text-muted">Q{q.index + 1}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-ivory">
                <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-24 shrink-0 text-right font-semibold">
                {q.answered ? `${pct}% right` : "no answers"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
