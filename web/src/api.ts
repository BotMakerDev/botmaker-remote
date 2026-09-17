import { httpBase, wsBase, type Endpoint } from "./config";

/** One tmux window, as `GET /api/sessions` describes it. */
export interface Session {
  index: number;
  name: string;
  command: string;
  state: "running" | "waiting" | "idle";
  message?: string;
  at?: string;
}

/** One cswap slot, as `GET /api/accounts` describes it. */
export interface Account {
  slot: string;
  label: string;
  fiveHour: number;
  sevenDay: number;
  active: boolean;
}

export interface Status {
  version: string;
  tmux: boolean;
  cswap: boolean;
  ntfy: boolean;
}

/** What the server pushes on `/ws/events` and on every terminal socket. */
export interface ActivityEvent {
  type: "activity";
  window: number;
  state: Session["state"];
  message: string;
  at: string;
}

/** The server's HTTP surface. Every call carries the token; a 401 is thrown as `unauthorized`. */
export class Api {
  constructor(private readonly ep: Endpoint) {}

  status(): Promise<Status> {
    return this.get("/api/status");
  }

  sessions(): Promise<Session[]> {
    return this.get("/api/sessions");
  }

  accounts(): Promise<Account[]> {
    return this.get("/api/accounts");
  }

  async open(slot: string, name?: string): Promise<Session> {
    const res = await this.fetch("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ slot, name: name ?? "" }),
    });
    return (await res.json()) as Session;
  }

  async close(index: number): Promise<void> {
    await this.fetch(`/api/sessions/${index}`, { method: "DELETE" });
  }

  /** Types text (and Enter by default) into a window, whether or not a terminal is open on it. */
  async send(index: number, text: string, enter = true): Promise<void> {
    await this.fetch(`/api/sessions/${index}/send`, {
      method: "POST",
      body: JSON.stringify({ text, enter }),
    });
  }

  /** Presses one tmux key name: `Escape`, `C-c`, `Enter`, `Up`. */
  async key(index: number, key: string): Promise<void> {
    await this.fetch(`/api/sessions/${index}/send`, { method: "POST", body: JSON.stringify({ key }) });
  }

  eventsUrl(): string {
    return `${wsBase(this.ep)}/ws/events?token=${encodeURIComponent(this.ep.token)}`;
  }

  terminalUrl(index: number, cols: number, rows: number): string {
    return `${wsBase(this.ep)}/ws/term/${index}?token=${encodeURIComponent(this.ep.token)}&cols=${cols}&rows=${rows}`;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await this.fetch(path);
    return (await res.json()) as T;
  }

  private async fetch(path: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetch(httpBase(this.ep) + path, {
      ...init,
      headers: {
        "X-Botmaker-Token": this.ep.token,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (res.status === 401) throw new Error("unauthorized");
    if (!res.ok) {
      let detail = res.statusText;
      try {
        detail = ((await res.json()) as { error?: string }).error ?? detail;
      } catch {
        /* no body */
      }
      throw new Error(detail);
    }
    return res;
  }
}
