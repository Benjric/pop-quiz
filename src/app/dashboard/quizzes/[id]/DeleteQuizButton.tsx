"use client";

import { useTransition } from "react";
import { deleteQuiz } from "../actions";
import { useConfirm } from "@/components/ConfirmDialog";

export function DeleteQuizButton({ id, title }: { id: string; title: string }) {
  const [pending, startTransition] = useTransition();
  const [ask, dialog] = useConfirm();
  return (
    <>
      {dialog}
      <button
        type="button"
        disabled={pending}
        className="btn btn-danger"
        onClick={async () => {
          const ok = await ask({
            danger: true,
            title: `Delete "${title}"?`,
            body: "Its past games and reports will be deleted too. You can't undo this.",
            confirmLabel: "Delete quiz",
          });
          if (ok) startTransition(() => deleteQuiz(id));
        }}
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
    </>
  );
}
