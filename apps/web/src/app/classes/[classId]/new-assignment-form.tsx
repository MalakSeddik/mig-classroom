"use client";

import { useActionState } from "react";
import { createAssignment, type CreateAssignmentState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: CreateAssignmentState = { error: null };

export function NewAssignmentForm({ classId }: { classId: string }) {
  const action = createAssignment.bind(null, classId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="instructions">Instructions</Label>
        <Textarea id="instructions" name="instructions" rows={3} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dueDate">Due date</Label>
          <Input id="dueDate" name="dueDate" type="date" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="maxPoints">Max points</Label>
          <Input
            id="maxPoints"
            name="maxPoints"
            type="number"
            min={0}
            step="0.5"
            defaultValue={100}
          />
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Creating..." : "Create assignment"}
      </Button>
    </form>
  );
}
