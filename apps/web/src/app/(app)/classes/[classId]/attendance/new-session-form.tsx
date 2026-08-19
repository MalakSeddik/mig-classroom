"use client";

import { useActionState } from "react";
import { createSession, type CreateSessionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: CreateSessionState = { error: null };

export function NewSessionForm({ classId }: { classId: string }) {
  const action = createSession.bind(null, classId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sessionDate">Date</Label>
          <Input id="sessionDate" name="sessionDate" type="date" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="topic">Topic (optional)</Label>
          <Input id="topic" name="topic" />
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Creating..." : "Create session"}
      </Button>
    </form>
  );
}
