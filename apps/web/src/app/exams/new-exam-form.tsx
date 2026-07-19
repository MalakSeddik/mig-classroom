"use client";

import { useActionState } from "react";
import { createExam, type ExamFormState } from "./actions";
import { COURSE_LEVELS } from "@/lib/exams/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

const initialState: ExamFormState = { error: null };

export function NewExamForm({
  classes,
}: {
  classes: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createExam, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="level">Level</Label>
          <NativeSelect id="level" name="level" defaultValue="A1" required>
            {COURSE_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="durationMinutes">Duration (minutes)</Label>
          <Input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            min={1}
            defaultValue={60}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="classId">Class</Label>
        <NativeSelect id="classId" name="classId" defaultValue="">
          <option value="">No class (standalone / certification)</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isCertification" className="accent-primary" />
        This is a certification exam
      </label>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="passingScore">Passing score (optional)</Label>
        <Input
          id="passingScore"
          name="passingScore"
          type="number"
          min={0}
          step="0.5"
          className="max-w-32"
        />
        <p className="text-xs text-muted-foreground">
          Only used for pass/fail on certification exams - leave blank otherwise.
        </p>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Creating..." : "Create exam"}
      </Button>
    </form>
  );
}
