"use client";

import { useActionState, useRef } from "react";
import { assignExamToStudents, type AssignFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const initialState: AssignFormState = { error: null };

export function AssignToStudentsForm({
  examId,
  students,
}: {
  examId: string;
  students: { id: string; full_name: string | null }[];
}) {
  const [state, formAction, pending] = useActionState(
    assignExamToStudents.bind(null, examId),
    initialState
  );

  const startsAtLocalRef = useRef<HTMLInputElement>(null);
  const endsAtLocalRef = useRef<HTMLInputElement>(null);
  const startsAtRef = useRef<HTMLInputElement>(null);
  const endsAtRef = useRef<HTMLInputElement>(null);

  // datetime-local inputs hold the viewer's local wall-clock time with no
  // timezone attached. new Date(...) here runs in the browser, so it
  // correctly resolves that string against *this browser's* timezone and
  // converts it to an absolute instant (toISOString(), always UTC). Doing
  // this same conversion inside the Server Action instead would use the
  // server's timezone, not the viewer's - copied into hidden fields here
  // so the action only ever has to handle an already-correct ISO string.
  function handleSubmit() {
    if (startsAtRef.current) {
      startsAtRef.current.value = startsAtLocalRef.current?.value
        ? new Date(startsAtLocalRef.current.value).toISOString()
        : "";
    }
    if (endsAtRef.current) {
      endsAtRef.current.value = endsAtLocalRef.current?.value
        ? new Date(endsAtLocalRef.current.value).toISOString()
        : "";
    }
  }

  const inputClass =
    "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <form action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="startsAt" ref={startsAtRef} />
      <input type="hidden" name="endsAt" ref={endsAtRef} />

      <div className="flex max-h-64 flex-col gap-2 overflow-y-auto rounded-md border border-border p-3">
        {students.length > 0 ? (
          students.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="studentIds" value={s.id} className="accent-primary" />
              {s.full_name ?? s.id}
            </label>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No students found.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="startsAtLocal">Opens at (optional)</Label>
          <input id="startsAtLocal" type="datetime-local" ref={startsAtLocalRef} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="endsAtLocal">Closes at (optional)</Label>
          <input id="endsAtLocal" type="datetime-local" ref={endsAtLocalRef} className={inputClass} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Leave both blank for no schedule window (takeable as soon as it&apos;s assigned).
      </p>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Assigning..." : "Assign to selected students"}
      </Button>
    </form>
  );
}
