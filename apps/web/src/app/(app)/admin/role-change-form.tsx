"use client";

import { useActionState } from "react";
import { changeUserRole, type UserActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

const initialState: UserActionState = { error: null };

export function RoleChangeForm({ userId, currentRole }: { userId: string; currentRole: string }) {
  const action = changeUserRole.bind(null, userId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <NativeSelect name="role" defaultValue={currentRole} className="w-28">
        <option value="student">Student</option>
        <option value="teacher">Teacher</option>
        <option value="admin">Admin</option>
      </NativeSelect>
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Saving..." : "Change"}
      </Button>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
