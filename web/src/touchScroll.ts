import type { Terminal } from "@xterm/xterm";

/**
 * A finger drag on the terminal, turned into mouse-wheel reports for tmux.
 *
 * Why this exists: tmux draws on the alternate screen, which has no scrollback, so xterm.js's own touch
 * scrolling had nothing to scroll and Claude Code's output could not be read back. The server turns tmux's
 * `mouse` on for the phone's view; tmux then asks this terminal for mouse reports, and a wheel report
 * scrolls the pane's history in copy-mode. xterm.js sends wheel reports for a real wheel but not for a
 * finger, so the finger is translated here.
 */

/** Line heights of drag per wheel report. tmux scrolls 5 lines a report; 3 keeps up with the finger. */
export const LINES_PER_REPORT = 3;

/** Movement below this (px) is a tap, left to xterm.js so a tap still focuses and brings up the keyboard. */
export const TAP_SLOP = 8;

/**
 * The SGR wheel report for one notch at cell (col, row), both 1-based: button 64 is wheel up (older
 * output), 65 wheel down. `CSI < b ; x ; y M` is the encoding tmux asks for.
 */
export function wheelReport(up: boolean, col: number, row: number): string {
  return `\x1b[<${up ? 64 : 65};${Math.max(1, col)};${Math.max(1, row)}M`;
}

/**
 * How many notches a drag of `dy` pixels is worth, and what is left over for the next move. A finger
 * moving down (dy > 0) pulls older output into view, which is wheel up.
 */
export function notches(dy: number, lineHeight: number): { count: number; up: boolean; rest: number } {
  const step = Math.max(1, lineHeight * LINES_PER_REPORT);
  const count = Math.floor(Math.abs(dy) / step);
  return { count, up: dy > 0, rest: dy - Math.sign(dy) * count * step };
}

/**
 * Listens for one-finger drags on `el` and scrolls: wheel reports through `send` when the program in the
 * terminal asked for the mouse (tmux, with `mouse on`), otherwise xterm.js's own scrollback. Returns the
 * function that stops listening.
 */
export function attachTouchScroll(el: HTMLElement, term: Terminal, send: (data: string) => void): () => void {
  let startY = 0;
  let lastY = 0;
  let pending = 0;
  let dragging = false;

  const cell = (t: Touch) => {
    const box = el.getBoundingClientRect();
    const col = Math.floor(((t.clientX - box.left) / box.width) * term.cols) + 1;
    const row = Math.floor(((t.clientY - box.top) / box.height) * term.rows) + 1;
    return { col, row };
  };

  const onStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    startY = lastY = e.touches[0].clientY;
    pending = 0;
    dragging = false;
  };

  const onMove = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    if (!dragging && Math.abs(t.clientY - startY) < TAP_SLOP) return;
    dragging = true;
    // Ours from here on: xterm.js's own handler would scroll an empty scrollback and eat the gesture.
    e.preventDefault();
    e.stopPropagation();
    pending += t.clientY - lastY;
    lastY = t.clientY;
    const lineHeight = el.getBoundingClientRect().height / Math.max(1, term.rows);
    const { count, up, rest } = notches(pending, lineHeight);
    pending = rest;
    if (count === 0) return;
    if (term.modes.mouseTrackingMode !== "none") {
      const { col, row } = cell(t);
      send(wheelReport(up, col, row).repeat(count));
    } else {
      term.scrollLines((up ? -1 : 1) * count * LINES_PER_REPORT);
    }
  };

  const onEnd = (e: TouchEvent) => {
    if (dragging) {
      e.preventDefault();
      e.stopPropagation();
    }
    dragging = false;
  };

  const options = { capture: true, passive: false } as const;
  el.addEventListener("touchstart", onStart, options);
  el.addEventListener("touchmove", onMove, options);
  el.addEventListener("touchend", onEnd, options);
  return () => {
    el.removeEventListener("touchstart", onStart, options);
    el.removeEventListener("touchmove", onMove, options);
    el.removeEventListener("touchend", onEnd, options);
  };
}
