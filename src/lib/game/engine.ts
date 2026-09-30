import { Prisma, type Player } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { publishGame, publishHost } from "@/lib/realtime";
import { pickQuestions, shuffleChoices, type PickMode } from "./pickQuestions";
import { GRACE_MS, rankPlayers, scoreAnswer } from "./score";
import { autoTimeLimit } from "./timing";
import type { GameStatus, HostState, PlayerState } from "./types";

/**
 * The game state machine. Every move is a conditional update on the state
 * the caller saw ("move from REVEAL of question 3"), so two screens pressing
 * Next at once — or a double click — can never skip a question.
 *
 *   LOBBY → QUESTION(0) → REVEAL(0) → LEADERBOARD(0) → QUESTION(1) → …
 *         … → REVEAL(last) → ENDED (final podium)
 *
 * With auto-advance on, REVEAL goes straight to the next QUESTION (or to
 * ENDED) AUTO_ADVANCE_MS after the answer was shown, with no leaderboard
 * in between. The teacher can pause that countdown or skip ahead.
 */

export class GameError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** Games are only joinable for a day; older unfinished games are ignored. */
const GAME_LIFETIME_MS = 24 * 60 * 60 * 1000;

/** With auto-advance, how long the answer stays up before the game moves on. */
export const AUTO_ADVANCE_MS = 10_000;

// ── creating ────────────────────────────────────────────────────────────────

export type GameSettings = {
  count: number;
  mode: PickMode;
  excludedIds: string[];
  /** Seconds per question; ignored when `autoTime` is on. */
  timeLimitSec: number;
  /** 15 s for short questions, 25 s for long ones (see ./timing). */
  autoTime: boolean;
  shuffleChoices: boolean;
  autoAdvance: boolean;
};

export async function createGame(teacherId: string, quizId: string, settings: GameSettings) {
  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, teacherId },
    include: { questions: true },
  });
  if (!quiz) throw new GameError("Quiz not found.", 404);

  const picked = pickQuestions(quiz.questions, settings);
  if (picked.length === 0) {
    throw new GameError("Pick at least one question that has a correct answer.");
  }

  const timeOf = (q: { text: string; choices: string[] }) =>
    settings.autoTime ? autoTimeLimit(q) : settings.timeLimitSec;

  const pin = await freePin();
  return prisma.game.create({
    data: {
      quizId,
      pin,
      timeLimitSec: timeOf(picked[0]),
      shuffleChoices: settings.shuffleChoices,
      autoAdvance: settings.autoAdvance,
      questions: {
        create: picked.map((q, order) => {
          const base = { choices: q.choices, correctIndex: q.correctIndex! };
          const final =
            settings.shuffleChoices && q.type === "MULTIPLE_CHOICE"
              ? shuffleChoices(base.choices, base.correctIndex)
              : base;
          return { order, text: q.text, timeLimitSec: timeOf(q), ...final };
        }),
      },
    },
  });
}

/** Seconds allowed for the question at `order`, to copy onto the game when it starts. */
async function timeLimitOf(gameId: string, order: number): Promise<number | undefined> {
  const q = await prisma.gameQuestion.findUnique({
    where: { gameId_order: { gameId, order } },
    select: { timeLimitSec: true },
  });
  return q?.timeLimitSec;
}

async function freePin(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    const clash = await prisma.game.findFirst({
      where: { pin, status: { not: "ENDED" }, createdAt: { gt: new Date(Date.now() - GAME_LIFETIME_MS) } },
      select: { id: true },
    });
    if (!clash) return pin;
  }
  throw new GameError("Couldn't find a free game PIN. Try again.", 503);
}

