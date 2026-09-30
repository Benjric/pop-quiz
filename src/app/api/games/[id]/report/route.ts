import { prisma } from "@/lib/prisma";
import { rankPlayers } from "@/lib/game/score";
import { getTeacherId } from "@/lib/session";
import { unauthorized } from "@/lib/api";

/** CSV of every student's result: one row per student, one column per question. */
export async function GET(_request: Request, ctx: RouteContext<"/api/games/[id]/report">) {
  const teacherId = await getTeacherId();
  if (!teacherId) return unauthorized();
  const { id } = await ctx.params;

  const game = await prisma.game.findFirst({
    where: { id, quiz: { teacherId } },
    include: {
      quiz: { select: { title: true } },
      players: { include: { answers: true } },
      questions: { orderBy: { order: "asc" } },
    },
  });
  if (!game) return new Response("Not found", { status: 404 });

  const ranked = rankPlayers(game.players.filter((p) => !p.kickedAt));
  const header = [
    "Rank",
    "Student",
    "Score",
    "Correct",
    "Answered",
    ...game.questions.map((q) => `Q${q.order + 1}`),
  ];
  const rows = ranked.map((p) => {
    const byQuestion = new Map(p.answers.map((a) => [a.gameQuestionId, a]));
    return [
      p.rank,
      p.nickname,
      p.score,
      p.answers.filter((a) => a.correct).length,
      p.answers.length,
      ...game.questions.map((q) => {
        const a = byQuestion.get(q.id);
        if (!a) return "no answer";
        return `${a.correct ? "correct" : "wrong"} (${q.choices[a.choiceIndex] ?? "?"})`;
      }),
    ];
  });

  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const date = game.createdAt.toISOString().slice(0, 10);
  const name = `${game.quiz.title} ${date}`.replace(/[^\w\- ]+/g, "").trim() || "results";
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.csv"`,
    },
  });
}

function csvCell(value: unknown): string {
  let s = String(value ?? "");
  // Stop spreadsheet apps treating a nickname like "=cmd" as a formula.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
