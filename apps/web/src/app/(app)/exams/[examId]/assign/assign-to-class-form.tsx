"use client";

import { useState, useTransition } from "react";
import { assignExamToClass } from "./actions";
import { Button } from "@/components/ui/button";

export function AssignToClassForm({ examId, classId }: { examId: string; classId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await assignExamToClass(examId, classId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" disabled={pending} onClick={handleClick} className="self-start">
        {pending ? "Assigning..." : "Assign to class"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
