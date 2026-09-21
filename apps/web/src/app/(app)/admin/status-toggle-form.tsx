"use client";

import { useState, useTransition } from "react";
import { setUserStatus } from "./actions";
import { Button } from "@/components/ui/button";

/**
 * One button, either "Disable" (approved -> disabled) or "Enable"
 * (disabled/rejected -> approved) depending on the row's current status -
 * never both at once, since a user is only ever in one of those states.
 * setUserStatus() takes just (userId, newStatus), so a plain
 * useTransition + local error state is enough here - same shape
 * ConfirmDialog already uses for its own onConfirm() calls, no need for
 * useActionState's (prevState, formData) signature this action doesn't
 * need.
 */
export function StatusToggleForm({ userId, currentStatus }: { userId: string; currentStatus: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isApproved = currentStatus === "approved";
  const targetStatus = isApproved ? "disabled" : "approved";

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await setUserStatus(userId, targetStatus);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant={isApproved ? "outline" : "default"}
        size="sm"
        disabled={pending}
        onClick={handleClick}
      >
        {pending ? "Saving..." : isApproved ? "Disable" : "Enable"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
