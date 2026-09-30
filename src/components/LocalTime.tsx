"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * Dates are shown in the viewer's time zone. The server (UTC on Vercel)
 * renders a plain date first; the browser swaps in local time after hydrating.
 */
export function LocalTime({ iso, withTime = true }: { iso: string; withTime?: boolean }) {
  const isClient = useSyncExternalStore(noop, () => true, () => false);
  const date = new Date(iso);
  const text = isClient
    ? date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
        ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
      })
    : iso.slice(0, 10);
  return <time dateTime={iso}>{text}</time>;
}
