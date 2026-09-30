import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireTeacherId } from "@/lib/session";
import { LocalTime } from "@/components/LocalTime";

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

      {quizzes.length === 0 ? (
        <div className="card p-10 text-center text-muted">No quizzes yet. Upload a file to make your first one.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-[15px]">
            <thead className="border-b-2 border-line text-sm text-muted">
              <tr>
                <th className="px-5 py-3 font-bold">Title</th>
                <th className="px-5 py-3 font-bold">Questions</th>
                <th className="px-5 py-3 font-bold">Games</th>
                <th className="px-5 py-3 font-bold">Updated</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {quizzes.map((quiz) => {
                const missing = quiz.questions.filter((q) => q.correctIndex === null).length;
                return (
                  <tr key={quiz.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/quizzes/${quiz.id}`} className="font-bold hover:text-brand">
                        {quiz.title}
                      </Link>
                      {quiz.sourceFileName ? <div className="text-sm text-muted">{quiz.sourceFileName}</div> : null}
                    </td>
                    <td className="px-5 py-3">
                      {quiz.questions.length}
                      {missing ? <div className="text-sm font-bold text-warn">{missing} need an answer</div> : null}
                    </td>
                    <td className="px-5 py-3">{quiz._count.games}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-muted">
                      <LocalTime iso={quiz.updatedAt.toISOString()} withTime={false} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <Link href={`/dashboard/quizzes/${quiz.id}`} className="btn btn-outline btn-sm">
                          Edit
                        </Link>
                        <Link href={`/dashboard/quizzes/${quiz.id}/host`} className="btn btn-primary btn-sm">
                          Host
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
