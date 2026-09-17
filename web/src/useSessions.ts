import { useCallback, useEffect, useRef, useState } from "react";
import type { Account, ActivityEvent, Api, Session } from "./api";
import { notifyWaiting } from "./notify";

/**
 * The session list, kept current two ways: re-fetched on demand (and every 15 s, since a window opened
 * from the desktop is invisible otherwise) and patched live from `/ws/events`, which also raises the
 * "waiting" notification for any window but the one on screen.
 */
export function useSessions(api: Api | null, watching: number | null) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const watchingRef = useRef(watching);
  watchingRef.current = watching;

  const refresh = useCallback(async () => {
    if (!api) return;
    try {
      const [list, slots] = await Promise.all([api.sessions(), api.accounts()]);
      setSessions(list);
      setAccounts(slots);
      setError(null);
      setOnline(true);
    } catch (e) {
      setOnline(false);
      setError((e as Error).message === "unauthorized" ? "unauthorized" : `Server unreachable: ${(e as Error).message}`);
    }
  }, [api]);

  useEffect(() => {
    if (!api) return;
    void refresh();
    const timer = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(timer);
  }, [api, refresh]);

  useEffect(() => {
    if (!api) return;
    let ws: WebSocket | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const connect = () => {
      if (closed) return;
      ws = new WebSocket(api.eventsUrl());
      ws.onmessage = (m) => {
        try {
          const ev = JSON.parse(String(m.data)) as ActivityEvent;
          if (ev.type !== "activity") return;
          setSessions((prev) => {
            const hit = prev.find((s) => s.index === ev.window);
            if (hit && ev.state === "waiting" && watchingRef.current !== ev.window) {
              void notifyWaiting(ev.window, hit.name, ev.message);
            }
            return prev.map((s) =>
              s.index === ev.window ? { ...s, state: ev.state, message: ev.message, at: ev.at } : s
            );
          });
        } catch {
          /* not ours */
        }
      };
      ws.onclose = () => {
        if (!closed) retry = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws?.close();
    };
    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, [api]);

  return { sessions, accounts, error, online, refresh };
}
