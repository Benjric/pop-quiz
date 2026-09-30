"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export function LoginForm({ from }: { from: string }) {
  const [state, formAction, pending] = useActionState(loginAction, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="from" value={from} />
      <label className="flex flex-col gap-1.5 text-sm font-bold">
        Email
        <input name="email" type="email" required autoComplete="email" className="field font-normal" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-bold">
        Password
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="field font-normal"
        />
      </label>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="btn btn-dark mt-1 h-12 w-full text-base">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
