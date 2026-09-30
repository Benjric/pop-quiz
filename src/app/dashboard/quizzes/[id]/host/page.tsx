import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTeacherId } from "@/lib/session";
import { autoTimeLimit } from "@/lib/game/timing";
import { HostSetup } from "./HostSetup";

export const metadata = { title: "Host a game" };

export default async function HostSetupPage(props: PageProps<"/dashboard/quizzes/[id]/host">) {
  const teacherId = await requireTeacherId();
  const { id } = await props.params;

  const quiz = await prisma.quiz.findFirst({
    where: { id, teacherId },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!quiz) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/dashboard/quizzes/${quiz.id}`} className="text-sm font-bold text-brand hover:underline">
          ← {quiz.title}
        </Link>
        <h1 className="mt-1 font-display text-3xl font-extrabold">Host a game</h1>
      </div>
      <HostSetup
        quizId={quiz.id}
        questions={quiz.questions.map((q) => ({
          id: q.id,
          text: q.text,
          hasAnswer: q.correctIndex !== null,
          autoSec: autoTimeLimit(q),
        }))}
      />
    </div>
  );
}
