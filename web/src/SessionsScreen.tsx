import { useState } from "react";
import type { Account, Session } from "./api";

interface Props {
  sessions: Session[];
  accounts: Account[];
  online: boolean;
  error: string | null;
  version: string;
  onOpen: (s: Session) => void;
  onNew: (slot: string, name: string) => Promise<void>;
  onClose: (s: Session) => Promise<void>;
  onRefresh: () => void;
  onForget: () => void;
}

const STATE_LABEL: Record<Session["state"], string> = {
  running: "working",
  waiting: "waiting for you",
  idle: "no Claude (shell)",
};

/** The list of tmux windows, one row each, and the ＋ that opens a new one under a chosen account. */
export function SessionsScreen(p: Props) {
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const start = async (a: Account) => {
    setBusy(a.slot);
    try {
      await p.onNew(a.slot, a.label);
      setPicking(false);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="screen sessions">
      <header>
        <h1>Sessions</h1>
        <span className={`dot ${p.online ? "on" : "off"}`} title={p.online ? "connected" : "unreachable"} />
        <button className="ghost" onClick={p.onRefresh} aria-label="refresh">
          ↻
        </button>
      </header>
      {p.error && <p className="error">{p.error}</p>}
      {p.sessions.length === 0 && !p.error && (
        <p className="muted">No windows in tmux session <code>claude</code>. Open one below.</p>
      )}
      <ul className="list">
        {p.sessions.map((s) => (
          <li key={s.index} className={`session ${s.state}`}>
            <button className="session-main" onClick={() => p.onOpen(s)}>
              <span className="badge" />
              <span className="name">{s.name}</span>
              <span className="state">{STATE_LABEL[s.state]}</span>
              {s.message && s.state === "waiting" && <span className="msg">{s.message}</span>}
            </button>
            <button
              className="ghost danger"
              aria-label={`close ${s.name}`}
              onClick={() => {
                if (confirm(`Close "${s.name}"? Whatever runs in it ends.`)) void p.onClose(s);
              }}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {picking ? (
        <div className="picker">
          <h2>New session under…</h2>
          {p.accounts.length === 0 && <p className="muted">cswap lists no accounts on the server.</p>}
          <ul className="list">
            {p.accounts.map((a) => (
              <li key={a.slot}>
                <button className="session-main" disabled={busy !== null} onClick={() => void start(a)}>
                  <span className="name">
                    {a.slot}: {a.label}
                    {a.active ? " (active)" : ""}
                  </span>
                  <span className="state">
                    5h {a.fiveHour}% · 7d {a.sevenDay}%{busy === a.slot ? " · starting…" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button className="ghost" onClick={() => setPicking(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button className="primary fab" onClick={() => setPicking(true)} disabled={!p.online}>
          ＋ New session
        </button>
      )}

      <footer className="muted small">
        v{p.version} ·{" "}
        <button className="link" onClick={p.onForget}>
          forget this server
        </button>
      </footer>
    </div>
  );
}
