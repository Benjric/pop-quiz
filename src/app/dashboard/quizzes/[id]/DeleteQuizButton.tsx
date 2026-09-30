"use client";

import { useTransition } from "react";
import { deleteQuiz } from "../actions";

export function DeleteQuizButton({ id, title }: { id: string; title: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="btn btn-danger"
      onClick={() => {
        if (!confirm(`Delete "${title}"? Its past game reports are deleted too.`)) return;
        startTransition(() => deleteQuiz(id));
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