export async function findJoinableGame(pin: string) {
  return prisma.game.findFirst({
    where: {
      pin,
      status: { not: "ENDED" },
      createdAt: { gt: new Date(Date.now() - GAME_LIFETIME_MS) },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function assertTeacherOwnsGame(gameId: string, teacherId: string) {
  const game = await prisma.game.findFirst({
    where: { id: gameId, quiz: { teacherId } },
    select: { id: true },
  });
  if (!game) throw new GameError("Game not found.", 404);
}

// ── moving through the game ─────────────────────────────────────────────────

export type Expected = { status: GameStatus; index: number };

export async function advance(gameId: string, from: Expected) {
  switch (from.status) {
    case "LOBBY":
      return start(gameId);
    case "QUESTION":
      return reveal(gameId, from.index); // "Skip": close the question now
    case "REVEAL":
      return advanceFromReveal(gameId, from.index, { onlyIfScheduled: false });
    case "LEADERBOARD": {
      const timeLimitSec = await timeLimitOf(gameId, from.index + 1);
      const moved = await prisma.game.updateMany({
        where: { id: gameId, status: "LEADERBOARD", currentIndex: from.index },
        data: { status: "QUESTION", currentIndex: from.index + 1, questionStartedAt: new Date(), timeLimitSec },
      });
      if (moved.count) await publishGame(gameId);
      return;
    }
    case "ENDED":
      return;
  }
}

async function start(gameId: string) {
  const timeLimitSec = await timeLimitOf(gameId, 0);
  if (timeLimitSec === undefined) throw new GameError("This game has no questions.");
  const moved = await prisma.game.updateMany({
    where: { id: gameId, status: "LOBBY" },
    data: { status: "QUESTION", currentIndex: 0, questionStartedAt: new Date(), timeLimitSec },
  });
  if (moved.count) await publishGame(gameId);
}

/**
 * Leaves the answer screen: to the next question (auto-advance), the
 * leaderboard (manual games), or the end after the last question.
 * `onlyIfScheduled` is for the timer: it does nothing while paused.
 */
async function advanceFromReveal(gameId: string, index: number, { onlyIfScheduled }: { onlyIfScheduled: boolean }) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { autoAdvance: true, _count: { select: { questions: true } } },
  });
  if (!game) return;
  const last = index >= game._count.questions - 1;
  const timeLimitSec = last || !game.autoAdvance ? undefined : await timeLimitOf(gameId, index + 1);
  const where = {
    id: gameId,
    status: "REVEAL" as const,
    currentIndex: index,
    ...(onlyIfScheduled ? { revealedAt: { not: null } } : {}),
  };
  const data: Prisma.GameUpdateManyMutationInput = last
    ? { status: "ENDED", endedAt: new Date(), revealedAt: null }
    : game.autoAdvance
      ? { status: "QUESTION", currentIndex: index + 1, questionStartedAt: new Date(), timeLimitSec, revealedAt: null }
      : { status: "LEADERBOARD", revealedAt: null };
  const moved = await prisma.game.updateMany({ where, data });
  if (moved.count) await publishGame(gameId);
}

/** Stops the auto-advance countdown on the current answer screen. */
export async function holdReveal(gameId: string, index: number) {
  const moved = await prisma.game.updateMany({
    where: { id: gameId, status: "REVEAL", currentIndex: index, revealedAt: { not: null } },
    data: { revealedAt: null },
  });
  if (moved.count) await publishGame(gameId);
}

export async function reveal(gameId: string, index: number) {
  const moved = await prisma.game.updateMany({
    where: { id: gameId, status: "QUESTION", currentIndex: index },
    data: { status: "REVEAL", revealedAt: new Date() },
  });
  if (!moved.count) return;

  // Players who didn't answer lose their streak.
  const question = await prisma.gameQuestion.findUnique({
    where: { gameId_order: { gameId, order: index } },
    select: { id: true },
  });
  if (question) {
    await prisma.player.updateMany({
      where: { gameId, kickedAt: null, answers: { none: { gameQuestionId: question.id } } },
      data: { streak: 0 },
    });
  }
  await publishGame(gameId);
}

export async function endGame(gameId: string) {
  const moved = await prisma.game.updateMany({
    where: { id: gameId, status: { not: "ENDED" } },
    data: { status: "ENDED", endedAt: new Date() },
  });
  if (moved.count) await publishGame(gameId);
}

export async function kickPlayer(gameId: string, playerId: string) {
  await prisma.player.updateMany({
    where: { id: playerId, gameId, kickedAt: null },
    data: { kickedAt: new Date() },
  });
  await publishGame(gameId, "players");
  await revealIfEveryoneAnswered(gameId);
}

/** Closes the question lazily once its time (plus grace) has run out. */
async function closeIfExpired(game: {
  id: string;
  status: string;
  currentIndex: number;
  questionStartedAt: Date | null;
  timeLimitSec: number;
}): Promise<boolean> {
  const deadline = deadlineOf(game);
  if (game.status === "QUESTION" && deadline !== null && Date.now() > deadline + GRACE_MS) {
    await reveal(game.id, game.currentIndex);
    return true;
  }
  return false;
}

/** Moves past the answer screen lazily once its countdown has run out. */
async function advanceIfDue(game: {
  id: string;
  status: string;
  currentIndex: number;
  autoAdvance: boolean;
  revealedAt: Date | null;
}): Promise<boolean> {
  const at = nextAtOf(game);
  if (at === null || Date.now() < at) return false;
  await advanceFromReveal(game.id, game.currentIndex, { onlyIfScheduled: true });
  return true;
}

function nextAtOf(game: { status: string; autoAdvance: boolean; revealedAt: Date | null }): number | null {
  return game.status === "REVEAL" && game.autoAdvance && game.revealedAt
    ? game.revealedAt.getTime() + AUTO_ADVANCE_MS
    : null;
}

/** Brings a game up to date before a screen reads it. */
async function catchUp(game: Parameters<typeof closeIfExpired>[0] & Parameters<typeof advanceIfDue>[0]) {
  return (await closeIfExpired(game)) || (await advanceIfDue(game));
}

async function revealIfEveryoneAnswered(gameId: string) {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game || game.status !== "QUESTION") return;
  const question = await prisma.gameQuestion.findUnique({
    where: { gameId_order: { gameId, order: game.currentIndex } },
    select: { id: true },
  });
  if (!question) return;
  const [active, answered] = await Promise.all([
    prisma.player.count({ where: { gameId, kickedAt: null } }),
    prisma.answer.count({ where: { gameQuestionId: question.id, player: { kickedAt: null } } }),
  ]);
  if (active > 0 && answered >= active) await reveal(gameId, game.currentIndex);
}

