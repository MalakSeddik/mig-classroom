"use client";

import { useActionState } from "react";
import { createClass, updateClass, type ClassFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

const initialState: ClassFormState = { error: null };

export type ExistingClass = {
  id: string;
  course_id: string;
  teacher_id: string | null;
  name: string;
  start_date: string | null;
  end_date: string | null;
};

export function ClassForm({
  existing,
  courses,
  teachers,
}: {
  existing?: ExistingClass;
  courses: { id: string; title: string; level: string }[];
  teachers: { id: string; full_name: string | null }[];
}) {
  const action = existing ? updateClass.bind(null, existing.id) : createClass;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={existing?.name} required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="courseId">Course</Label>
          <NativeSelect id="courseId" name="courseId" defaultValue={existing?.course_id ?? ""} required>
            <option value="" disabled>
              Select a course
            </option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.level})
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="teacherId">Teacher</Label>
          <NativeSelect id="teacherId" name="teacherId" defaultValue={existing?.teacher_id ?? ""}>
            <option value="">No teacher assigned</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name ?? t.id}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="startDate">Start date</Label>
          <Input id="startDate" name="startDate" type="date" defaultValue={existing?.start_date ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="endDate">End date</Label>
          <Input id="endDate" name="endDate" type="date" defaultValue={existing?.end_date ?? ""} />
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving..." : existing ? "Save changes" : "Create class"}
      </Button>
    </form>
  );
}
