"use client";

import { useActionState } from "react";
import { approveRegistration, type ApprovalState } from "./actions";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

const initialState: ApprovalState = { error: null };

export function ApproveForm({
  userId,
  requestedRole,
}: {
  userId: string;
  requestedRole: string;
}) {
  const action = approveRegistration.bind(null, userId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <NativeSelect name="role" defaultValue={requestedRole} className="w-28">
        <option value="student">Student</option>
        <option value="teacher">Teacher</option>
      </NativeSelect>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Approving..." : "Approve"}
      </Button>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
