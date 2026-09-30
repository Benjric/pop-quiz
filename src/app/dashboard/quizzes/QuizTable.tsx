"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteQuizzes } from "./actions";
import { LocalTime } from "@/components/LocalTime";
import { plural } from "@/lib/format";
import { useConfirm } from "@/components/ConfirmDialog";

export type QuizRow = {
  id: string;
  title: string;
  sourceFileName: string | null;
  questions: number;
  missing: number;
  games: number;
  updatedAt: string;
};

/** The quiz list, with a delete button per row and bulk delete for ticked rows. */
export function QuizTable({ quizzes }: { quizzes: QuizRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [ask, dialog] = useConfirm();

  // Ignore ticks for quizzes that are gone (e.g. deleted in another tab).
  const ticked = quizzes.filter((q) => selected.has(q.id));
  const allTicked = quizzes.length > 0 && ticked.length === quizzes.length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const remove = async (rows: QuizRow[]) => {
    if (rows.length === 0) return;
    const games = rows.reduce((sum, q) => sum + q.games, 0);
    const one = rows.length === 1;
    const shown = rows.slice(0, 5);
    const ok = await ask({
      danger: true,
      title: one ? `Delete "${rows[0].title}"?` : `Delete ${rows.length} quizzes?`,
      confirmLabel: one ? "Delete quiz" : `Delete ${rows.length} quizzes`,
      body: (
        <div className="flex flex-col gap-3">
          {one ? null : (
            <ul className="flex flex-col gap-1 rounded-xl bg-ivory px-3 py-2 text-sm text-ink">
              {shown.map((q) => (
                <li key={q.id} className="truncate">
                  {q.title} <span className="text-muted">· {plural(q.questions, "question")}</span>
                </li>
              ))}
              {rows.length > shown.length ? <li className="text-muted">and {rows.length - shown.length} more</li> : null}
            </ul>
          )}
          <p>
            {games
              ? `${one ? "Its" : "Their"} ${plural(games, "past game")} and ${games === 1 ? "report" : "reports"} will be deleted too. `
              : ""}
            You can&apos;t undo this.
          </p>
        </div>
      ),
    });
    if (!ok) return;
    setMessage(null);
    startTransition(async () => {
      const { deleted } = await deleteQuizzes(rows.map((q) => q.id));
      setSelected((prev) => {
        const next = new Set(prev);
        for (const q of rows) next.delete(q.id);
        return next;
      });
      setMessage(`Deleted ${plural(deleted, "quiz", "quizzes")}.`);
    });
  };

  if (quizzes.length === 0) {
    return (
      <div className="card p-10 text-center text-muted">
        {message ? `${message} ` : ""}No quizzes yet. Upload a file to make your first one.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {dialog}
      <div className="flex min-h-11 flex-wrap items-center gap-3">
        {ticked.length ? (
          <>
            <span className="font-bold">{ticked.length} selected</span>
            <button type="button" className="btn btn-danger btn-sm" disabled={pending} onClick={() => void remove(ticked)}>
              <Trash2 size={16} /> {pending ? "Deleting…" : "Delete selected"}
            </button>
            <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </>
        ) : (
          <span className="text-sm text-muted">Tick quizzes to delete several at once.</span>
        )}
        {message ? (
          <span role="status" className="text-sm font-bold text-success">
            {message}
          </span>
        ) : null}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-[15px]">
          <thead className="border-b-2 border-line text-sm text-muted">
            <tr>
              <th className="w-12 py-3 pl-5">
                <input
                  type="checkbox"
                  aria-label="Select all quizzes"
                  className="h-5 w-5 cursor-pointer accent-brand"
                  checked={allTicked}
                  onChange={() => setSelected(allTicked ? new Set() : new Set(quizzes.map((q) => q.id)))}
                />
              </th>
              <th className="px-5 py-3 font-bold">Title</th>
              <th className="px-5 py-3 font-bold">Questions</th>
              <th className="px-5 py-3 font-bold">Games</th>
              <th className="px-5 py-3 font-bold">Updated</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {quizzes.map((quiz) => {
              const isTicked = selected.has(quiz.id);
              return (
                <tr key={quiz.id} className={`border-b border-line last:border-0 ${isTicked ? "bg-brand-soft/60" : ""}`}>
                  <td className="py-3 pl-5">
                    <input
                      type="checkbox"
                      aria-label={`Select ${quiz.title}`}
                      className="h-5 w-5 cursor-pointer accent-brand"
                      checked={isTicked}
                      onChange={() => toggle(quiz.id)}
                    />
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/dashboard/quizzes/${quiz.id}`} className="font-bold hover:text-brand">
                      {quiz.title}
                    </Link>
                    {quiz.sourceFileName ? <div className="text-sm text-muted">{quiz.sourceFileName}</div> : null}
                  </td>
                  <td className="px-5 py-3">
                    {quiz.questions}
                    {quiz.missing ? <div className="text-sm font-bold text-warn">{quiz.missing} need an answer</div> : null}
                  </td>
                  <td className="px-5 py-3">{quiz.games}</td>
                  <td className="px-5 py-3 whitespace-nowrap text-muted">
                    <LocalTime iso={quiz.updatedAt} withTime={false} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      <Link href={`/dashboard/quizzes/${quiz.id}`} className="btn btn-outline btn-sm">
                        Edit
                      </Link>
                      <Link href={`/dashboard/quizzes/${quiz.id}/host`} className="btn btn-primary btn-sm">
                        Host
                      </Link>
                      <button
                        type="button"
                        aria-label={`Delete ${quiz.title}`}
                        title="Delete"
                        disabled={pending}
                        onClick={() => void remove([quiz])}
                        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger disabled:opacity-40"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
