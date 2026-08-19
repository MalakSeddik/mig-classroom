"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startOrResumeAttempt } from "@/lib/exams/attempt-engine";
import { AudioRecorder } from "@/components/audio-recorder";
import { SPEAKING_ANSWER_MAX_ATTEMPTS, SPEAKING_ANSWER_MAX_DURATION_SECONDS } from "@/lib/exams/constants";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Shown instead of <ExamTakingForm> when a fresh attempt hasn't been
 * created yet (see getExamStartInfo in attempt-engine.ts) - this is what
 * keeps the mic check from eating into the exam's timed duration: the
 * clock only starts once startOrResumeAttempt actually runs, which here
 * only happens after the "Start exam" click. Resuming an in-progress
 * attempt skips this screen entirely (the page only renders it for
 * getExamStartInfo's "ready" kind), since the clock is already running
 * either way at that point.
 */
export function ExamStartScreen({
  examId,
  examTitle,
  durationMinutes,
  hasSpeaking,
}: {
  examId: string;
  examTitle: string;
  durationMinutes: number;
  hasSpeaking: boolean;
}) {
  const router = useRouter();
  const [micReady, setMicReady] = useState(!hasSpeaking);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setStarting(true);
    setError(null);
    const result = await startOrResumeAttempt(examId);
    if (result.kind === "error") {
      setError(result.message);
      setStarting(false);
      return;
    }
    // Attempt now exists (or was already there) - re-render the server
    // page, which will pick the "resume" branch this time and show
    // <ExamTakingForm> instead of this screen.
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{examTitle}</CardTitle>
        <CardDescription>{durationMinutes} minutes once started</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {hasSpeaking && (
          <div className="flex flex-col gap-3 rounded-md border border-warning/40 bg-warning/10 p-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-warning text-warning-foreground">Speaking question</Badge>
              <p className="text-sm font-medium">This exam includes a speaking question.</p>
            </div>
            <ul className="list-inside list-disc text-sm text-muted-foreground">
              <li>The timer keeps running while you record - it does not pause.</li>
              <li>
                You get exactly {SPEAKING_ANSWER_MAX_ATTEMPTS} recording attempt
                {SPEAKING_ANSWER_MAX_ATTEMPTS === 1 ? "" : "s"} per speaking question, up to{" "}
                {SPEAKING_ANSWER_MAX_DURATION_SECONDS} seconds - there is no re-recording once you use it.
              </li>
            </ul>

            {!micReady ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  Complete a mic check before you can start - this confirms your microphone works without
                  costing you any attempts.
                </p>
                <AudioRecorder
                  maxDurationSeconds={SPEAKING_ANSWER_MAX_DURATION_SECONDS}
                  maxAttempts={SPEAKING_ANSWER_MAX_ATTEMPTS}
                  allowReRecord={false}
                  onUploaded={() => {}}
                  onMicCheckPassed={() => setMicReady(true)}
                />
              </div>
            ) : (
              <Badge>Mic check passed</Badge>
            )}
          </div>
        )}

        <Button type="button" onClick={handleStart} disabled={!micReady || starting} className="self-start">
          {starting ? "Starting..." : "Start exam"}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
