"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type GradeFormState = {
  error: string | null;
};

// Recomputes total_score and flips status - shared by "the last pending
// manual answer just got graded" (auto_graded -> final) and "a
// already-final attempt's score was overridden" (stays final, total_score
// just changes). No admin client needed anywhere in this file: staff
// already has full RLS access to exam_attempts/answers, so the regular
// signed-in client is the right tool here, same as the rest of the
// exam-authoring pages.
async function recomputeAttemptStatus(attemptId: string) {
  const supabase = await createClient();
  const { data: answers } = await supabase.from("answers").select("points_awarded").eq("attempt_id", attemptId);

  const hasPending = (answers ?? []).some((a) => a.points_awarded === null);
  const totalScore = (answers ?? []).reduce((sum, a) => sum + (a.points_awarded ?? 0), 0);

  await supabase
    .from("exam_attempts")
    .update({ status: hasPending ? "auto_graded" : "final", total_score: totalScore })
    .eq("id", attemptId);
}

/**
 * Sets/overrides one answer's score and feedback - works for every answer
 * in an attempt, not just writing/speaking. is_correct is deliberately
 * left untouched here: once a teacher assigns points directly, "correct"
 * stops being a clean yes/no (partial credit is possible), so the
 * original auto-grade determination is left as historical context rather
 * than rewritten to match the override.
 */
export async function saveAnswerGrade(
  attemptId: string,
  answerId: string,
  _prevState: GradeFormState,
  formData: FormData
): Promise<GradeFormState> {
  const points = Number(formData.get("points"));
  const feedback = ((formData.get("feedback") as string) || "").trim() || null;

  if (!Number.isFinite(points) || points < 0) {
    return { error: "Points must be a non-negative number." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("answers")
    .update({ points_awarded: points, feedback, graded_by: user.id })
    .eq("id", answerId);

  if (error) return { error: error.message };

  await recomputeAttemptStatus(attemptId);
  revalidatePath(`/exams/grading/${attemptId}`);
  revalidatePath("/exams/grading");
  return { error: null };
}