function deadlineOf(game: { questionStartedAt: Date | null; timeLimitSec: number }): number | null {
  return game.questionStartedAt ? game.questionStartedAt.getTime() + game.timeLimitSec * 1000 : null;
}

// ── answering ───────────────────────────────────────────────────────────────

export async function submitAnswer(
  player: { id: string; gameId: string; streak: number; kickedAt: Date | null },
  index: number,
  choiceIndex: number,
) {
  if (player.kickedAt) throw new GameError("You were removed from this game.", 403);

  const game = await prisma.game.findUnique({ where: { id: player.gameId } });
  if (!game || game.status !== "QUESTION" || game.currentIndex !== index || !game.questionStartedAt) {
    throw new GameError("This question is closed.", 409);
  }
  const question = await prisma.gameQuestion.findUnique({
    where: { gameId_order: { gameId: game.id, order: index } },
  });
  if (!question || choiceIndex < 0 || choiceIndex >= question.choices.length) {
    throw new GameError("That isn't one of the choices.");
  }

  const correct = choiceIndex === question.correctIndex;
  const result = scoreAnswer({
    correct,
    elapsedMs: Date.now() - game.questionStartedAt.getTime(),
    limitMs: game.timeLimitSec * 1000,
    previousStreak: player.streak,
  });
  if (!result.accepted) throw new GameError("Time's up!", 409);

  try {
    await prisma.$transaction([
      prisma.answer.create({
        data: {
          playerId: player.id,
          gameQuestionId: question.id,
          choiceIndex,
          correct,
          points: result.points,
          responseMs: result.responseMs,
        },
      }),
      prisma.player.update({
        where: { id: player.id },
        data: { score: { increment: result.points }, streak: result.streak },
      }),
    ]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new GameError("You already answered this question.", 409);
    }
    throw error;
  }

  await publishHost(game.id, "answers");
  await revealIfEveryoneAnswered(game.id);
}

// ── what each screen sees ───────────────────────────────────────────────────

async function loadFullGame(gameId: string) {
  return prisma.game.findUnique({
    where: { id: gameId },
    include: {
      quiz: { select: { id: true, title: true } },
      players: { orderBy: { joinedAt: "asc" } },
      questions: {
        orderBy: { order: "asc" },
        include: { answers: { select: { playerId: true, choiceIndex: true, correct: true, points: true } } },
      },
    },
  });
}

