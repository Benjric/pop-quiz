"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Ably from "ably";

/**
 * Keeps a screen's view of the game fresh. Ably messages only say "something
 * changed"; the screen then re-reads its state from the API. A slow poll runs
 * underneath as a safety net, and if Ably isn't configured (local dev) the
 * poll simply runs faster.
 */
type Options<T> = {
  gameId: string | null;
  role: "host" | "player";
  load: () => Promise<T | null>;
};

const FAST_POLL_MS = 1500;
const SAFETY_POLL_MS = 8000;

export function useLiveGame<T>({ gameId, role, load }: Options<T>) {
  const [state, setState] = useState<T | null>(null);
  const [live, setLive] = useState<"connecting" | "realtime" | "polling">("connecting");
  const loadRef = useRef(load);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const queued = useRef(false);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const refresh = useCallback(async () => {
    if (inFlight.current) {
      queued.current = true;
      return;
    }
    inFlight.current = true;
    try {
      // Requests that arrived mid-load run once more afterwards.
      do {
        queued.current = false;
        try {
          setState(await loadRef.current());
        } catch {
          // Network blip: the next refresh will catch up.
        }
      } while (queued.current);
    } finally {
      inFlight.current = false;
    }
  }, []);

  /** Coalesces bursts of messages (e.g. 30 answers in a second). */
  const refreshSoon = useCallback(
    (delay = 150) => {
      if (timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        void refresh();
      }, delay);
    },
    [refresh],
  );

  useEffect(() => {
    void refresh();
    if (!gameId) return;

    let client: Ably.Realtime | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    const tokenUrl = `/api/ably/token?gameId=${encodeURIComponent(gameId)}&role=${role}`;

    const startPolling = (ms: number) => {
      if (poll) clearInterval(poll);
      poll = setInterval(() => void refresh(), ms);
    };

    (async () => {
      const first = await fetch(tokenUrl).catch(() => null);
      if (cancelled) return;
      if (!first || !first.ok) {
        setLive("polling");
        startPolling(FAST_POLL_MS);
        return;
      }
      let initial: Ably.TokenRequest | null = await first.json();

      client = new Ably.Realtime({
        authCallback: async (_params, callback) => {
          if (initial) {
            const token = initial;
            initial = null;
            callback(null, token);
            return;
          }
          try {
            const res = await fetch(tokenUrl);
            if (!res.ok) throw new Error(`token ${res.status}`);
            callback(null, await res.json());
          } catch (error) {
            callback(String(error), null);
          }
        },
      });
      client.connection.on((change) => {
        if (change.current === "connected") {
          setLive("realtime");
          startPolling(SAFETY_POLL_MS);
          void refresh(); // catch up on anything missed while disconnected
        } else if (change.current === "disconnected" || change.current === "suspended" || change.current === "failed") {
          setLive("polling");
          startPolling(FAST_POLL_MS);
        }
      });

      const onMessage = (message: Ably.InboundMessage) => refreshSoon(message.name === "answers" ? 400 : 100);
      await client.channels.get(`game:${gameId}`).subscribe(onMessage);
      if (role === "host") await client.channels.get(`game:${gameId}:host`).subscribe(onMessage);
    })().catch(() => {
      setLive("polling");
      startPolling(FAST_POLL_MS);
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (poll) clearInterval(poll);
      if (timer.current) clearTimeout(timer.current);
      client?.close();
    };
  }, [gameId, role, refresh, refreshSoon]);

  return { state, setState, refresh, live };
}

/** Seconds left on the question clock, corrected for the server/phone clock gap. */
export function useCountdown(deadline: number | null, serverNow: number | null): number | null {
  // Tagged with the deadline it was computed for, so a new question never
  // shows the previous question's (possibly zero) count.
  const [tick, setTick] = useState<{ deadline: number; left: number } | null>(null);

  useEffect(() => {
    if (deadline === null) return;
    const offset = serverNow !== null ? serverNow - Date.now() : 0;
    const update = () =>
      setTick({ deadline, left: Math.max(0, Math.ceil((deadline - (Date.now() + offset)) / 1000)) });
    const first = setTimeout(update, 0);
    const id = setInterval(update, 250);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [deadline, serverNow]);

  return deadline !== null && tick?.deadline === deadline ? tick.left : null;
}
