import { useEffect, useMemo, useState } from "react";
import { Api, type Session } from "./api";
import { ConnectScreen } from "./ConnectScreen";
import { SessionsScreen } from "./SessionsScreen";
import { TerminalScreen } from "./TerminalScreen";
import { loadEndpoint, saveEndpoint, type Endpoint } from "./config";
import { requestNotificationPermission } from "./notify";
import { LATEST_APK_URL, useAppUpdate } from "./useAppUpdate";
import { useSessions } from "./useSessions";

/** Three screens: pair, pick a window, be in it. The endpoint is the only thing remembered. */
export function App() {
  const [endpoint, setEndpoint] = useState<Endpoint | null>(loadEndpoint);
  const [open, setOpen] = useState<Session | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const api = useMemo(() => (endpoint ? new Api(endpoint) : null), [endpoint]);
  const { sessions, accounts, error, online, refresh } = useSessions(api, open?.index ?? null);
  const update = useAppUpdate();

  useEffect(() => {
    if (api) void requestNotificationPermission();
  }, [api]);

  // A token the server no longer accepts sends the phone back to pairing, with the reason.
  useEffect(() => {
    if (error === "unauthorized") {
      setConnectError("The server refused the token — pair again.");
      saveEndpoint(null);
      setEndpoint(null);
      setOpen(null);
    }
  }, [error]);

  if (!endpoint || !api) {
    return (
      <ConnectScreen
        error={connectError}
        onConnect={(ep) => {
          setConnectError(null);
          saveEndpoint(ep);
          setEndpoint(ep);
        }}
      />
    );
  }

  if (open) {
    const live = sessions.find((s) => s.index === open.index) ?? open;
    return <TerminalScreen api={api} session={live} onBack={() => setOpen(null)} />;
  }

  return (
    <>
      {update.available && (
        <a className="update" href={LATEST_APK_URL}>
          Update available: {update.latest} — tap to download
        </a>
      )}
      <SessionsScreen
        sessions={sessions}
        accounts={accounts}
        online={online}
        error={error === "unauthorized" ? null : error}
        version={update.version}
        onOpen={setOpen}
        onNew={async (slot, name) => {
          const made = await api.open(slot, name);
          await refresh();
          setOpen(made);
        }}
        onClose={async (s) => {
          await api.close(s.index);
          await refresh();
        }}
        onRefresh={() => void refresh()}
        onForget={() => {
          saveEndpoint(null);
          setEndpoint(null);
        }}
      />
    </>
  );
}
