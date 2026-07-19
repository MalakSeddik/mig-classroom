"use client";

import { useState, useTransition } from "react";
import { addEnrollment } from "./enrollment-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function StudentPicker({
  classId,
  students,
}: {
  classId: string;
  students: { id: string; full_name: string | null }[];
}) {
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = students.filter((s) =>
    (s.full_name ?? s.id).toLowerCase().includes(query.trim().toLowerCase())
  );

  function handleAdd(studentId: string) {
    setError(null);
    setPendingId(studentId);
    startTransition(async () => {
      const result = await addEnrollment(classId, studentId);
      setPendingId(null);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        placeholder="Search students..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex max-h-64 flex-col gap-2 overflow-y-auto rounded-md border border-border p-3">
        {filtered.length > 0 ? (
          filtered.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
              <span>{s.full_name ?? s.id}</span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pendingId === s.id}
                onClick={() => handleAdd(s.id)}
              >
                {pendingId === s.id ? "Adding..." : "Add"}
              </Button>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            {students.length === 0 ? "No students available to add." : "No matches."}
          </p>
        )}
      </div>
    </div>
  );
}
