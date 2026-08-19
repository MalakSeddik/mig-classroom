"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ExamFormState = {
  error: string | null;
};

export async function createExam(
  _prevState: ExamFormState,
  formData: FormData
): Promise<ExamFormState> {
  const title = ((formData.get("title") as string) || "").trim();
  const level = formData.get("level") as string;
  const isCertification = formData.get("isCertification") === "on";
  const durationMinutes = Number(formData.get("durationMinutes"));
  const classId = (formData.get("classId") as string) || null;
  const passingScoreRaw = (formData.get("passingScore") as string) || "";
  const passingScore = passingScoreRaw ? Number(passingScoreRaw) : null;

  if (!title) return { error: "Title is required." };
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { error: "Duration must be a positive number of minutes." };
  }
  if (passingScore !== null && (!Number.isFinite(passingScore) || passingScore < 0)) {
    return { error: "Passing score must be a non-negative number." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: inserted, error } = await supabase
    .from("exams")
    .insert({
      title,
      level,
      is_certification: isCertification,
      duration_minutes: durationMinutes,
      class_id: classId,
      passing_score: passingScore,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/exams");
  redirect(`/exams/${inserted.id}`);
}
