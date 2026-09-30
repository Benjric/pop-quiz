"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { saveQuiz } from "./actions";
import { ChoiceBadge } from "@/components/choices";
import type { SkippedItem } from "@/lib/extract/types";
import { plural } from "@/lib/format";

type QuestionType = "MULTIPLE_CHOICE" | "TRUE_FALSE";

export type EditableQuestion = {
  text: string;
  choices: string[];
  correctIndex: number | null;
  type: QuestionType;
};

type Row = EditableQuestion & { key: number };

const MAX_CHOICES = 6;
const TRUE_FALSE = ["True", "False"];

/**
 * Reviewing freshly extracted questions and editing a saved quiz are the
 * same job, so both use this editor. Saving replaces the quiz's questions.
 */
export function QuizEditor({
  id,
  initialTitle,
  sourceFileName,
  initialQuestions,
  skipped = [],
  onCancel,
}: {
  id?: string;
  initialTitle: string;
  sourceFileName?: string | null;
  initialQuestions: EditableQuestion[];
  skipped?: SkippedItem[];
  onCancel?: () => void;
}) {
  const nextKey = useRef(initialQuestions.length);
  const [title, setTitle] = useState(initialTitle);
  const [rows, setRows] = useState<Row[]>(() => initialQuestions.map((q, key) => ({ ...q, key })));
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [dirty, setDirty] = useState(!id);

  const missing = rows.filter((q) => q.correctIndex === null).length;

  const change = (updater: (rows: Row[]) => Row[]) => {
    setRows(updater);
    setDirty(true);
    setError(null);
  };
  const update = (key: number, patch: Partial<EditableQuestion>) =>
    change((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (index: number, by: number) =>
    change((rs) => {
      const to = index + by;
      if (to < 0 || to >= rs.length) return rs;
      const out = rs.slice();
      [out[index], out[to]] = [out[to], out[index]];
      return out;
    });
  const add = (type: QuestionType) =>
    change((rs) => [
      ...rs,
      {
        key: nextKey.current++,
        text: "",
        type,
        choices: type === "TRUE_FALSE" ? [...TRUE_FALSE] : ["", "", "", ""],
        correctIndex: null,
      },
    ]);

  const save = () => {
    const problem = findProblem(title, rows);
    if (problem) {
      setError(problem);
      return;
    }
    startSaving(async () => {
      const result = await saveQuiz({
        id,
        title,
        sourceFileName: sourceFileName ?? null,
        questions: rows.map(({ text, choices, correctIndex, type }) => ({
          text: text.trim(),
          choices: choices.map((c) => c.trim()),
          correctIndex,
          type,
        })),
      });
      if (result?.error) setError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-6 pb-28">
      <label className="flex flex-col gap-1.5 text-sm font-bold">
        Quiz title
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setDirty(true);
          }}
          maxLength={120}
          className="field h-12 font-display text-xl font-extrabold"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <span className="pill bg-brand-soft text-brand">{plural(rows.length, "question")}</span>
        {missing ? (
          <span className="pill bg-warn-soft text-warn">{missing} need a correct answer</span>
        ) : (
          <span className="pill bg-success-soft text-success">Every question has an answer</span>
        )}
        {skipped.length ? (
          <span className="pill bg-white text-muted ring-2 ring-line">{plural(skipped.length, "item")} skipped</span>
        ) : null}
      </div>

      {missing ? (
        <p className="rounded-2xl bg-warn-soft px-4 py-3 text-sm font-semibold text-warn">
          Questions without a correct answer are left out of games until you pick one. Click the right choice&apos;s
          circle to mark it.
        </p>
      ) : null}

      {skipped.length ? (
        <details className="card p-5">
          <summary className="cursor-pointer font-bold">
            {plural(skipped.length, "item")} from the file weren&apos;t turned into questions
          </summary>
          <ul className="mt-4 flex flex-col gap-3">
            {skipped.map((item, i) => (
              <li key={i} className="rounded-xl bg-ivory px-4 py-3 text-sm">
                <p className="font-semibold">&ldquo;{item.excerpt}&rdquo;</p>
                <p className="text-muted">{item.reason}</p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <ol className="flex flex-col gap-4">
        {rows.map((row, index) => (
          <li key={row.key} className={`card flex flex-col gap-4 p-5 ${row.correctIndex === null ? "border-[#EBC46A]" : ""}`}>
            <div className="flex items-start gap-3">
              <span className="mt-2.5 w-8 shrink-0 font-display text-lg font-extrabold text-brand">{index + 1}</span>
              <textarea
                aria-label={`Question ${index + 1}`}
                value={row.text}
                onChange={(e) => update(row.key, { text: e.target.value })}
                rows={2}
                maxLength={500}
                placeholder="Type the question"
                className="field h-auto min-h-11 flex-1 resize-y py-2 font-semibold"
              />
              <div className="flex shrink-0 gap-1">
                <IconButton label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                  <ArrowUp size={18} />
                </IconButton>
                <IconButton label="Move down" disabled={index === rows.length - 1} onClick={() => move(index, 1)}>
                  <ArrowDown size={18} />
                </IconButton>
                <IconButton
                  label={`Delete question ${index + 1}`}
                  danger
                  onClick={() => change((rs) => rs.filter((r) => r.key !== row.key))}
                >
                  <Trash2 size={18} />
                </IconButton>
              </div>
            </div>

            <fieldset className="flex flex-col gap-2 sm:pl-11">
              <legend className="sr-only">Choices for question {index + 1}; select the correct one</legend>
              {row.choices.map((choice, ci) => (
                <div key={ci} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${row.key}`}
                    aria-label={`Choice ${ci + 1} is correct`}
                    checked={row.correctIndex === ci}
                    onChange={() => update(row.key, { correctIndex: ci })}
                    className="h-5 w-5 shrink-0 cursor-pointer accent-[#1D7A4C]"
                  />
                  <ChoiceBadge index={ci} size={26} />
                  {row.type === "TRUE_FALSE" ? (
                    <span className="flex h-11 flex-1 items-center px-1 font-semibold">{choice}</span>
                  ) : (
                    <input
                      aria-label={`Choice ${ci + 1}`}
                      value={choice}
                      maxLength={200}
                      placeholder={`Choice ${ci + 1}`}
                      onChange={(e) =>
                        update(row.key, { choices: row.choices.map((c, j) => (j === ci ? e.target.value : c)) })
                      }
                      className={`field flex-1 ${row.correctIndex === ci ? "border-[#1D7A4C] bg-success-soft" : ""}`}
                    />
                  )}
                  {row.type === "MULTIPLE_CHOICE" && row.choices.length > 2 ? (
                    <IconButton
                      label={`Remove choice ${ci + 1}`}
                      onClick={() =>
                        update(row.key, {
                          choices: row.choices.filter((_, j) => j !== ci),
                          correctIndex:
                            row.correctIndex === null || row.correctIndex === ci
                              ? null
                              : row.correctIndex > ci
                                ? row.correctIndex - 1
                                : row.correctIndex,
                        })
                      }
                    >
                      <X size={18} />
                    </IconButton>
                  ) : null}
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {row.type === "MULTIPLE_CHOICE" && row.choices.length < MAX_CHOICES ? (
                  <button
                    type="button"
                    onClick={() => update(row.key, { choices: [...row.choices, ""] })}
                    className="inline-flex items-center gap-1 text-sm font-bold text-brand hover:underline"
                  >
                    <Plus size={16} /> Add choice
                  </button>
                ) : null}
                {row.correctIndex === null ? (
                  <span className="text-sm font-bold text-warn">Pick the correct answer</span>
                ) : null}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => add("MULTIPLE_CHOICE")} className="btn btn-outline">
          <Plus size={18} /> Multiple choice question
        </button>
        <button type="button" onClick={() => add("TRUE_FALSE")} className="btn btn-outline">
          <Plus size={18} /> True / false question
        </button>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t-2 border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          {error ? (
            <p role="alert" className="text-sm font-bold text-danger">
              {error}
            </p>
          ) : (
            <p className="text-sm font-semibold text-muted">
              {dirty ? "Unsaved changes" : "All changes saved"}
            </p>
          )}
          <div className="ml-auto flex gap-2">
            {onCancel ? (
              <button type="button" onClick={onCancel} className="btn btn-outline">
                Start over
              </button>
            ) : null}
            <button type="button" onClick={save} disabled={saving || !dirty} className="btn btn-primary px-6">
              {saving ? "Saving…" : id ? "Save changes" : "Save quiz"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function findProblem(title: string, rows: Row[]): string | null {
  if (!title.trim()) return "Give the quiz a title.";
  if (rows.length === 0) return "Keep at least one question.";
  for (const [i, row] of rows.entries()) {
    if (!row.text.trim()) return `Question ${i + 1} has no text.`;
    if (row.choices.some((c) => !c.trim())) return `Question ${i + 1} has an empty choice. Fill it in or remove it.`;
  }
  return null;
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-muted disabled:cursor-default disabled:opacity-30 ${
        danger ? "hover:bg-danger-soft hover:text-danger" : "hover:bg-ivory hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
