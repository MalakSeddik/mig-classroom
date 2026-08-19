"use client";

import { useActionState, useState } from "react";
import { submitAssignment, type SubmitState } from "./actions";
import { AudioRecorder } from "@/components/audio-recorder";
import { SpeakingRecordingPlayback } from "@/components/speaking-recording-playback";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ACCEPT_ATTRIBUTE } from "@/lib/files/constants";
import { ASSIGNMENT_AUDIO_MAX_ATTEMPTS, ASSIGNMENT_AUDIO_MAX_DURATION_SECONDS } from "@/lib/recordings/constants";

const initialState: SubmitState = { error: null };

export function SubmitForm({
  classId,
  assignmentId,
  defaultContent,
  currentFileName,
  currentAudioPath,
  requiresAudio = false,
  submitLabel = "Submit",
}: {
  classId: string;
  assignmentId: string;
  defaultContent?: string | null;
  currentFileName?: string | null;
  currentAudioPath?: string | null;
  requiresAudio?: boolean;
  submitLabel?: string;
}) {
  const action = submitAssignment.bind(null, classId, assignmentId);
  const [state, formAction, pending] = useActionState(action, initialState);

  // audioPath tracks the take that will actually be attached on submit -
  // starts as whatever's already on the submission (if any). Recording a
  // fresh take replaces it client-side; nothing is sent to the server
  // until the real Submit/Update button is clicked, same as the text and
  // file fields below. recorderKey forces a fresh <AudioRecorder> mount
  // (new internal attemptsUsed/phase state) each time the student wants
  // to try again after already using a take - practice mode's "re-record
  // as many times as you like" isn't bounded by a single mount's
  // maxAttempts.
  const [audioPath, setAudioPath] = useState<string | null>(currentAudioPath ?? null);
  const [recorderKey, setRecorderKey] = useState(0);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="content">Your answer</Label>
        <Textarea
          id="content"
          name="content"
          rows={8}
          defaultValue={defaultContent ?? ""}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="file">
          {currentFileName ? `Replace file (current: ${currentFileName})` : "Attach a file (optional)"}
        </Label>
        <input
          id="file"
          name="file"
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
        />
        <p className="text-xs text-muted-foreground">
          PDF, Word, image, or audio (mp3/m4a/wav) - max 20MB.
        </p>
      </div>

      {requiresAudio && (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Spoken answer needed</Badge>
            <p className="text-sm font-medium">This assignment needs a spoken answer.</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Have your mic ready and run the quick mic check below - you can re-record as many times as
            you like before submitting.
          </p>

          <input type="hidden" name="audioPath" value={audioPath ?? ""} />

          {audioPath ? (
            <div className="flex flex-col gap-2">
              <SpeakingRecordingPlayback path={audioPath} label="Your recording" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => {
                  setAudioPath(null);
                  setRecorderKey((k) => k + 1);
                }}
              >
                Record a new answer
              </Button>
            </div>
          ) : (
            <AudioRecorder
              key={recorderKey}
              maxDurationSeconds={ASSIGNMENT_AUDIO_MAX_DURATION_SECONDS}
              maxAttempts={ASSIGNMENT_AUDIO_MAX_ATTEMPTS}
              allowReRecord
              onUploaded={(path) => setAudioPath(path)}
            />
          )}
        </div>
      )}

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
