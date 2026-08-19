"use client";

import { useActionState } from "react";
import { saveGrade, type SaveGradeState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: SaveGradeState = { error: null };

export function GradeForm({
  classId,
  assignmentId,
  submissionId,
  maxPoints,
  defaultPoints,
  defaultFeedback,
}: {
  classId: string;
  assignmentId: string;
  submissionId: string;
  maxPoints: number;
  defaultPoints?: number;
  defaultFeedback?: string | null;
}) {
  const action = saveGrade.bind(null, classId, assignmentId, submissionId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="points">Points (out of {maxPoints})</Label>
        <Input
          id="points"
          name="points"
          type="number"
          min={0}
          max={maxPoints}
          step="0.5"
          defaultValue={defaultPoints}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="feedback">Feedback</Label>
        <Textarea
          id="feedback"
          name="feedback"
          rows={4}
          defaultValue={defaultFeedback ?? ""}
        />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving..." : "Save grade"}
      </Button>
    </form>
  );
}
