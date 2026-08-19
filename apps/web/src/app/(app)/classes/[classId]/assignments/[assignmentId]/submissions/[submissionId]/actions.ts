"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SaveGradeState = {
  error: string | null;
};

export async function saveGrade(
  classId: string,
  assignmentId: string,
  submissionId: string,
  _prevState: SaveGradeState,
  formData: FormData
): Promise<SaveGradeState> {
  const points = Number(formData.get("points"));
  const feedback = formData.get("feedback") as string;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  // grades.submission_id is unique - insert if this submission has no
  // grade yet, otherwise update the existing one. Either path is gated
  // by the same grades_insert/grades_update RLS policies (teacher of the
  // class, or admin).
  const { data: existing } = await supabase
    .from("grades")
    .select("id")
    .eq("submission_id", submissionId)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("grades")
        .update({ points, feedback: feedback || null, graded_by: user.id, graded_at: new Date().toISOString() })
        .eq("id", existing.id)
    : await supabase
        .from("grades")
        .insert({ submission_id: submissionId, points, feedback: feedback || null, graded_by: user.id });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/classes/${classId}/assignments/${assignmentId}`);
  revalidatePath(
    `/classes/${classId}/assignments/${assignmentId}/submissions/${submissionId}`
  );
  return { error: null };
}
