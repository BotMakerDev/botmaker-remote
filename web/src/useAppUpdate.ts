import { useCallback, useEffect, useState } from "react";

/** Build-time app version (from web/package.json), injected by Vite's `define`. */
declare const __APP_VERSION__: string;
export const APP_VERSION = __APP_VERSION__;

const RELEASES_API = "https://api.github.com/repos/BotMakerDev/botmaker-remote/releases/latest";
/** Stable permalink to the latest APK. */
export const LATEST_APK_URL =
  "https://github.com/BotMakerDev/botmaker-remote/releases/latest/download/botmaker-remote.apk";

const CHECK_KEY = "botmaker-remote.updateCheckedAt";
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // auto-check throttle: at most once every 6h

/** Outcome of the most recent check, for the manual "Check for updates" button to render. */
export type CheckResult = "idle" | "checking" | "uptodate" | "available" | "error";

/** Parses "v1.2.3" / "1.2.3" into a numeric tuple; missing parts default to 0. */
export function parseVersion(v: string): number[] {
  return v.replace(/^[^\d]*/, "").split(/[.\-+]/).map((n) => Number(n) || 0);
}

/** True if `latest` is a strictly newer version than `current`. */
export function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

/**
 * Best-effort GitHub-release update check. Runs automatically on mount (throttled 6h via localStorage) and
 * exposes {@link checkNow} for an explicit "Check for updates" button (ignores the throttle). Any failure
 * (offline, rate-limit) resolves to {@code "error"} without throwing.
 */
export function useAppUpdate(): {
  available: boolean;
  latest: string | null;
  version: string;
  result: CheckResult;
  checkNow: () => void;
} {
  const [latest, setLatest] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult>("idle");

  const runCheck = useCallback(async (force: boolean, signal?: AbortSignal) => {
    if (!force) {
      const last = Number(localStorage.getItem(CHECK_KEY) ?? 0);
      if (Date.now() - last < CHECK_INTERVAL_MS) return;
    }
    setResult("checking");
    try {
      const res = await fetch(RELEASES_API, { signal, headers: { Accept: "application/vnd.github+json" } });
      if (!res.ok) {
        setResult("error");
        return;
      }
      const tag = (await res.json())?.tag_name as string | undefined;
      localStorage.setItem(CHECK_KEY, String(Date.now()));
      if (tag && isNewer(tag, APP_VERSION)) {
        setLatest(tag);
        setResult("available");
      } else {
        setResult("uptodate");
      }
    } catch {
      setResult("error");
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void runCheck(false, ctrl.signal);
    return () => ctrl.abort();
  }, [runCheck]);

  return {
    available: latest !== null,
    latest,
    version: APP_VERSION,
    result,
    checkNow: () => void runCheck(true),
  };
}
