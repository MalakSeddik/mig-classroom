"use client";

import { useActionState } from "react";
import { createCourse, updateCourse, type CourseFormState } from "./actions";
import { COURSE_LEVELS } from "@/lib/exams/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";

const initialState: CourseFormState = { error: null };

export type ExistingCourse = {
  id: string;
  title: string;
  level: string;
  description: string | null;
};

export function CourseForm({ existing }: { existing?: ExistingCourse }) {
  const action = existing ? updateCourse.bind(null, existing.id) : createCourse;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" defaultValue={existing?.title} required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="level">Level</Label>
        <NativeSelect id="level" name="level" defaultValue={existing?.level ?? "A1"} className="max-w-32" required>
          {COURSE_LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" name="description" rows={3} defaultValue={existing?.description ?? ""} />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving..." : existing ? "Save changes" : "Create course"}
      </Button>
    </form>
  );
}
