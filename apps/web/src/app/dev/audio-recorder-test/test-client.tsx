"use client";

import { useState, useSyncExternalStore } from "react";
import { AudioRecorder } from "@/components/audio-recorder";
import { getRecordingPlaybackUrl } from "@/lib/recordings/actions";

type SecureContextInfo = { isSecureContext: boolean; origin: string };

const SERVER_SECURE_CONTEXT_INFO: SecureContextInfo = { isSecureContext: false, origin: "" };

// Computed once and cached, same pattern as AudioRecorder's own
// capability detection - useSyncExternalStore needs a referentially
// stable snapshot, and these values don't change over a page's
// lifetime. Server and the first client render both report the "not
// secure, no origin" placeholder, so there's no hydration mismatch; the
// real values take over right after hydration.
let cachedSecureContextInfo: SecureContextInfo | null = null;
function getSecureContextInfo(): SecureContextInfo {
  if (!cachedSecureContextInfo) {
    cachedSecureContextInfo = {
      isSecureContext: typeof window !== "undefined" && window.isSecureContext,
      origin: typeof window !== "undefined" ? window.location.origin : "",
    };
  }
  return cachedSecureContextInfo;
}
function subscribeNoop() {
  return () => {};
}

function SecureContextBanner() {
  const info = useSyncExternalStore(subscribeNoop, getSecureContextInfo, () => SERVER_SECURE_CONTEXT_INFO);

  return (
    <div className="flex flex-col gap-1 rounded-md border border-dashed border-border bg-muted/30 p-2 font-mono text-xs">
      <p>
        window.isSecureContext:{" "}
        <span className={info.isSecureContext ? "text-success" : "text-destructive"}>
          {String(info.isSecureContext)}
        </span>
      </p>
      <p className="text-muted-foreground">window.location.origin: {info.origin || "(unknown)"}</p>
      {!info.isSecureContext && (
        <p className="text-destructive">
          Not a secure context - the browser will hide getUserMedia/MediaRecorder entirely. You
          are probably not actually on the https:// tunnel URL (check for a plain http:// address,
          a redirect that dropped back to the LAN IP, or a cached/bookmarked old URL).
        </p>
      )}
    </div>
  );
}

export function AudioRecorderTestClient() {
  const [path, setPath] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleUploaded(uploadedPath: string) {
    setPath(uploadedPath);
    setChecking(true);
    const url = await getRecordingPlaybackUrl(uploadedPath);
    setServerUrl(url);
    setChecking(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <SecureContextBanner />

      <AudioRecorder maxDurationSeconds={60} maxAttempts={3} allowReRecord onUploaded={handleUploaded} />

      {path && (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-4 text-sm">
          <p>
            Storage path: <code className="text-xs">{path}</code>
          </p>
          {checking && <p className="text-muted-foreground">Fetching signed URL from Storage…</p>}
          {serverUrl && (
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">Confirmed playback from Storage:</span>
              <audio controls src={serverUrl} className="h-10 w-full max-w-sm" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