export async function getHostState(gameId: string): Promise<HostState | null> {
  let game = await loadFullGame(gameId);
  if (!game) return null;
  if (await catchUp(game)) game = (await loadFullGame(gameId))!;

  const current = game.status === "LOBBY" ? null : (game.questions[game.currentIndex] ?? null);
  const active = game.players.filter((p) => !p.kickedAt);
  const activeIds = new Set(active.map((p) => p.id));
  const ranked = rankPlayers(active);
  const rankOf = new Map(ranked.map((p) => [p.id, p.rank]));

  const players = game.players.map((p) => {
    const mine = game.questions.flatMap((q) => q.answers.filter((a) => a.playerId === p.id));
    const cur = current?.answers.find((a) => a.playerId === p.id) ?? null;
    return {
      id: p.id,
      nickname: p.nickname,
      score: p.score,
      rank: rankOf.get(p.id) ?? 0,
      streak: p.streak,
      kicked: Boolean(p.kickedAt),
      current: cur ? { choiceIndex: cur.choiceIndex, correct: cur.correct, points: cur.points } : null,
      correctCount: mine.filter((a) => a.correct).length,
      answeredCount: mine.length,
    };
  });

  return {
    game: {
      id: game.id,
      pin: game.pin,
      status: game.status,
      quizId: game.quiz.id,
      quizTitle: game.quiz.title,
      currentIndex: game.currentIndex,
      totalQuestions: game.questions.length,
      timeLimitSec: game.timeLimitSec,
      autoAdvance: game.autoAdvance,
      deadline: game.status === "QUESTION" ? deadlineOf(game) : null,
      nextAt: nextAtOf(game),
      serverNow: Date.now(),
      createdAt: game.createdAt.toISOString(),
    },
    question: current
      ? { index: current.order, text: current.text, choices: current.choices, correctIndex: current.correctIndex }
      : null,
    players,
    activeCount: active.length,
    answeredCount: current ? current.answers.filter((a) => activeIds.has(a.playerId)).length : 0,
    distribution: current
      ? current.choices.map(
          (_, i) => current.answers.filter((a) => a.choiceIndex === i && activeIds.has(a.playerId)).length,
        )
      : [],
    leaderboard: ranked.slice(0, 10).map((p) => ({ nickname: p.nickname, score: p.score, rank: p.rank })),
    questions: game.questions.map((q) => {
      const counted = q.answers.filter((a) => activeIds.has(a.playerId));
      return {
        index: q.order,
        text: q.text,
        answered: counted.length,
        correct: counted.filter((a) => a.correct).length,
      };
    }),
  };
}

/**
 * What one phone sees. Every phone asks for this every second or two, so it
 * only loads what that phone needs (the current question and its own
 * answer, plus two counts for its place), never the whole game.
 */
export async function getPlayerState(me: Player): Promise<PlayerState | null> {
  const loadGame = () =>
    prisma.game.findUnique({
      where: { id: me.gameId },
      include: { quiz: { select: { title: true } }, _count: { select: { questions: true } } },
    });
  let game = await loadGame();
  if (!game) return null;
  if (await catchUp(game)) game = (await loadGame())!;

  const status = game.status;
  const active = { gameId: game.id, kickedAt: null };
  const [current, playerCount, ahead, top] = await Promise.all([
    status === "LOBBY"
      ? null
      : prisma.gameQuestion.findUnique({
          where: { gameId_order: { gameId: game.id, order: game.currentIndex } },
          select: {
            text: true,
            choices: true,
            correctIndex: true,
            answers: { where: { playerId: me.id }, select: { choiceIndex: true, correct: true, points: true } },
          },
        }),
    prisma.player.count({ where: active }),
    // Players on the same score share a place, so my rank is 1 + everyone ahead.
    me.kickedAt ? null : prisma.player.count({ where: { ...active, score: { gt: me.score } } }),
    status === "ENDED"
      ? prisma.player.findMany({
          where: active,
          orderBy: [{ score: "desc" }, { nickname: "asc" }],
          take: 7,
          select: { nickname: true, score: true },
        })
      : [],
  ]);

  const revealed = status === "REVEAL" || status === "LEADERBOARD" || status === "ENDED";
  const showQuestion = status === "QUESTION" || status === "REVEAL";
  const answer = current?.answers[0] ?? null;

  return {
    gameId: game.id,
    status,
    quizTitle: game.quiz.title,
    index: game.currentIndex,
    total: game._count.questions,
    deadline: status === "QUESTION" ? deadlineOf(game) : null,
    nextAt: nextAtOf(game),
    serverNow: Date.now(),
    question: showQuestion && current ? { text: current.text, choices: current.choices } : null,
    correctIndex: revealed && current ? current.correctIndex : null,
    me: {
      nickname: me.nickname,
      score: me.score,
      rank: ahead === null ? 0 : ahead + 1,
      playerCount,
      kicked: Boolean(me.kickedAt),
    },
    myAnswer: answer
      ? {
          choiceIndex: answer.choiceIndex,
          correct: revealed ? answer.correct : null,
          points: revealed ? answer.points : null,
        }
      : null,
    podium: rankPlayers(top).map((p) => ({ nickname: p.nickname, score: p.score, rank: p.rank })),
  };
}
