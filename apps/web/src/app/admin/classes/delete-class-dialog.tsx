"use client";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteClass } from "./actions";
import { Button } from "@/components/ui/button";

export function DeleteClassDialog({
  classId,
  name,
  enrollmentCount,
  assignmentCount,
  examCount,
}: {
  classId: string;
  name: string;
  enrollmentCount: number;
  assignmentCount: number;
  examCount: number;
}) {
  const highRisk = enrollmentCount > 0 || assignmentCount > 0 || examCount > 0;

  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="outline" size="sm">
          Delete
        </Button>
      }
      title={`Delete "${name}"?`}
      description={
        highRisk ? (
          <>
            This will remove <strong>{enrollmentCount}</strong> enrolled student
            {enrollmentCount === 1 ? "" : "s"}, delete <strong>{assignmentCount}</strong> assignment
            {assignmentCount === 1 ? "" : "s"} (and their submissions/grades), and{" "}
            <strong>{examCount}</strong> exam{examCount === 1 ? "" : "s"} will become standalone (no
            longer tied to this class).
          </>
        ) : (
          "This can't be undone."
        )
      }
      requireTypedConfirmation={highRisk ? name : undefined}
      onConfirm={() => deleteClass(classId)}
    />
  );
}
