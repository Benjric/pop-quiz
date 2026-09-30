import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTeacherId } from "@/lib/session";
import { rankPlayers } from "@/lib/game/score";
import { LocalTime } from "@/components/LocalTime";
import { ChoiceBadge } from "@/components/choices";
import { formatNumber, percent, plural } from "@/lib/format";

export const metadata = { title: "Game report" };

export default async function ReportPage(props: PageProps<"/dashboard/games/[gameId]">) {
  const teacherId = await requireTeacherId();
  const { gameId } = await props.params;

  const game = await prisma.game.findFirst({
    where: { id: gameId, quiz: { teacherId } },
    include: {
      quiz: { select: { id: true, title: true } },
      players: { where: { kickedAt: null }, include: { answers: true } },
      questions: { orderBy: { order: "asc" }, include: { answers: { where: { player: { kickedAt: null } } } } },
    },
  });
  if (!game) notFound();

  const players = rankPlayers(game.players);
  const total = game.questions.length;
  const allAnswers = game.questions.flatMap((q) => q.answers);
  const correctAnswers = allAnswers.filter((a) => a.correct).length;
  const averageScore = players.length ? Math.round(players.reduce((s, p) => s + p.score, 0) / players.length) : 0;

  const questions = game.questions.map((q) => {
    const counts = q.choices.map((_, i) => q.answers.filter((a) => a.choiceIndex === i).length);
    const correct = q.answers.filter((a) => a.correct).length;
    return { ...q, counts, correct, pct: percent(correct, players.length) };
  });
  const mostMissed = questions
    .filter((q) => players.length > 0 && q.pct < 100)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/dashboard/quizzes/${game.quiz.id}`} className="text-sm font-bold text-brand hover:underline">
            ← {game.quiz.title}
          </Link>
          <h1 className="mt-1 font-display text-3xl font-extrabold">Game report</h1>
          <p className="text-muted">
            <LocalTime iso={game.createdAt.toISOString()} /> · {plural(total, "question")} · {game.timeLimitSec} s each
          </p>
        </div>
        <a href={`/api/games/${game.id}/report`} className="btn btn-primary" download>
          <Download size={18} /> Download CSV
        </a>
      </div>

      {game.status !== "ENDED" ? (
        <p className="rounded-2xl bg-warn-soft px-4 py-3 font-semibold text-warn">
          This game is still running.{" "}
          <Link href={`/dashboard/games/${game.id}/monitor`} className="underline">
            Open the monitor
          </Link>
        </p>
      ) : null}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Summary">
        <Stat label="Players" value={formatNumber(players.length)} />
        <Stat label="Average score" value={formatNumber(averageScore)} />
        <Stat label="Answers correct" value={allAnswers.length ? `${percent(correctAnswers, allAnswers.length)}%` : "—"} />
        <Stat label="Top score" value={players[0] ? formatNumber(players[0].score) : "—"} />
      </section>

      {mostMissed.length ? (
        <section className="card flex flex-col gap-3 p-5">
          <h2 className="font-display text-lg font-extrabold">Most missed</h2>
          <ul className="flex flex-col gap-2">
            {mostMissed.map((q) => (
              <li key={q.id} className="flex items-start gap-3">
                <span className="w-12 shrink-0 font-display font-extrabold text-danger">{q.pct}%</span>
                <span>
                  <span className="font-bold text-muted">Q{q.order + 1}.</span> {q.text}{" "}
                  <span className="text-sm text-muted">(answer: {q.choices[q.correctIndex]})</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-extrabold">Students</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-[15px]">
            <thead className="border-b-2 border-line text-sm text-muted">
              <tr>
                <th className="px-5 py-3 font-bold">Rank</th>
                <th className="px-5 py-3 font-bold">Student</th>
                <th className="px-5 py-3 font-bold">Correct</th>
                <th className="px-5 py-3 font-bold">Accuracy</th>
                <th className="px-5 py-3 font-bold">Avg. time</th>
                <th className="px-5 py-3 text-right font-bold">Score</th>
              </tr>
            </thead>
            <tbody>
              {players.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-muted">
                    Nobody played this game.
                  </td>
                </tr>
              ) : (
                players.map((p) => {
                  const correct = p.answers.filter((a) => a.correct).length;
                  const avgMs = p.answers.length ? p.answers.reduce((s, a) => s + a.responseMs, 0) / p.answers.length : 0;
                  return (
                    <tr key={p.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-2.5 font-bold text-muted">{p.rank}</td>
                      <td className="px-5 py-2.5 font-bold">{p.nickname}</td>
                      <td className="px-5 py-2.5">
                        {correct} / {total}
                      </td>
                      <td className="px-5 py-2.5">{percent(correct, total)}%</td>
                      <td className="px-5 py-2.5 text-muted">{p.answers.length ? `${(avgMs / 1000).toFixed(1)} s` : "—"}</td>
                      <td className="px-5 py-2.5 text-right font-display font-extrabold">{formatNumber(p.score)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-extrabold">Questions</h2>
        <ol className="flex flex-col gap-3">
          {questions.map((q) => (
            <li key={q.id} className="card flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-4">
                <p className="font-semibold">
                  <span className="font-bold text-muted">Q{q.order + 1}.</span> {q.text}
                </p>
                <span
                  className={`pill shrink-0 ${q.pct >= 70 ? "bg-success-soft text-success" : q.pct >= 40 ? "bg-warn-soft text-warn" : "bg-danger-soft text-danger"}`}
                >
                  {q.pct}% right
                </span>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {q.choices.map((choice, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <ChoiceBadge index={i} />
                    <span className={`flex-1 ${i === q.correctIndex ? "font-bold" : ""}`}>
                      {choice}
                      {i === q.correctIndex ? <span className="ml-1 text-success">✓</span> : null}
                    </span>
                    <span className="font-bold text-muted">{q.counts[i]}</span>
                  </li>
                ))}
              </ul>
              {players.length - q.answers.length > 0 ? (
                <p className="text-sm text-muted">{plural(players.length - q.answers.length, "student")} didn&apos;t answer</p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card flex flex-col gap-1 p-5">
      <span className="text-sm font-bold text-muted">{label}</span>
      <span className="font-display text-3xl font-extrabold">{value}</span>
    </div>
  );
}
