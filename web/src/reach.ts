/**
 * What to do when the server cannot be reached, decided by the address the phone was paired with.
 *
 * The server binds the tailnet (or, with `--lan`, the local network), so "unreachable" is almost always the
 * phone's side: Tailscale disconnected, or Android stopped it in the background. The server's `--doctor` says
 * the same from the computer, with the phone's last-seen time.
 */
export type Network = "tailnet" | "lan" | "other";

/** Which network an address is on: Tailscale's 100.64.0.0/10 or a `.ts.net` name, RFC 1918, or neither. */
export function networkOf(host: string): Network {
  if (host.endsWith(".ts.net")) return "tailnet";
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return "other";
  const [a, b] = parts;
  if (a === 100 && b >= 64 && b <= 127) return "tailnet";
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return "lan";
  return "other";
}

/** The steps to try, in order, for a server at `host`. */
export function reachSteps(host: string): string[] {
  switch (networkOf(host)) {
    case "tailnet":
      return [
        "Open the Tailscale app and make sure it says Connected, signed in to the same account as the computer.",
        "Keep it connected: Android Settings ▸ Network ▸ VPN ▸ Tailscale ⚙ ▸ turn on Always-on VPN.",
        "Stop Android from pausing it: Settings ▸ Apps ▸ Tailscale ▸ Battery ▸ Unrestricted.",
        "On the computer, run botmaker-remote-server --doctor: it shows whether it sees this phone online.",
      ];
    case "lan":
      return [
        "Connect the phone to the same Wi-Fi as the computer (mobile data cannot reach a local address).",
        "Check the server still runs with --lan: the address changes when the computer changes network.",
        "On the computer, run botmaker-remote-server --doctor.",
      ];
    default:
      return [
        "Check the phone has a network connection.",
        "On the computer, run botmaker-remote-server --doctor.",
      ];
  }
}

/** Whether a failed request means the server was never reached, as opposed to the server answering an error. */
export function isUnreachable(e: unknown): boolean {
  // fetch rejects with a TypeError when no connection is made, and AbortSignal.timeout with a TimeoutError.
  return e instanceof TypeError || (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError"));
}
