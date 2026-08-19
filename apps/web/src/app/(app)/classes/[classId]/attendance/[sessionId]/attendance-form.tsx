"use client";

import { useActionState } from "react";
import { saveAttendance, type SaveAttendanceState } from "../actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

const initialState: SaveAttendanceState = { error: null };

const STATUS_OPTIONS = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "excused", label: "Excused" },
] as const;

export function AttendanceForm({
  classId,
  sessionId,
  students,
}: {
  classId: string;
  sessionId: string;
  students: { id: string; name: string; status: string }[];
}) {
  const action = saveAttendance.bind(null, classId, sessionId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {students.map((student) => (
          <li
            key={student.id}
            className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
          >
            <Label htmlFor={`status-${student.id}`} className="text-sm font-normal">
              {student.name}
            </Label>
            <NativeSelect
              id={`status-${student.id}`}
              name={`status-${student.id}`}
              defaultValue={student.status}
              className="w-32"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </NativeSelect>
          </li>
        ))}
      </ul>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving..." : "Save attendance"}
      </Button>
    </form>
  );
}
