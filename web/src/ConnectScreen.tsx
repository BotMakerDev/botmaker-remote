import { useState } from "react";
import { QrScanner } from "./QrScanner";
import { parseUrl, type Endpoint } from "./config";

interface Props {
  error: string | null;
  onConnect: (ep: Endpoint) => void;
}

/** Pairing: scan the QR the server printed, or paste its `pair:` line. */
export function ConnectScreen({ error, onConnect }: Props) {
  const [scanning, setScanning] = useState(false);
  const [pasted, setPasted] = useState("");
  const [bad, setBad] = useState<string | null>(null);

  const take = (text: string) => {
    const ep = parseUrl(text);
    if (!ep) {
      setBad("That is not a pairing URL (expected http://<tailnet ip>:7788/?token=…).");
      return;
    }
    setBad(null);
    onConnect(ep);
  };

  if (scanning) {
    return (
      <QrScanner
        onResult={(text) => {
          setScanning(false);
          take(text);
        }}
        onCancel={() => setScanning(false)}
      />
    );
  }

  return (
    <div className="screen connect">
      <h1>BotMaker Remote</h1>
      <p className="muted">
        Your Claude Code terminals, from the phone. Pair with the server running on the dev box — it prints a
        QR code and a <code>pair:</code> line when it starts (<code>journalctl --user -u botmaker-remote</code>).
      </p>
      <button className="primary" onClick={() => setScanning(true)}>
        Scan QR
      </button>
      <div className="row">
        <input
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder="or paste http://100.x.y.z:7788/?token=…"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
        />
        <button onClick={() => take(pasted)} disabled={!pasted.trim()}>
          Connect
        </button>
      </div>
      {(bad ?? error) && <p className="error">{bad ?? error}</p>}
      <p className="muted small">
        Only reachable on your tailnet: make sure Tailscale is connected on this phone.
      </p>
    </div>
  );
}
