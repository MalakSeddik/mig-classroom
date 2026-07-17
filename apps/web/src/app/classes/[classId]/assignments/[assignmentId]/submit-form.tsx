"use client";

import { useActionState } from "react";
import { submitAssignment, type SubmitState } from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ACCEPT_ATTRIBUTE } from "@/lib/files/constants";

const initialState: SubmitState = { error: null };

export function SubmitForm({
  classId,
  assignmentId,
  defaultContent,
  currentFileName,
  submitLabel = "Submit",
}: {
  classId: string;
  assignmentId: string;
  defaultContent?: string | null;
  currentFileName?: string | null;
  submitLabel?: string;
}) {
  const action = submitAssignment.bind(null, classId, assignmentId);
  const [state, formAction, pending] = useActionState(action, initialState);

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

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
