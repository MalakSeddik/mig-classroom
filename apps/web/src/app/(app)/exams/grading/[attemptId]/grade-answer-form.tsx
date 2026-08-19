"use client";

import { useActionState } from "react";
import { saveAnswerGrade, type GradeFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const initialState: GradeFormState = { error: null };

export function GradeAnswerForm({
  attemptId,
  answerId,
  maxPoints,
  defaultPoints,
  defaultFeedback,
}: {
  attemptId: string;
  answerId: string;
  maxPoints: number;
  defaultPoints: number | null;
  defaultFeedback: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    saveAnswerGrade.bind(null, attemptId, answerId),
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`points-${answerId}`}>Points (max {maxPoints})</Label>
          <Input
            id={`points-${answerId}`}
            name="points"
            type="number"
            min={0}
            step="0.5"
            defaultValue={defaultPoints ?? ""}
            className="h-8 w-24"
            required
          />
        </div>
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Button>
      </div>
      <Textarea name="feedback" rows={2} placeholder="Feedback (optional)" defaultValue={defaultFeedback ?? ""} />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
