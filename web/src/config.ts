/** Where the server is and the token that opens it — the whole of what the phone remembers. */
export interface Endpoint {
  host: string;
  port: number;
  token: string;
  secure: boolean;
}

const ENDPOINT_KEY = "botmaker-remote.endpoint";
const REPLIES_KEY = "botmaker-remote.quickReplies";

/** The replies a fresh install offers. Editable in the terminal's ⋯ menu, stored per phone. */
export const DEFAULT_QUICK_REPLIES: string[] = ["y", "yes", "continue", "no", "/clear", "/compact"];

/** Parses a scanned or pasted pairing URL — {@code http://100.75.38.1:7788/?token=…} — or null. */
export function parseUrl(input: string): Endpoint | null {
  try {
    const u = new URL(input.trim());
    const token = u.searchParams.get("token") ?? "";
    if (!token) return null;
    return {
      host: u.hostname,
      port: Number(u.port) || (u.protocol === "https:" ? 443 : 80),
      token,
      secure: u.protocol === "https:",
    };
  } catch {
    return null;
  }
}

export function httpBase(ep: Endpoint): string {
  return `${ep.secure ? "https" : "http"}://${ep.host}:${ep.port}`;
}

export function wsBase(ep: Endpoint): string {
  return `${ep.secure ? "wss" : "ws"}://${ep.host}:${ep.port}`;
}

export function loadEndpoint(): Endpoint | null {
  try {
    const raw = localStorage.getItem(ENDPOINT_KEY);
    return raw ? (JSON.parse(raw) as Endpoint) : null;
  } catch {
    return null;
  }
}

export function saveEndpoint(ep: Endpoint | null): void {
  try {
    if (ep) localStorage.setItem(ENDPOINT_KEY, JSON.stringify(ep));
    else localStorage.removeItem(ENDPOINT_KEY);
  } catch {
    /* storage unavailable: the pairing lasts this run */
  }
}

export function loadQuickReplies(): string[] {
  try {
    const raw = localStorage.getItem(REPLIES_KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : null;
    return Array.isArray(list) && list.length > 0 ? list : DEFAULT_QUICK_REPLIES;
  } catch {
    return DEFAULT_QUICK_REPLIES;
  }
}

export function saveQuickReplies(list: string[]): void {
  try {
    localStorage.setItem(REPLIES_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}
