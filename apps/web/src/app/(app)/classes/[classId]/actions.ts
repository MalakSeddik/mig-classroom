"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CreateAssignmentState = {
  error: string | null;
};

export async function createAssignment(
  classId: string,
  _prevState: CreateAssignmentState,
  formData: FormData
): Promise<CreateAssignmentState> {
  const title = formData.get("title") as string;
  const instructions = formData.get("instructions") as string;
  const dueDate = formData.get("dueDate") as string;
  const maxPoints = formData.get("maxPoints") as string;
  const requiresAudio = formData.get("requiresAudio") === "on";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  // No role check here - assignments_insert (admin or teaches_class)
  // handles that. If this insert isn't allowed, RLS rejects it and we
  // just surface the resulting error.
  const { error } = await supabase.from("assignments").insert({
    class_id: classId,
    title,
    instructions: instructions || null,
    due_date: dueDate ? new Date(dueDate).toISOString() : null,
    max_points: maxPoints ? Number(maxPoints) : 100,
    requires_audio: requiresAudio,
    created_by: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/classes/${classId}`);
  return { error: null };
}
