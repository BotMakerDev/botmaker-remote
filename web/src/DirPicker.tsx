import { useEffect, useState } from "react";
import type { Api, DirListing } from "./api";

/** `path` as the operator reads it: `~` for home, `~/IdeaProjects/x` under it. */
export function tildePath(path: string, home: string): string {
  if (!home) return path;
  if (path === home) return "~";
  return path.startsWith(home + "/") ? "~" + path.slice(home.length) : path;
}

interface Props {
  api: Api;
  /** The directory the browser opens on; empty is home. */
  start: string;
  onPick: (path: string) => void;
  onCancel: () => void;
}

/**
 * Where a new session starts: the recent directories as one-tap chips, and a browser over the server's
 * home. The server lists nothing above home, so the ↑ row disappears there.
 */
export function DirPicker({ api, start, onPick, onCancel }: Props) {
  const [listing, setListing] = useState<DirListing | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const go = async (path: string) => {
    try {
      setListing(await api.dirs(path));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    void go(start);
    api.recentDirs().then(setRecent, () => setRecent([]));
    // Opened once per sheet: `start` is where the sheet begins, not a value to follow.
  }, [api]);

  const home = listing?.home ?? "";
  return (
    <div className="picker dir-picker">
      <h2>Start in…</h2>
      {recent.length > 0 && (
        <div className="chips">
          {recent.map((r) => (
            <button key={r} className="chip" onClick={() => onPick(r)}>
              {tildePath(r, home)}
            </button>
          ))}
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {listing && (
        <>
          <p className="dir-path">
            <code>{tildePath(listing.path, home)}</code>
          </p>
          <ul className="list dir-list">
            {listing.parent !== null && (
              <li>
                <button className="dir-row" onClick={() => void go(listing.parent!)}>
                  ↑ ..
                </button>
              </li>
            )}
            {listing.dirs.map((d) => (
              <li key={d}>
                <button className="dir-row" onClick={() => void go(`${listing.path}/${d}`)}>
                  📁 {d}
                </button>
              </li>
            ))}
            {listing.dirs.length === 0 && <li className="muted small">No sub-directories.</li>}
          </ul>
          <button className="primary" onClick={() => onPick(listing.path)}>
            Start here
          </button>
        </>
      )}
      <button className="ghost" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
