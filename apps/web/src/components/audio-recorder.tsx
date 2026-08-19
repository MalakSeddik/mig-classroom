"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { uploadSpeakingRecording } from "@/lib/recordings/actions";

// iOS Safari only grants microphone access when getUserMedia is called
// directly inside a user-gesture handler (a click), not automatically on
// mount - called any other way, the permission prompt never appears and
// the promise can hang forever, neither resolving nor rejecting. This is
// why the mic request only ever fires from the "Enable microphone"
// button's onClick below, never from an effect.
const MIC_REQUEST_TIMEOUT_MS = 10_000;

// Preference order for MediaRecorder's mimeType - Chrome and Safari
// support different sets, so we ask the browser which of these it
// actually supports rather than hardcoding one.
const MIME_PREFERENCES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];

function isTypeSupportedSafe(type: string): boolean {
  if (typeof MediaRecorder === "undefined") return false;
  try {
    return MediaRecorder.isTypeSupported(type);
  } catch {
    return false;
  }
}

function pickMimeType(): string | undefined {
  return MIME_PREFERENCES.find(isTypeSupportedSafe);
}

function classifyMicError(err: unknown): "blocked" | "no-device" | "mic-error" {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
    return "blocked";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "no-device";
  }
  return "mic-error";
}

// Turns any thrown value into a readable "Name: message" string for
// on-screen display - there's no console access when debugging from a
// phone, so every failure path in this component surfaces this instead
// of (or in addition to) console.error.
function describeError(err: unknown): string {
  if (err instanceof DOMException) return `${err.name}: ${err.message}`;
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function extensionFromMimeType(type: string): string {
  if (type.includes("webm")) return "webm";
  if (type.includes("mp4")) return "mp4";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("wav")) return "wav";
  return "audio";
}

type Capabilities = {
  hasMediaDevices: boolean;
  hasMediaRecorderCtor: boolean;
  mimeSupport: { type: string; supported: boolean }[];
  pickedMimeType: string | null;
};

const SERVER_CAPABILITIES: Capabilities = {
  hasMediaDevices: false,
  hasMediaRecorderCtor: false,
  mimeSupport: MIME_PREFERENCES.map((type) => ({ type, supported: false })),
  pickedMimeType: null,
};

// Computed once and cached - useSyncExternalStore's getSnapshot must
// return a referentially-stable value when nothing has changed, and
// browser capabilities don't change mid-session.
let cachedClientCapabilities: Capabilities | null = null;
function getClientCapabilities(): Capabilities {
  if (!cachedClientCapabilities) {
    cachedClientCapabilities = {
      hasMediaDevices: typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia,
      hasMediaRecorderCtor: typeof MediaRecorder !== "undefined",
      mimeSupport: MIME_PREFERENCES.map((type) => ({ type, supported: isTypeSupportedSafe(type) })),
      pickedMimeType: pickMimeType() ?? null,
    };
  }
  return cachedClientCapabilities;
}
function subscribeNoop() {
  return () => {};
}

type Phase =
  | "idle"
  | "requesting"
  | "timeout"
  | "blocked"
  | "no-device"
  | "mic-error"
  | "recorder-error"
  | "unsupported"
  | "test-idle"
  | "test-recording"
  | "test-recorded"
  | "ready"
  | "recording"
  | "recorded"
  | "uploading"
  | "uploaded"
  | "upload-error";

const GUIDANCE: Partial<Record<Phase, string>> = {
  timeout:
    "This is taking longer than expected. If your browser is showing a permission prompt, respond to it - otherwise, try again.",
  blocked:
    "Microphone access is blocked. Enable microphone access for this site in your browser's settings, then try again.",
  "no-device": "No microphone was found. Connect a microphone and try again.",
  "mic-error": "Couldn't access your microphone. Check your browser and device settings, then try again.",
  "recorder-error": "Couldn't start recording. See the technical details below.",
  unsupported:
    "Audio recording isn't supported in this browser. Try a recent version of Chrome, Firefox, or Safari.",
};

const ERROR_PHASES: Phase[] = ["timeout", "blocked", "no-device", "mic-error", "recorder-error", "unsupported"];

function DebugPanel({
  phase,
  rawError,
  capabilities,
}: {
  phase: Phase;
  rawError: string | null;
  capabilities: Capabilities;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-dashed border-border bg-muted/30 p-2 font-mono text-[11px] leading-tight text-muted-foreground">
      <p>phase: {phase}</p>
      <p>navigator.mediaDevices.getUserMedia: {String(capabilities.hasMediaDevices)}</p>
      <p>MediaRecorder defined: {String(capabilities.hasMediaRecorderCtor)}</p>
      <p>picked mimeType: {capabilities.pickedMimeType ?? "(none)"}</p>
      <p>isTypeSupported:</p>
      <ul className="pl-3">
        {capabilities.mimeSupport.map((m) => (
          <li key={m.type}>
            {m.type}: {String(m.supported)}
          </li>
        ))}
      </ul>
      {rawError && <p className="text-destructive">last error: {rawError}</p>}
    </div>
  );
}

