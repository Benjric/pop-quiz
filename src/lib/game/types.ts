export type GameStatus = "LOBBY" | "QUESTION" | "REVEAL" | "LEADERBOARD" | "ENDED";

export type PodiumEntry = { nickname: string; score: number; rank: number };

export type HostPlayer = {
  id: string;
  nickname: string;
  score: number;
  rank: number;
  streak: number;
  kicked: boolean;
  /** Answer to the current question: null = not answered yet. */
  current: { choiceIndex: number; correct: boolean; points: number } | null;
  correctCount: number;
  answeredCount: number;
};

export type HostState = {
  game: {
    id: string;
    pin: string;
    status: GameStatus;
    quizId: string;
    quizTitle: string;
    currentIndex: number;
    totalQuestions: number;
    timeLimitSec: number;
    /** Epoch ms when the current question closes. */
    deadline: number | null;
    serverNow: number;
    createdAt: string;
  };
  question: { index: number; text: string; choices: string[]; correctIndex: number } | null;
  players: HostPlayer[];
  activeCount: number;
  answeredCount: number;
  distribution: number[];
  leaderboard: PodiumEntry[];
  questions: { index: number; text: string; answered: number; correct: number }[];
};

export type PlayerState = {
  gameId: string;
  status: GameStatus;
  quizTitle: string;
  index: number;
  total: number;
  deadline: number | null;
  serverNow: number;
  question: { text: string; choices: string[] } | null;
  /** Only sent once the answer has been revealed. */
  correctIndex: number | null;
  me: { nickname: string; score: number; rank: number; playerCount: number; kicked: boolean };
  myAnswer: { choiceIndex: number; correct: boolean | null; points: number | null } | null;
  podium: PodiumEntry[];
};
