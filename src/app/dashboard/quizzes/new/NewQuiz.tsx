"use client";

import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { QuizEditor, type EditableQuestion } from "../QuizEditor";
import type { ExtractionResult } from "@/lib/extract/types";

// Mirrors MAX_UPLOAD_BYTES / SUPPORTED_EXTENSIONS in src/lib/extract, which
// is server-only (it pulls in the PDF and spreadsheet readers).
const MAX_BYTES = 4 * 1024 * 1024;
const ACCEPT = ".pdf,.docx,.xlsx,.xls,.csv,.txt";

type Review = {
  title: string;
  fileName: string | null;
  questions: EditableQuestion[];
  skipped: ExtractionResult["skipped"];
  foundNone: boolean;
};

const BLANK: EditableQuestion = { text: "", choices: ["", "", "", ""], correctIndex: null, type: "MULTIPLE_CHOICE" };

export function NewQuiz() {
  const [review, setReview] = useState<Review | null>(null);
  const [reviewKey, setReviewKey] = useState(0);

  if (review) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Review the questions</h1>
          <p className="mt-1 text-muted">
            {review.fileName ? `From ${review.fileName}. ` : ""}Fix anything that came out wrong, then save.
          </p>
        </div>
        {review.foundNone ? (
          <p className="rounded-2xl bg-warn-soft px-4 py-3 font-semibold text-warn">
            No multiple-choice or true/false questions were found in that file. Check the skipped items below, or type
            the questions in.
          </p>
        ) : null}
        <QuizEditor
          key={reviewKey}
          initialTitle={review.title}
          sourceFileName={review.fileName}
          initialQuestions={review.questions}
          skipped={review.skipped}
          onCancel={() => setReview(null)}
        />
      </div>
    );
  }

  return (
    <Upload
      onDone={(r) => {
        setReviewKey((k) => k + 1);
        setReview(r);
      }}
    />
  );
}

function Upload({ onDone }: { onDone: (review: Review) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("That file is over 4 MB. Remove images from it, or split it into smaller files.");
      return;
    }
    setBusy(file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/quizzes/extract", { method: "POST", body: form });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) {
        setError(body?.error ?? "The file couldn't be read. Try again.");
        return;
      }
      const result = body as ExtractionResult & { fileName: string };
      onDone({
        title: result.title ?? file.name.replace(/\.[^.]+$/, ""),
        fileName: result.fileName,
        questions: result.questions.length ? result.questions : [{ ...BLANK, choices: [...BLANK.choices] }],
        skipped: result.skipped,
        foundNone: result.questions.length === 0,
      });
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold">New quiz</h1>
        <p className="mt-1 text-muted">
          Upload a test or worksheet. Numbered questions with lettered choices (A, B, C…) and true/false items are
          pulled out; titles, directions, explanations and page numbers are skipped. Answers marked with *, bold, &ldquo;Answer:
          B&rdquo; or an answer key are picked up too.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file && !busy) void upload(file);
        }}
        className={`flex flex-col items-center gap-4 rounded-3xl border-3 border-dashed p-10 text-center transition-colors ${
          dragging ? "border-brand bg-brand-soft" : "border-brand-line bg-white"
        }`}
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand" aria-hidden>
          <FileUp size={32} />
        </span>
        {busy ? (
          <p className="font-display text-xl font-extrabold" role="status">
            Reading {busy}…
          </p>
        ) : (
          <>
            <p className="font-display text-xl font-extrabold">Drop a file here</p>
            <button type="button" onClick={() => input.current?.click()} className="btn btn-primary">
              Choose a file
            </button>
            <p className="text-sm text-muted">PDF, Word (.docx), Excel (.xlsx, .xls), CSV or text · up to 4 MB</p>
          </>
        )}
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 font-semibold text-danger">
          {error}
        </p>
      ) : null}

      <p className="text-sm text-muted">
        Scanned PDFs and photos can&apos;t be read. For a spreadsheet, use a header row with columns named
        Question, A, B, C, D and Answer (the answer as a letter).{" "}
        <button
          type="button"
          className="font-bold text-brand hover:underline"
          onClick={() =>
            onDone({
              title: "Untitled quiz",
              fileName: null,
              questions: [{ ...BLANK, choices: [...BLANK.choices] }],
              skipped: [],
              foundNone: false,
            })
          }
        >
          Or type the questions in yourself.
        </button>
      </p>
    </div>
  );
}
