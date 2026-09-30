"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

export type ConfirmOptions = {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  /** Red button and warning icon, for things that can't be undone. */
  danger?: boolean;
};

/**
 * An in-app "Are you sure?" box instead of the browser's confirm().
 * `const [ask, dialog] = useConfirm()`; render `dialog`, then
 * `if (await ask({...})) …`. Cancel has focus, and Esc or a click outside
 * cancels, so nothing is deleted by accident.
 */
export function useConfirm() {
  const [request, setRequest] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const ask = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setRequest({ ...options, resolve })),
    [],
  );

  const dialog = request ? (
    <ConfirmDialog
      {...request}
      onClose={(ok) => {
        request.resolve(ok);
        setRequest(null);
      }}
    />
  ) : null;

  return [ask, dialog] as const;
}

function ConfirmDialog({ title, body, confirmLabel, danger, onClose }: ConfirmOptions & { onClose: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose(false);
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(false); // the dimmed backdrop
      }}
      className="m-auto w-[min(460px,calc(100vw-32px))] rounded-3xl border-0 bg-white p-0 text-ink shadow-[0_30px_80px_-20px_rgba(30,27,58,0.5)] backdrop:bg-ink/55 backdrop:backdrop-blur-[2px]"
    >
      <div className="anim-pop flex flex-col gap-4 p-6 [animation-duration:0.25s]">
        <div className="flex items-start gap-4">
          {danger ? (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
              <AlertTriangle size={22} aria-hidden />
            </span>
          ) : null}
          <div className="flex min-w-0 flex-col gap-2 pt-1.5">
            <h2 id="confirm-title" className="font-display text-xl leading-tight font-extrabold">
              {title}
            </h2>
            {body ? <div className="text-[15px] text-muted">{body}</div> : null}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          {/* Focused first, so Enter doesn't confirm by accident. */}
          <button type="button" autoFocus className="btn btn-outline" onClick={() => onClose(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${danger ? "bg-danger text-white hover:bg-[#8f1c13]" : "btn-primary"}`}
            onClick={() => onClose(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
