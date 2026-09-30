import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireTeacherId } from "@/lib/session";
import { LocalTime } from "@/components/LocalTime";
import { formatNumber, formatPin, percent, plural } from "@/lib/format";

export const metadata = { title: "Dashboard" };

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS);

const STATUS_LABEL = {
  LOBBY: "Waiting for players",
  QUESTION: "Question open",
  REVEAL: "Showing answer",
  LEADERBOARD: "Leaderboard",
  ENDED: "Ended",
} as const;

export default async function DashboardPage() {
  const teacherId = await requireTeacherId();
  const mine = { quiz: { teacherId } };

  const [liveGames, quizzes, recentGames, quizCount, gamesPlayed, studentCount, answerCount, correctCount] =
    await Promise.all([
      prisma.game.findMany({
        where: { ...mine, status: { not: "ENDED" }, createdAt: { gt: daysAgo(1) } },
        orderBy: { createdAt: "desc" },
        include: {
          quiz: { select: { title: true } },
          _count: { select: { players: { where: { kickedAt: null } }, questions: true } },
        },
      }),
      prisma.quiz.findMany({
        where: { teacherId },
        orderBy: { updatedAt: "desc" },
        take: 6,
        include: {
          questions: { select: { correctIndex: true } },
          games: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
        },
      }),
      prisma.game.findMany({
        where: { ...mine, status: "ENDED" },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          quiz: { select: { title: true } },
          _count: { select: { players: { where: { kickedAt: null } }, questions: true } },
        },
      }),
      prisma.quiz.count({ where: { teacherId } }),
      prisma.game.count({ where: { ...mine, status: "ENDED" } }),
      prisma.player.count({ where: { game: mine, kickedAt: null } }),
      prisma.answer.count({ where: { player: { game: mine, kickedAt: null } } }),
      prisma.answer.count({ where: { player: { game: mine, kickedAt: null }, correct: true } }),
    ]);

  return (
    <div className="flex flex-col gap-10">
      {liveGames.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="live-heading">
          <h2 id="live-heading" className="sr-only">
            Live games
          </h2>
          {liveGames.map((game) => (
            <div
              key={game.id}
              className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-3xl bg-brand p-6 text-white"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="pill self-start bg-white/15">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#7CF0B0]" aria-hidden />
                  Live · {STATUS_LABEL[game.status]}
                </span>
                <p className="truncate font-display text-2xl font-extrabold">{game.quiz.title}</p>
                <p className="text-sm font-semibold text-[#E4DDFB]">
                  PIN {formatPin(game.pin)} · {plural(game._count.players, "player")} ·{" "}
                  {game.status === "LOBBY"
                    ? `${game._count.questions} questions`
                    : `question ${game.currentIndex + 1} of ${game._count.questions}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/host/${game.id}`} target="_blank" className="btn bg-white/15 text-white hover:bg-white/25">
                  Projector screen
                </Link>
                <Link href={`/dashboard/games/${game.id}/monitor`} className="btn bg-white text-brand hover:bg-ivory">
                  Open monitor
                </Link>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Totals">
        <Stat label="Quizzes" value={formatNumber(quizCount)} />
        <Stat label="Games played" value={formatNumber(gamesPlayed)} />
        <Stat label="Student entries" value={formatNumber(studentCount)} />
        <Stat label="Answers correct" value={answerCount ? `${percent(correctCount, answerCount)}%` : "—"} />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-2xl font-extrabold">My quizzes</h2>
          {quizCount > quizzes.length ? (
            <Link href="/dashboard/quizzes" className="text-sm font-bold text-brand hover:underline">
              See all {quizCount}
            </Link>
          ) : null}
        </div>
        {quizzes.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 p-10 text-center">
            <p className="font-display text-xl font-extrabold">No quizzes yet</p>
            <p className="max-w-md text-muted">
              Upload a worksheet or test (PDF, Word, Excel, CSV or text) and the questions are pulled out for you.
            </p>
            <Link href="/dashboard/quizzes/new" className="btn btn-primary mt-2">
              Upload a quiz
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {quizzes.map((quiz) => {
              const missing = quiz.questions.filter((q) => q.correctIndex === null).length;
              const lastPlayed = quiz.games[0]?.createdAt;
              return (
                <li key={quiz.id} className="card flex items-center gap-4 p-5">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Link href={`/dashboard/quizzes/${quiz.id}`} className="truncate font-display text-lg font-extrabold hover:text-brand">
                      {quiz.title}
                    </Link>
                    <p className="text-sm text-muted">
                      {plural(quiz.questions.length, "question")}
                      {quiz.sourceFileName ? ` · ${quiz.sourceFileName}` : ""}
                    </p>
                    <p className="text-sm text-muted">
                      {lastPlayed ? (
                        <>
                          Last played <LocalTime iso={lastPlayed.toISOString()} withTime={false} />
                        </>
                      ) : (
                        "Not played yet"
                      )}
                      {missing ? <span className="font-bold text-warn"> · {missing} need an answer</span> : null}
                    </p>
                  </div>
                  <Link href={`/dashboard/quizzes/${quiz.id}/host`} className="btn btn-primary btn-sm">
                    Host
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-2xl font-extrabold">Recent games</h2>
        {recentGames.length === 0 ? (
          <p className="text-muted">Finished games and their results show up here.</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-[15px]">
              <thead className="border-b-2 border-line text-sm text-muted">
                <tr>
                  <th className="px-5 py-3 font-bold">Quiz</th>
                  <th className="px-5 py-3 font-bold">Played</th>
                  <th className="px-5 py-3 font-bold">Players</th>
                  <th className="px-5 py-3 font-bold">Questions</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {recentGames.map((game) => (
                  <tr key={game.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 font-bold">{game.quiz.title}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-muted">
                      <LocalTime iso={game.createdAt.toISOString()} />
                    </td>
                    <td className="px-5 py-3">{game._count.players}</td>
                    <td className="px-5 py-3">{game._count.questions}</td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/dashboard/games/${game.id}`} className="font-bold whitespace-nowrap text-brand hover:underline">
                        View report
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
