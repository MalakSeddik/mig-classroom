"use client";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteCourse } from "./actions";
import { Button } from "@/components/ui/button";

export function DeleteCourseDialog({
  courseId,
  title,
  classCount,
  enrollmentCount,
}: {
  courseId: string;
  title: string;
  classCount: number;
  enrollmentCount: number;
}) {
  const highRisk = classCount > 0;

  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="outline" size="sm">
          Delete
        </Button>
      }
      title={`Delete "${title}"?`}
      description={
        highRisk ? (
          <>
            This course has <strong>{classCount}</strong> class{classCount === 1 ? "" : "es"} and{" "}
            <strong>{enrollmentCount}</strong> enrolled student{enrollmentCount === 1 ? "" : "s"}.
            Deleting it will delete those classes and everything under them — enrollments,
            assignments, sessions, and their submissions/grades. Any exams tied to these classes
            will become standalone (not deleted).
          </>
        ) : (
          "This can't be undone."
        )
      }
      requireTypedConfirmation={highRisk ? title : undefined}
      onConfirm={() => deleteCourse(courseId)}
    />
  );
}
