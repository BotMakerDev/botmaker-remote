import { useState, type ReactNode } from "react";
import { LATEST_APK_URL, canInstallInApp, installRelease } from "./useAppUpdate";

type Phase = { kind: "idle" } | { kind: "downloading"; fraction: number | null } | { kind: "failed"; message: string };

/**
 * The "get the update" action. Inside the APK it downloads and installs in place (`ApkUpdater`), showing
 * progress and, when Android would refuse the file, why. In a browser it is the plain link to the latest
 * APK, as before.
 */
export function UpdateLink({ tag, className, children }: { tag: string | null; className: string; children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  if (!tag || !canInstallInApp()) {
    return (
      <a className={className} href={LATEST_APK_URL} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }

  const start = async () => {
    setPhase({ kind: "downloading", fraction: null });
    try {
      await installRelease(tag, (fraction) => setPhase({ kind: "downloading", fraction }));
      setPhase({ kind: "idle" });
    } catch (e) {
      setPhase({ kind: "failed", message: e instanceof Error ? e.message : String(e) });
    }
  };

  if (phase.kind === "downloading") {
    const percent = phase.fraction === null ? "" : ` ${Math.round(phase.fraction * 100)}%`;
    return <span className={className}>Downloading…{percent}</span>;
  }
  return (
    <>
      <button className={className} onClick={() => void start()}>
        {phase.kind === "failed" ? "Retry" : children}
      </button>
      {phase.kind === "failed" && <span className="update-error">{phase.message}</span>}
    </>
  );
}
