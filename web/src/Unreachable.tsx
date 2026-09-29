import { reachSteps } from "./reach";

interface Props {
  host: string;
  port: number;
  detail: string | null;
  onRetry: () => void;
}

/** Shown instead of the session list while the server cannot be reached: why, what to try, and a retry. */
export function Unreachable({ host, port, detail, onRetry }: Props) {
  return (
    <div className="unreachable">
      <h2>Can't reach the server</h2>
      <p className="muted">
        {host}:{port} did not answer{detail ? ` (${detail})` : ""}. The server is usually fine; the phone's
        connection to it is not.
      </p>
      <ol>
        {reachSteps(host).map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <button className="primary" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
