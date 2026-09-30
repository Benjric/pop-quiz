import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTeacherId } from "@/lib/session";
import { LocalTime } from "@/components/LocalTime";
import { QuizEditor } from "../QuizEditor";
import { DeleteQuizButton } from "./DeleteQuizButton";

export const metadata = { title: "Edit quiz" };

export default async function QuizPage(props: PageProps<"/dashboard/quizzes/[id]">) {
  const teacherId = await requireTeacherId();
  const { id } = await props.params;

  const quiz = await prisma.quiz.findFirst({
    where: { id, teacherId },
    include: {
      questions: { orderBy: { order: "asc" } },
      games: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { _count: { select: { players: { where: { kickedAt: null } }, questions: true } } },
      },
    },
  });
  if (!quiz) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/quizzes" className="text-sm font-bold text-brand hover:underline">
            ← All quizzes
          </Link>
          <h1 className="mt-1 font-display text-3xl font-extrabold">{quiz.title}</h1>
          {quiz.sourceFileName ? <p className="text-sm text-muted">From {quiz.sourceFileName}</p> : null}
        </div>
        <div className="flex gap-2">
          <DeleteQuizButton id={quiz.id} title={quiz.title} />
          <Link href={`/dashboard/quizzes/${quiz.id}/host`} className="btn btn-primary">
            Host a game
          </Link>
        </div>
      </div>

      {quiz.games.length ? (
        <section className="card p-5">
          <h2 className="font-display text-lg font-extrabold">Games played</h2>
          <ul className="mt-3 flex flex-col divide-y divide-line">
            {quiz.games.map((game) => (
              <li key={game.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[15px]">
                <span>
                  <LocalTime iso={game.createdAt.toISOString()} /> · {game._count.players} players ·{" "}
                  {game._count.questions} questions
                </span>
                <Link
                  href={game.status === "ENDED" ? `/dashboard/games/${game.id}` : `/dashboard/games/${game.id}/monitor`}
                  className="font-bold text-brand hover:underline"
                >
                  {game.status === "ENDED" ? "View report" : "Open monitor"}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <QuizEditor
        id={quiz.id}
        initialTitle={quiz.title}
        sourceFileName={quiz.sourceFileName}
        initialQuestions={quiz.questions.map((q) => ({
          text: q.text,
          choices: q.choices,
          correctIndex: q.correctIndex,
          type: q.type,
        }))}
      />
    </div>
  );
}
