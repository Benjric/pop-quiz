"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTeacherId } from "@/lib/session";
import { createGame, GameError } from "@/lib/game/engine";
import { LIMITS } from "@/lib/quizLimits";

const QuestionInput = z
  .object({
    text: z
      .string()
      .trim()
      .min(1, "Every question needs text.")
      .max(LIMITS.question, `A question is longer than ${LIMITS.question} characters. Shorten it.`),
    choices: z
      .array(
        z
          .string()
          .trim()
          .min(1, "Answer choices can't be empty.")
          .max(LIMITS.choice, `An answer choice is longer than ${LIMITS.choice} characters. Shorten it.`),
      )
      .min(LIMITS.minChoices, "Every question needs at least 2 choices.")
      .max(LIMITS.maxChoices, "A question can have at most 6 choices."),
    correctIndex: z.number().int().min(0).nullable(),
    type: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE"]),
  })
  .refine((q) => q.correctIndex === null || q.correctIndex < q.choices.length, "Pick a valid correct answer.");

const QuizInput = z.object({
  id: z.string().optional(),
  title: z
    .string()
    .trim()
    .min(1, "Give the quiz a title.")
    .max(LIMITS.title, `Keep the title to ${LIMITS.title} characters.`),
  sourceFileName: z.string().max(255).nullable().optional(),
  questions: z
    .array(QuestionInput)
    .min(1, "Keep at least one question.")
    .max(LIMITS.questions, `A quiz can have at most ${LIMITS.questions} questions.`),
});

export type QuizInput = z.input<typeof QuizInput>;
export type ActionResult = { error: string } | undefined;

/** Creates a quiz, or replaces an existing quiz's title and questions. */
export async function saveQuiz(input: QuizInput): Promise<ActionResult> {
  const teacherId = await requireTeacherId();
  const parsed = QuizInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the questions." };
  const { id, title, sourceFileName, questions } = parsed.data;

  const rows = questions.map((q, order) => ({ ...q, order }));
  let quizId = id;

  if (id) {
    const owned = await prisma.quiz.findFirst({ where: { id, teacherId }, select: { id: true } });
    if (!owned) return { error: "Quiz not found." };
    await prisma.$transaction([
      prisma.question.deleteMany({ where: { quizId: id } }),
      prisma.quiz.update({ where: { id }, data: { title, questions: { create: rows } } }),
    ]);
  } else {
    const quiz = await prisma.quiz.create({
      data: { teacherId, title, sourceFileName: sourceFileName ?? null, questions: { create: rows } },
    });
    quizId = quiz.id;
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/quizzes/${quizId}`);
}

export async function deleteQuiz(id: string): Promise<void> {
  const teacherId = await requireTeacherId();
  await prisma.quiz.deleteMany({ where: { id, teacherId } });
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/quizzes");
}

const GameInput = z.object({
  quizId: z.string().min(1),
  count: z.number().int().min(1).max(500),
  mode: z.enum(["random", "ordered"]),
  excludedIds: z.array(z.string()).max(500),
  timeLimitSec: z.number().int().min(5).max(240),
  autoTime: z.boolean(),
  shuffleChoices: z.boolean(),
  autoAdvance: z.boolean(),
});

export async function startGame(input: z.input<typeof GameInput>): Promise<ActionResult> {
  const teacherId = await requireTeacherId();
  const parsed = GameInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the game settings." };

  let gameId: string;
  try {
    const { quizId, ...settings } = parsed.data;
    gameId = (await createGame(teacherId, quizId, settings)).id;
  } catch (error) {
    if (error instanceof GameError) return { error: error.message };
    throw error;
  }
  revalidatePath("/dashboard", "layout");
  redirect(`/host/${gameId}`);
}