export function AudioRecorder({
  maxDurationSeconds,
  maxAttempts,
  allowReRecord,
  onUploaded,
  onMicCheckPassed,
  skipMicTest = false,
  showDebugPanel = false,
}: {
  maxDurationSeconds: number;
  maxAttempts: number;
  allowReRecord: boolean;
  onUploaded: (path: string) => void;
  // Fires once the mic-check clip has been recorded and played back, i.e.
  // right when the phase moves past "test-recorded" to "ready" - lets a
  // parent reuse this component purely as a pre-start mic-check gate
  // (see <ExamStartScreen>) without caring about the rest of its phases.
  onMicCheckPassed?: () => void;
  // When true, once mic permission is granted this skips straight to the
  // "ready to record" phase instead of forcing a record-a-test-clip-and-
  // play-it-back step. For callers where a mic check already happened
  // somewhere else first (an exam's <ExamStartScreen> gate) - re-running
  // it per question would waste exam time on a redundant check. Leave
  // false (default) wherever there's no earlier gate, e.g. a future
  // assignments speaking submission.
  skipMicTest?: boolean;
  // The phase/capabilities/last-error panel was built for troubleshooting
  // real-device mic issues with no console access (see CLAUDE.md) - it's
  // internal debugging output, never meant for a student to see, so it's
  // off unless a caller explicitly opts in (only the /dev/audio-recorder-
  // test page does).
  showDebugPanel?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [testUrl, setTestUrl] = useState<string | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);

  // Server and the first client render both report the same "nothing
  // detected yet" snapshot, so there's no hydration mismatch; the real,
  // cached client capabilities take over right after hydration - same
  // pattern as <LocalDateTime>.
  const capabilities = useSyncExternalStore(subscribeNoop, getClientCapabilities, () => SERVER_CAPABILITIES);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordedBlobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  // Bumped on every new mic request and on unmount, so a getUserMedia
  // call that resolves late (after a timeout already fired, or after a
  // retry started a newer request) can recognize it's stale and ignore
  // itself instead of clobbering more current state.
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      // Intentionally mutating .current at cleanup time, not reading a
      // stale mount-time snapshot - this invalidates any in-flight mic
      // request so a late resolution can't update state after unmount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      requestIdRef.current++;
      clearTimer();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      // Intentionally reading .current at cleanup time (not a stale
      // mount-time snapshot) - this ref accumulates object URLs for the
      // whole component lifetime, and cleanup should revoke all of them.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Only ever called directly from the "Enable microphone" / "Try again"
  // button's onClick - never automatically. iOS Safari requires the
  // getUserMedia call to happen synchronously within a user-gesture
  // handler, or the permission prompt silently never appears.
  async function requestMic() {
    setRawError(null);

    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setPhase("unsupported");
      return;
    }

    const requestId = ++requestIdRef.current;
    setPhase("requesting");

    const timeoutId = setTimeout(() => {
      if (requestIdRef.current === requestId) setPhase("timeout");
    }, MIC_REQUEST_TIMEOUT_MS);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      clearTimeout(timeoutId);
      if (requestIdRef.current !== requestId) {
        // A retry (or unmount) already happened - this result is stale,
        // don't use it, just release the stream we were granted.
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      setPhase(skipMicTest ? "ready" : "test-idle");
    } catch (err) {
      clearTimeout(timeoutId);
      if (requestIdRef.current !== requestId) return;
      setRawError(describeError(err));
      setPhase(classifyMicError(err));
    }
  }

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function trackObjectUrl(url: string) {
    objectUrlsRef.current.push(url);
    return url;
  }

  function startRecording(isTest: boolean) {
    const stream = streamRef.current;
    if (!stream) return;

    setRawError(null);
    chunksRef.current = [];

    let recorder: MediaRecorder;
    try {
      const mimeType = pickMimeType();
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch (err) {
      setRawError(describeError(err));
      setPhase("recorder-error");
      return;
    }
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onerror = (event) => {
      clearTimer();
      const err = (event as { error?: unknown }).error;
      setRawError(describeError(err ?? event));
      setPhase("recorder-error");
    };

    recorder.onstop = () => {
      clearTimer();
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      const url = trackObjectUrl(URL.createObjectURL(blob));
      if (isTest) {
        setTestUrl(url);
        setPhase("test-recorded");
      } else {
        recordedBlobRef.current = blob;
        setRecordedUrl(url);
        setAttemptsUsed((n) => n + 1);
        setPhase("recorded");
      }
    };

    try {
      recorder.start();
    } catch (err) {
      setRawError(describeError(err));
      setPhase("recorder-error");
      return;
    }

    setElapsedSeconds(0);
    setPhase(isTest ? "test-recording" : "recording");

    const cap = isTest ? Math.min(10, maxDurationSeconds) : maxDurationSeconds;
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        if (next >= cap) {
          recorderRef.current?.stop();
        }
        return next;
      });
    }, 1000);
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  async function handleUpload() {
    const blob = recordedBlobRef.current;
    if (!blob) return;
    setPhase("uploading");
    setUploadError(null);

    const formData = new FormData();
    formData.set("recording", blob, `recording.${extensionFromMimeType(blob.type)}`);
    const result = await uploadSpeakingRecording(formData);

    if ("error" in result) {
      setUploadError(result.error);
      setPhase("upload-error");
      return;
    }
    setPhase("uploaded");
    onUploaded(result.path);
  }

  const attemptsRemaining = maxAttempts - attemptsUsed;

  let content: React.ReactNode;

  if (phase === "idle") {
    content = (
      <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
        <p className="text-sm text-muted-foreground">
          Recording needs microphone access - tap below to allow it.
        </p>
        <Button type="button" className="self-start" onClick={requestMic}>
          Enable microphone
        </Button>
      </div>
    );
  } else if (phase === "requesting") {
    content = (
      <p className="text-sm text-muted-foreground">
        Requesting microphone access… check for a permission prompt.
      </p>
    );
  } else if (ERROR_PHASES.includes(phase)) {
    content = (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-destructive">{GUIDANCE[phase]}</p>
        {phase !== "unsupported" && (
          <Button type="button" size="sm" className="self-start" onClick={requestMic}>
            Try again
          </Button>
        )}
      </div>
    );
  } else {
    content = (
      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        {(phase === "test-idle" || phase === "test-recording" || phase === "test-recorded") && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Mic check</Badge>
              <p className="text-sm text-muted-foreground">
                Record a short test clip and play it back before you begin.
              </p>
            </div>

            {phase === "test-idle" && (
              <Button type="button" size="sm" className="self-start" onClick={() => startRecording(true)}>
                Test your microphone
              </Button>
            )}

            {phase === "test-recording" && (
              <div className="flex items-center gap-3">
                <span className="text-sm">Recording test… {formatTime(elapsedSeconds)}</span>
                <Button type="button" size="sm" variant="outline" onClick={stopRecording}>
                  Stop
                </Button>
              </div>
            )}

            {phase === "test-recorded" && testUrl && (
              <div className="flex flex-col gap-2">
                <audio controls src={testUrl} className="h-10 w-full max-w-sm" />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setPhase("ready");
                      onMicCheckPassed?.();
                    }}
                  >
                    Sounds good, I&apos;m ready
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => startRecording(true)}>
                    Test again
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {phase === "ready" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Badge>Ready</Badge>
              <span className="text-sm text-muted-foreground">
                Up to {formatTime(maxDurationSeconds)}, {attemptsRemaining} attempt
                {attemptsRemaining === 1 ? "" : "s"} remaining.
              </span>
            </div>
            <Button
              type="button"
              className="self-start"
              disabled={attemptsRemaining <= 0}
              onClick={() => startRecording(false)}
            >
              Start recording
            </Button>
          </div>
        )}

        {phase === "recording" && (
          <div className="flex items-center gap-3">
            <span className="text-sm">
              Recording… {formatTime(elapsedSeconds)} / {formatTime(maxDurationSeconds)}
            </span>
            <Button type="button" size="sm" variant="outline" onClick={stopRecording}>
              Stop
            </Button>
          </div>
        )}

        {phase === "recorded" && recordedUrl && (
          <div className="flex flex-col gap-2">
            <audio controls src={recordedUrl} className="h-10 w-full max-w-sm" />
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={handleUpload}>
                Use this recording
              </Button>
              {allowReRecord && attemptsRemaining > 0 && (
                <Button type="button" size="sm" variant="outline" onClick={() => startRecording(false)}>
                  Record again
                </Button>
              )}
            </div>
            {!allowReRecord && (
              <p className="text-xs text-muted-foreground">Re-recording isn&apos;t allowed for this task.</p>
            )}
            {allowReRecord && attemptsRemaining <= 0 && (
              <p className="text-xs text-muted-foreground">No attempts remaining.</p>
            )}
          </div>
        )}

        {phase === "uploading" && <p className="text-sm text-muted-foreground">Uploading…</p>}

        {phase === "uploaded" && (
          <div className="flex flex-col gap-2">
            <Badge className="self-start">Saved</Badge>
            {recordedUrl && <audio controls src={recordedUrl} className="h-10 w-full max-w-sm" />}
          </div>
        )}

        {phase === "upload-error" && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-destructive">{uploadError}</p>
            <Button type="button" size="sm" onClick={handleUpload} className="self-start">
              Retry upload
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {content}
      {showDebugPanel && <DebugPanel phase={phase} rawError={rawError} capabilities={capabilities} />}
    </div>
  );
}
