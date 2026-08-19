"use client";

import { useActionState } from "react";
import { addMaterials, type MaterialsState } from "./materials-actions";
import { Button } from "@/components/ui/button";
import { ACCEPT_ATTRIBUTE } from "@/lib/files/constants";

const initialState: MaterialsState = { error: null };

export function MaterialsUploadForm({
  classId,
  assignmentId,
}: {
  classId: string;
  assignmentId: string;
}) {
  const action = addMaterials.bind(null, classId, assignmentId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input
        name="files"
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        multiple
        className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
      />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} variant="secondary" className="self-start">
        {pending ? "Uploading..." : "Upload materials"}
      </Button>
    </form>
  );
}
