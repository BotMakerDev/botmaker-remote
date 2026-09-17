import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import type { Api, Session } from "./api";
import { loadQuickReplies, saveQuickReplies } from "./config";

interface Props {
  api: Api;
  session: Session;
  onBack: () => void;
}

/** Keys the soft keyboard has no way to type, sent as tmux key names. */
const SPECIAL_KEYS: Array<[label: string, key: string]> = [
  ["Esc", "Escape"],
  ["Tab", "Tab"],
  ["↑", "Up"],
  ["↓", "Down"],
  ["^C", "C-c"],
  ["⏎", "Enter"],
];

/**
 * xterm.js over the terminal socket: binary both ways, a JSON resize frame whenever the box changes size
 * (rotation, the soft keyboard coming up). The quick-reply bar types through the HTTP route rather than
 * the socket so a reply lands even while the socket is reconnecting, and so the server marks the window
 * `running` the same way for both.
 */
export function TerminalScreen({ api, session, onBack }: Props) {
  const box = useRef<HTMLDivElement | null>(null);
  const term = useRef<Terminal | null>(null);
  const [status, setStatus] = useState<"connecting" | "open" | "closed">("connecting");
  const [replies, setReplies] = useState<string[]>(loadQuickReplies);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const t = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "ui-monospace, Menlo, monospace",
      theme: { background: "#0f1115" },
      scrollback: 2000,
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    t.loadAddon(fit);
    t.open(el);
    fit.fit();
    term.current = t;

    let ws: WebSocket | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const encoder = new TextEncoder();

    const connect = () => {
      if (closed) return;
      setStatus("connecting");
      ws = new WebSocket(api.terminalUrl(session.index, t.cols, t.rows));
      ws.binaryType = "arraybuffer";
      ws.onopen = () => {
        setStatus("open");
        sendSize();
      };
      ws.onmessage = (m) => {
        if (m.data instanceof ArrayBuffer) t.write(new Uint8Array(m.data));
        // Text frames are activity events; the list screen handles those, the terminal shows the bytes.
      };
      ws.onclose = (e) => {
        setStatus("closed");
        // 4404: the window is gone; 4401: the token stopped matching — neither is worth retrying.
        if (!closed && e.code !== 4404 && e.code !== 4401) retry = setTimeout(connect, 2000);
      };
      ws.onerror = () => ws?.close();
    };
    const sendSize = () => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols: t.cols, rows: t.rows }));
      }
    };
    const dataSub = t.onData((s) => {
      if (ws?.readyState === WebSocket.OPEN) ws.send(encoder.encode(s));
    });
    const binarySub = t.onBinary((s) => {
      if (ws?.readyState === WebSocket.OPEN) ws.send(Uint8Array.from(s, (c) => c.charCodeAt(0)));
    });
    const observer = new ResizeObserver(() => {
      fit.fit();
      sendSize();
    });
    observer.observe(el);
    // The soft keyboard resizes the visual viewport, not always the layout box.
    const vv = window.visualViewport;
    const onViewport = () => {
      el.style.height = `${(vv?.height ?? window.innerHeight) - el.getBoundingClientRect().top - 52}px`;
      fit.fit();
      sendSize();
    };
    vv?.addEventListener("resize", onViewport);
    onViewport();
    connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      vv?.removeEventListener("resize", onViewport);
      observer.disconnect();
      dataSub.dispose();
      binarySub.dispose();
      ws?.close();
      t.dispose();
      term.current = null;
    };
  }, [api, session.index]);

  const editReplies = () => {
    const edited = prompt("Quick replies, one per line:", replies.join("\n"));
    if (edited === null) return;
    const list = edited
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (list.length === 0) return;
    setReplies(list);
    saveQuickReplies(list);
  };

  return (
    <div className="screen terminal">
      <header>
        <button className="ghost" onClick={onBack} aria-label="back">
          ‹
        </button>
        <span className="name">{session.name}</span>
        <span className={`muted small status-${status}`}>{status}</span>
        <button className="ghost" onClick={() => term.current?.focus()} aria-label="keyboard">
          ⌨
        </button>
        <button className="ghost" onClick={editReplies} aria-label="edit quick replies">
          ⋯
        </button>
      </header>
      <div className="term-box" ref={box} />
      <div className="bar">
        {SPECIAL_KEYS.map(([label, key]) => (
          <button key={key} className="key" onClick={() => void api.key(session.index, key)}>
            {label}
          </button>
        ))}
        {replies.map((r) => (
          <button key={r} className="reply" onClick={() => void api.send(session.index, r, true)}>
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}
