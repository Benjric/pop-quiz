import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireTeacherId } from "@/lib/session";
import { QuizTable } from "./QuizTable";

export const metadata = { title: "Quizzes" };

export default async function QuizzesPage() {
  const teacherId = await requireTeacherId();
  const quizzes = await prisma.quiz.findMany({
    where: { teacherId },
    orderBy: { updatedAt: "desc" },
    include: {
      questions: { select: { correctIndex: true } },
      _count: { select: { games: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold">Quizzes</h1>
        <Link href="/dashboard/quizzes/new" className="btn btn-primary">
          Upload a quiz
        </Link>
      </div>
      <QuizTable
        quizzes={quizzes.map((q) => ({
          id: q.id,
          title: q.title,
          sourceFileName: q.sourceFileName,
          questions: q.questions.length,
          missing: q.questions.filter((x) => x.correctIndex === null).length,
          games: q._count.games,
          updatedAt: q.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
