import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";

interface Props {
  onResult: (text: string) => void;
  onCancel: () => void;
}

/**
 * Fullscreen camera QR scanner backed by ZXing (@zxing/browser). ZXing owns a robust continuous-decode loop
 * (far more tolerant of angle/lighting/motion than the old hand-rolled jsQR pass), driving our own <video>
 * element so we keep the overlay UI. We ask for the rear camera with continuous autofocus so moving the phone
 * toward the code doesn't stall on a focus hunt.
 *
 * Background/resume: when the app is backgrounded (the user opens the native camera app, or switches away) the
 * OS suspends and reclaims the camera track — on resume ZXing is still bound to a dead MediaStream and the
 * <video> shows a frozen/black frame. So we tear the scanner down on `hidden` and re-acquire a *fresh* track on
 * `visible` (also on focus/pageshow, which is how a Capacitor WebView resume surfaces). Everything is torn down
 * on unmount / cancel.
 */
export function QrScanner({ onResult, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let controls: IScannerControls | null = null;
    let done = false;
    let starting = false;

    const finish = (text: string) => {
      if (done) return;
      done = true;
      onResult(text);
    };

    const stop = () => {
      controls?.stop();
      controls = null;
    };

    const start = async () => {
      if (done || starting || controls) return; // guard double-start (visibility can fire repeatedly)
      starting = true;
      try {
        const video = videoRef.current;
        if (!video) return;
        const reader = new BrowserQRCodeReader();
        controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
              // @ts-expect-error focusMode is a valid MediaTrackConstraint on mobile, not yet in the TS lib DOM types
              focusMode: "continuous",
            },
            audio: false,
          },
          video,
          (result) => {
            if (result) finish(result.getText());
          }
        );
        // Nudge playback so a resume doesn't leave the element on a frozen frame (ZXing normally plays it).
        video.play().catch(() => {});
        if (done) stop(); // finished/unmounted while awaiting the camera
      } catch (e) {
        const name = (e as { name?: string }).name;
        setError(
          name === "NotAllowedError"
            ? "Camera permission denied. Enable it in Settings, or paste the URL instead."
            : "No camera available. Paste the URL instead."
        );
      } finally {
        starting = false;
      }
    };

    const onVisibility = () => {
      if (done) return;
      if (document.visibilityState === "hidden") {
        stop();
      } else {
        // Re-acquire a fresh track — the suspended one is dead after a background/resume.
        stop();
        void start();
      }
    };
    const onResume = () => {
      if (!done && document.visibilityState === "visible") void start();
    };

    void start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onResume);
    window.addEventListener("pageshow", onResume);

    return () => {
      done = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onResume);
      window.removeEventListener("pageshow", onResume);
      stop();
    };
  }, [onResult]);

  return (
    <div className="scanner">
      <video ref={videoRef} className="scanner-video" playsInline muted />
      <div className="scanner-frame" />
      <p className="scanner-hint">
        {error ?? "Point the camera at the QR the server printed when it started."}
      </p>
      <button className="scanner-cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
